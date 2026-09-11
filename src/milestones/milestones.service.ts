import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { S3Service } from '../aws/s3.service';
import { EmailService } from '../email/email.service';
import {
  EvidenceQueueItem,
  EvidenceStatus,
  Milestone,
  MilestoneTask,
  MilestoneView,
  TaskEvidence,
  TaskWithEvidence,
} from './milestone.interfaces';
import {
  computeUnlockedMilestoneIds,
  isMilestoneComplete,
} from './milestone-logic';

/**
 * Desbloqueo secuencial de milestones (brief §4: "each milestone depends on
 * the completion of the previous one"), calculado en el momento a partir de
 * `task_evidence` — sin tabla de estado redundante que se pueda desincronizar.
 */
@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly s3Service: S3Service,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  /**
   * Lista plana de milestones (sin lógica de desbloqueo) — usada por el
   * admin para elegir a qué milestone se asocia un reward.
   */
  async listAllMilestones(): Promise<Milestone[]> {
    const { data, error } = await this.client
      .from('milestones')
      .select('*')
      .order('order_index');

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []) as Milestone[];
  }

  async getPartnerView(partnerId: string): Promise<MilestoneView[]> {
    const { milestones, tasksByMilestone, evidenceByTask } =
      await this.loadMilestoneData(partnerId);
    const unlockedIds = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestone,
      evidenceByTask,
    );

    return milestones.map((milestone): MilestoneView => {
      if (!unlockedIds.has(milestone.id)) {
        return {
          id: milestone.id,
          order_index: milestone.order_index,
          locked: true,
        };
      }

      const tasks: TaskWithEvidence[] = (
        tasksByMilestone.get(milestone.id) ?? []
      ).map((task) => ({
        ...task,
        evidence: evidenceByTask.get(task.id) ?? null,
      }));

      return {
        id: milestone.id,
        order_index: milestone.order_index,
        locked: false,
        title: milestone.title,
        description: milestone.description ?? undefined,
        tasks,
      };
    });
  }

  async submitTextEvidence(
    partnerId: string,
    taskId: string,
    textValue: string,
  ): Promise<TaskEvidence> {
    const task = await this.getTaskOrThrow(taskId);
    if (task.evidence_type !== 'text') {
      throw new BadRequestException(
        'Esta tarefa não aceita evidência em texto',
      );
    }
    await this.assertMilestoneUnlocked(partnerId, task.milestone_id);
    await this.assertEvidenceNotApproved(taskId, partnerId);
    return this.finalizeEvidenceSubmission(partnerId, task, {
      text_value: textValue,
      file_path: null,
    });
  }

  async createFileUploadPost(
    partnerId: string,
    taskId: string,
    contentType: string,
  ) {
    const task = await this.getTaskOrThrow(taskId);
    if (task.evidence_type !== 'file') {
      throw new BadRequestException('Esta tarefa não aceita upload de arquivo');
    }
    await this.assertMilestoneUnlocked(partnerId, task.milestone_id);
    await this.assertEvidenceNotApproved(taskId, partnerId);

    const filePath = `${partnerId}/${taskId}/${Date.now()}-${randomUUID()}`;
    const { url, fields } = await this.s3Service.createEvidenceUploadPost(
      filePath,
      contentType,
    );

    return { url, fields, filePath };
  }

  async submitFileEvidence(
    partnerId: string,
    taskId: string,
    filePath: string,
  ): Promise<TaskEvidence> {
    const task = await this.getTaskOrThrow(taskId);
    if (task.evidence_type !== 'file') {
      throw new BadRequestException('Esta tarefa não aceita upload de arquivo');
    }
    // filePath debe ser el que este mesmo backend gerou em createFileUploadPost
    // (prefixado por partnerId/taskId) — não aceita um path arbitrário do cliente.
    if (!filePath.startsWith(`${partnerId}/${taskId}/`)) {
      throw new BadRequestException('filePath inválido');
    }
    await this.assertMilestoneUnlocked(partnerId, task.milestone_id);
    await this.assertEvidenceNotApproved(taskId, partnerId);

    return this.finalizeEvidenceSubmission(partnerId, task, {
      text_value: null,
      file_path: filePath,
    });
  }

  async listEvidenceQueue(
    status?: EvidenceStatus,
  ): Promise<EvidenceQueueItem[]> {
    let query = this.client
      .from('task_evidence')
      .select(this.evidenceQueueSelect)
      .order('submitted_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return this.mapEvidenceQueueRows(data ?? []);
  }

  async listPartnerEvidenceHistory(
    partnerId: string,
  ): Promise<EvidenceQueueItem[]> {
    const { data, error } = await this.client
      .from('task_evidence')
      .select(this.evidenceQueueSelect)
      .eq('partner_id', partnerId)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return this.mapEvidenceQueueRows(data ?? []);
  }

  async getEvidenceFileUrl(evidenceId: string): Promise<string> {
    const { data: evidence, error } = await this.client
      .from('task_evidence')
      .select('file_path')
      .eq('id', evidenceId)
      .single();

    if (error || !evidence?.file_path) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    return this.s3Service.getSignedDownloadUrl(evidence.file_path);
  }

  async reviewEvidence(
    evidenceId: string,
    adminId: string,
    status: 'approved' | 'rejected',
    note?: string,
  ): Promise<TaskEvidence> {
    const { data: existing } = await this.client
      .from('task_evidence')
      .select('status')
      .eq('id', evidenceId)
      .single();

    const { data, error } = await this.client
      .from('task_evidence')
      .update({
        status,
        review_note: note ?? null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', evidenceId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Evidência não encontrada');
    }

    const evidence = data as TaskEvidence;

    // Solo dispara el mail de milestone completo en la transición a
    // "approved" — evita reenviarlo si algo ya aprobado se re-guarda.
    if (status === 'approved' && existing?.status !== 'approved') {
      this.checkMilestoneCompletion(
        evidence.partner_id,
        evidence.task_id,
      ).catch((error) =>
        this.logger.error(
          `Falha ao verificar conclusão de milestone: ${(error as Error).message}`,
        ),
      );
    }

    return evidence;
  }

  // --- helpers ---

  private readonly evidenceQueueSelect = `id, task_id, partner_id, text_value, file_path, status, review_note, reviewed_by, reviewed_at, submitted_at,
     task:milestone_tasks(id, milestone_id, order_index, title, description, evidence_type, milestone:milestones(id, order_index, title, description)),
     partner:profiles!task_evidence_partner_id_fkey(id, email, full_name)`;

  private mapEvidenceQueueRows(rows: any[]): EvidenceQueueItem[] {
    return rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      partner_id: row.partner_id,
      text_value: row.text_value,
      file_path: row.file_path,
      status: row.status,
      review_note: row.review_note,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      submitted_at: row.submitted_at,
      task: row.task,
      milestone: row.task?.milestone,
      partner: row.partner,
    }));
  }

  private async finalizeEvidenceSubmission(
    partnerId: string,
    task: MilestoneTask,
    values: { text_value: string | null; file_path: string | null },
  ): Promise<TaskEvidence> {
    const evidence = await this.upsertEvidence(task.id, partnerId, values);
    this.notifyEvidenceSubmitted(partnerId, task).catch((error) =>
      this.logger.error(
        `Falha ao notificar envio de evidência: ${(error as Error).message}`,
      ),
    );
    return evidence;
  }

  private async getNotificationRecipients(partnerId: string) {
    const [{ data: partner }, { data: admins }] = await Promise.all([
      this.client
        .from('profiles')
        .select('email, full_name')
        .eq('id', partnerId)
        .single(),
      this.client.from('profiles').select('email').eq('role', 'admin'),
    ]);

    return {
      partnerEmail: partner?.email ?? null,
      partnerName: partner?.full_name ?? null,
      adminEmails: ((admins ?? []) as { email: string }[]).map((a) => a.email),
    };
  }

  private async notifyEvidenceSubmitted(
    partnerId: string,
    task: MilestoneTask,
  ) {
    const { partnerEmail, partnerName, adminEmails } =
      await this.getNotificationRecipients(partnerId);
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const greeting = partnerName ? `Olá, ${partnerName}` : 'Olá';

    if (partnerEmail) {
      await this.emailService.send({
        to: [partnerEmail],
        subject: 'Evidência recebida — Kaspersky Partner Quest',
        html: `<p>${greeting},</p><p>Recebemos sua evidência para a tarefa <strong>${task.title}</strong>. Nossa equipe vai revisar em breve.</p>${
          frontendUrl
            ? `<p><a href="${frontendUrl}/dashboard">Ver meu painel</a></p>`
            : ''
        }`,
      });
    }

    if (adminEmails.length > 0) {
      await this.emailService.send({
        to: adminEmails,
        subject: 'Nova evidência para revisar',
        html: `<p>${partnerName ?? partnerEmail ?? 'Um parceiro'} enviou evidência para a tarefa <strong>${task.title}</strong>.</p>${
          frontendUrl
            ? `<p><a href="${frontendUrl}/admin/evidence">Revisar agora</a></p>`
            : ''
        }`,
      });
    }
  }

  /**
   * Milestones que un partner ya completó (todas las tasks con evidencia
   * requerida aprobadas) — usado por RewardsService para calcular
   * elegibilidad de rewards sin duplicar el motor de milestones.
   */
  async getCompletedMilestoneIds(partnerId: string): Promise<Set<string>> {
    const { milestones, tasksByMilestone, evidenceByTask } =
      await this.loadMilestoneData(partnerId);

    const completed = new Set<string>();
    for (const milestone of milestones) {
      if (isMilestoneComplete(milestone.id, tasksByMilestone, evidenceByTask)) {
        completed.add(milestone.id);
      }
    }
    return completed;
  }

  private async checkMilestoneCompletion(partnerId: string, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    const { milestones, tasksByMilestone, evidenceByTask } =
      await this.loadMilestoneData(partnerId);
    const milestone = milestones.find((m) => m.id === task.milestone_id);
    if (!milestone) {
      return;
    }

    if (!isMilestoneComplete(milestone.id, tasksByMilestone, evidenceByTask)) {
      return;
    }

    await this.notifyMilestoneCompleted(partnerId, milestone);

    const allMilestonesComplete = milestones.every((m) =>
      isMilestoneComplete(m.id, tasksByMilestone, evidenceByTask),
    );
    if (allMilestonesComplete) {
      await this.notifyProgramCompleted(partnerId);
    }
  }

  private async notifyMilestoneCompleted(
    partnerId: string,
    milestone: Milestone,
  ) {
    const { partnerEmail, partnerName, adminEmails } =
      await this.getNotificationRecipients(partnerId);
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const greeting = partnerName ? `Parabéns, ${partnerName}` : 'Parabéns';

    if (partnerEmail) {
      await this.emailService.send({
        to: [partnerEmail],
        subject: `Etapa concluída: ${milestone.title}`,
        html: `<p>${greeting}!</p><p>Você concluiu a etapa <strong>${milestone.title}</strong>.</p>${
          frontendUrl
            ? `<p><a href="${frontendUrl}/dashboard">Ver meu painel</a></p>`
            : ''
        }`,
      });
    }

    if (adminEmails.length > 0) {
      await this.emailService.send({
        to: adminEmails,
        subject: `Parceiro concluiu etapa: ${milestone.title}`,
        html: `<p>${partnerName ?? partnerEmail ?? 'Um parceiro'} concluiu a etapa <strong>${milestone.title}</strong>.</p>${
          frontendUrl
            ? `<p><a href="${frontendUrl}/admin/evidence">Ver detalhes</a></p>`
            : ''
        }`,
      });
    }
  }

  private async notifyProgramCompleted(partnerId: string) {
    const { partnerEmail, partnerName, adminEmails } =
      await this.getNotificationRecipients(partnerId);
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const greeting = partnerName ? `Parabéns, ${partnerName}` : 'Parabéns';

    if (partnerEmail) {
      await this.emailService.send({
        to: [partnerEmail],
        subject: 'Você concluiu o Kaspersky Partner Quest!',
        html: `<p>${greeting}! 🎉</p>
          <p>Você concluiu todas as 5 etapas do Kaspersky Partner Quest — Discover, Capacitação, Engaging, Prospecting e Win/Celebration. Parabéns por essa conquista!</p>
          ${frontendUrl ? `<p><a href="${frontendUrl}/dashboard">Ver meu painel</a></p>` : ''}`,
      });
    }

    if (adminEmails.length > 0) {
      await this.emailService.send({
        to: adminEmails,
        subject: `Parceiro concluiu o programa: ${partnerName ?? partnerEmail ?? 'parceiro'}`,
        html: `<p>${partnerName ?? partnerEmail ?? 'Um parceiro'} concluiu todas as 5 etapas do programa.</p>`,
      });
    }
  }

  private async getTaskOrThrow(taskId: string): Promise<MilestoneTask> {
    const { data, error } = await this.client
      .from('milestone_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    return data as MilestoneTask;
  }

  private async assertMilestoneUnlocked(
    partnerId: string,
    milestoneId: string,
  ) {
    const { milestones, tasksByMilestone, evidenceByTask } =
      await this.loadMilestoneData(partnerId);
    const unlockedIds = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestone,
      evidenceByTask,
    );
    if (!unlockedIds.has(milestoneId)) {
      throw new ForbiddenException('Esta etapa ainda não foi desbloqueada');
    }
  }

  /**
   * Sin esto, un partner podía reenviar evidencia para una tarea ya
   * aprobada y resetearla a "pending" sin que la review anterior quedara
   * protegida — como el desbloqueo de milestones se recalcula en vivo
   * desde task_evidence, eso podía re-bloquear milestones ya alcanzados.
   */
  private async assertEvidenceNotApproved(taskId: string, partnerId: string) {
    const { data } = await this.client
      .from('task_evidence')
      .select('status')
      .eq('task_id', taskId)
      .eq('partner_id', partnerId)
      .maybeSingle();

    if (data?.status === 'approved') {
      throw new ConflictException(
        'Esta evidência já foi aprovada e não pode ser reenviada',
      );
    }
  }

  private async upsertEvidence(
    taskId: string,
    partnerId: string,
    values: { text_value: string | null; file_path: string | null },
  ): Promise<TaskEvidence> {
    const { data, error } = await this.client
      .from('task_evidence')
      .upsert(
        {
          task_id: taskId,
          partner_id: partnerId,
          ...values,
          status: 'pending',
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,partner_id' },
      )
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Não foi possível salvar a evidência',
      );
    }
    return data as TaskEvidence;
  }

  private async loadMilestoneData(partnerId: string) {
    const [
      { data: milestones, error: milestonesError },
      { data: tasks, error: tasksError },
      { data: evidence, error: evidenceError },
    ] = await Promise.all([
      this.client.from('milestones').select('*').order('order_index'),
      this.client.from('milestone_tasks').select('*').order('order_index'),
      this.client.from('task_evidence').select('*').eq('partner_id', partnerId),
    ]);

    if (milestonesError || tasksError || evidenceError) {
      throw new InternalServerErrorException(
        milestonesError?.message ??
          tasksError?.message ??
          evidenceError?.message,
      );
    }

    const tasksByMilestone = new Map<string, MilestoneTask[]>();
    for (const task of (tasks ?? []) as MilestoneTask[]) {
      const list = tasksByMilestone.get(task.milestone_id) ?? [];
      list.push(task);
      tasksByMilestone.set(task.milestone_id, list);
    }

    const evidenceByTask = new Map<string, TaskEvidence>();
    for (const row of (evidence ?? []) as TaskEvidence[]) {
      evidenceByTask.set(row.task_id, row);
    }

    return {
      milestones: (milestones ?? []) as Milestone[],
      tasksByMilestone,
      evidenceByTask,
    };
  }
}
