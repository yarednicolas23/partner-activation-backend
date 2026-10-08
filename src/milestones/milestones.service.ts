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
  evidenceApprovedEmail,
  evidenceReceivedEmail,
  evidenceRejectedEmail,
  evidenceReviewEmail,
  programCompletedAdminEmail,
  programCompletedEmail,
  stageCompletedAdminEmail,
  stageCompletedEmail,
} from '../email/templates';
import {
  EvidenceQueueItem,
  EvidenceStatus,
  Milestone,
  MilestoneTask,
  MilestoneView,
  StageHistory,
  TaskEvidence,
  TaskWithEvidence,
} from './milestone.interfaces';
import {
  buildStageHistory,
  computeUnlockedMilestoneIds,
  isMilestoneComplete,
  resolveEvidenceInput,
  validateTextEvidence,
} from './milestone-logic';

/**
 * Desbloqueo secuencial de milestones (brief §4: "each milestone depends on
 * the completion of the previous one"), calculado en el momento a partir de
 * `task_evidence` — sin tabla de estado redundante que se pueda desincronizar.
 */
type EvidenceValues = {
  text_value: string | null;
  file_path: string | null;
  option_key: string | null;
};

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
        // Regra confirmada "Opção A" (documento de conteúdo das telas, ISOURCE):
        // etapas bloqueadas exibem apenas "Etapa X de 5" — sem nome, descrição
        // nem missões. Reemplaza el AJUSTE 04 anterior, que mostraba el título.
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
    optionKey?: string,
  ): Promise<TaskEvidence> {
    const task = await this.getTaskOrThrow(taskId);
    const input = resolveEvidenceInput(task, optionKey);
    if (!input.ok) {
      throw new BadRequestException(input.error);
    }
    if (input.inputType === 'file') {
      throw new BadRequestException('Esta missão exige o envio de um arquivo');
    }
    const invalid = validateTextEvidence(input.inputType, textValue);
    if (invalid) {
      throw new BadRequestException(invalid);
    }
    await this.assertMilestoneUnlocked(partnerId, task.milestone_id);
    await this.assertEvidenceNotApproved(taskId, partnerId);
    return this.finalizeEvidenceSubmission(partnerId, task, {
      text_value: textValue.trim(),
      file_path: null,
      option_key: input.optionKey,
    });
  }

  async createFileUploadPost(
    partnerId: string,
    taskId: string,
    contentType: string,
    optionKey?: string,
  ) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertAcceptsFile(task, optionKey);
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
    optionKey?: string,
  ): Promise<TaskEvidence> {
    const task = await this.getTaskOrThrow(taskId);
    const resolvedOptionKey = this.assertAcceptsFile(task, optionKey);
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
      option_key: resolvedOptionKey,
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

  async getPartnerStageHistory(partnerId: string): Promise<StageHistory[]> {
    const { milestones, tasksByMilestone, evidenceByTask } =
      await this.loadMilestoneData(partnerId);
    return buildStageHistory(milestones, tasksByMilestone, evidenceByTask);
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

    // Solo en la transición a "approved" — evita reenviar los mails si algo
    // ya aprobado se re-guarda.
    if (status === 'approved' && existing?.status !== 'approved') {
      this.handleEvidenceApproved(evidence).catch((error) =>
        this.logger.error(
          `Falha ao notificar evidência aprovada: ${(error as Error).message}`,
        ),
      );
    }

    if (status === 'rejected' && existing?.status !== 'rejected') {
      this.notifyEvidenceRejected(evidence).catch((error) =>
        this.logger.error(
          `Falha ao notificar evidência não aprovada: ${(error as Error).message}`,
        ),
      );
    }

    return evidence;
  }

  // --- helpers ---

  /** Devuelve la option_key a guardar (null fuera de missões 'choice'). */
  private assertAcceptsFile(
    task: MilestoneTask,
    optionKey?: string,
  ): string | null {
    const input = resolveEvidenceInput(task, optionKey);
    if (!input.ok) {
      throw new BadRequestException(input.error);
    }
    if (input.inputType !== 'file') {
      throw new BadRequestException('Esta missão não aceita upload de arquivo');
    }
    return input.optionKey;
  }

  private readonly evidenceQueueSelect = `id, task_id, partner_id, text_value, file_path, option_key, status, review_note, reviewed_by, reviewed_at, submitted_at,
     task:milestone_tasks(id, milestone_id, order_index, title, description, evidence_type, evidence_label, evidence_options, milestone:milestones(id, order_index, title, description)),
     partner:profiles!task_evidence_partner_id_fkey(id, email, full_name)`;

  private mapEvidenceQueueRows(rows: any[]): EvidenceQueueItem[] {
    return rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      partner_id: row.partner_id,
      text_value: row.text_value,
      file_path: row.file_path,
      option_key: row.option_key,
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
    values: EvidenceValues,
  ): Promise<TaskEvidence> {
    const evidence = await this.upsertEvidence(task.id, partnerId, values);
    this.notifyEvidenceSubmitted(partnerId, task, evidence).catch((error) =>
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
        .select('email, full_name, company_name')
        .eq('id', partnerId)
        .single(),
      this.client.from('profiles').select('email').eq('role', 'admin'),
    ]);

    return {
      partnerEmail: partner?.email ?? null,
      partnerName: partner?.full_name ?? null,
      partnerCompany: partner?.company_name ?? null,
      adminEmails: ((admins ?? []) as { email: string }[]).map((a) => a.email),
    };
  }

  /**
   * Un envío por admin en vez de un solo mensaje con todos en `to`: Resend
   * rechaza el mensaje entero si una sola dirección falla (p. ej. remitente
   * de pruebas onboarding@resend.dev, que solo entrega al dueño de la
   * cuenta), y así además ningún admin ve las direcciones de los otros.
   */
  private async sendToAdmins(
    adminEmails: string[],
    subject: string,
    html: string,
  ) {
    // En serie, no en paralelo, para no pasar el límite de requests/s de
    // Resend cuando hay varios admins.
    for (const email of adminEmails) {
      await this.emailService.send({ to: [email], subject, html });
    }
  }

  private async notifyEvidenceSubmitted(
    partnerId: string,
    task: MilestoneTask,
    evidence: TaskEvidence,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mails de evidência enviada não enviados',
      );
      return;
    }

    const [
      { partnerEmail, partnerName, partnerCompany, adminEmails },
      { data: milestone },
    ] = await Promise.all([
      this.getNotificationRecipients(partnerId),
      this.client
        .from('milestones')
        .select('title')
        .eq('id', task.milestone_id)
        .single(),
    ]);

    if (partnerEmail) {
      const { subject, html } = evidenceReceivedEmail({
        missionTitle: task.title,
        ctaUrl: `${frontendUrl}/dashboard`,
        assetsBaseUrl,
      });
      await this.emailService.send({ to: [partnerEmail], subject, html });
    }

    if (adminEmails.length > 0) {
      const name = partnerName ?? partnerEmail ?? 'Parceiro';
      const { subject, html } = evidenceReviewEmail({
        partnerLabel: partnerCompany ? `${name} (${partnerCompany})` : name,
        milestoneTitle: milestone?.title ?? '—',
        missionTitle: task.title,
        submittedAt: new Date(evidence.submitted_at),
        ctaUrl: `${frontendUrl}/admin/evidence`,
        assetsBaseUrl,
      });
      await this.sendToAdmins(adminEmails, subject, html);
    }
  }

  private async notifyEvidenceApproved(evidence: TaskEvidence) {
    const [{ partnerEmail, partnerName }, task] = await Promise.all([
      this.getNotificationRecipients(evidence.partner_id),
      this.getTaskOrThrow(evidence.task_id),
    ]);
    if (!partnerEmail) return;

    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de comprovação aprovada não enviado',
      );
      return;
    }

    const { subject, html } = evidenceApprovedEmail({
      partnerName,
      missionTitle: task.title,
      ctaUrl: `${frontendUrl}/dashboard`,
      assetsBaseUrl,
    });
    await this.emailService.send({ to: [partnerEmail], subject, html });
  }

  private async notifyEvidenceRejected(evidence: TaskEvidence) {
    const [{ partnerEmail, partnerName }, task] = await Promise.all([
      this.getNotificationRecipients(evidence.partner_id),
      this.getTaskOrThrow(evidence.task_id),
    ]);
    if (!partnerEmail) return;

    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de comprovação não aprovada não enviado',
      );
      return;
    }

    // La nota la escribe el admin en texto libre: la plantilla la escapa.
    const { subject, html } = evidenceRejectedEmail({
      partnerName,
      missionTitle: task.title,
      reviewNote: evidence.review_note,
      ctaUrl: `${frontendUrl}/dashboard`,
      assetsBaseUrl,
    });
    await this.emailService.send({ to: [partnerEmail], subject, html });
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

  /**
   * Si la aprobación completa la etapa, el partner recibe "etapa concluída"
   * (o "jornada completa"); si no, recibe "comprovação aprovada". Nunca los
   * dos por la misma aprobación.
   */
  private async handleEvidenceApproved(evidence: TaskEvidence) {
    const completedStage = await this.checkMilestoneCompletion(
      evidence.partner_id,
      evidence.task_id,
    );
    if (!completedStage) {
      await this.notifyEvidenceApproved(evidence);
    }
  }

  /** Devuelve true si la etapa de la tarea quedó completa (y notificó). */
  private async checkMilestoneCompletion(
    partnerId: string,
    taskId: string,
  ): Promise<boolean> {
    const task = await this.getTaskOrThrow(taskId);
    const { milestones, tasksByMilestone, evidenceByTask } =
      await this.loadMilestoneData(partnerId);
    const milestone = milestones.find((m) => m.id === task.milestone_id);
    if (!milestone) {
      return false;
    }

    if (!isMilestoneComplete(milestone.id, tasksByMilestone, evidenceByTask)) {
      return false;
    }

    const lastOrderIndex = Math.max(...milestones.map((m) => m.order_index));
    const allMilestonesComplete = milestones.every((m) =>
      isMilestoneComplete(m.id, tasksByMilestone, evidenceByTask),
    );
    await this.notifyMilestoneCompleted(
      partnerId,
      milestone,
      milestone.order_index === lastOrderIndex,
      // Al cerrar el programa el partner recibe solo "jornada completa"
      // (notifyProgramCompleted), no además el de "etapa concluída".
      allMilestonesComplete,
    );

    if (allMilestonesComplete) {
      await this.notifyProgramCompleted(partnerId, milestones);
    }
    return true;
  }

  private async notifyMilestoneCompleted(
    partnerId: string,
    milestone: Milestone,
    isLastStage: boolean,
    skipPartnerEmail: boolean,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mails de etapa concluída não enviados',
      );
      return;
    }

    const [
      { partnerEmail, partnerName, partnerCompany, adminEmails },
      { data: rewards },
    ] = await Promise.all([
      this.getNotificationRecipients(partnerId),
      this.client
        .from('rewards')
        .select('title')
        .eq('milestone_id', milestone.id)
        .eq('is_active', true),
    ]);
    // Pendiente con Kaspersky: nombre propio de la conquista por etapa.
    const achievementTitle = `Etapa ${milestone.order_index}: ${milestone.title}`;

    if (partnerEmail && !skipPartnerEmail) {
      const { subject, html } = stageCompletedEmail({
        stageNumber: milestone.order_index,
        stageTitle: milestone.title,
        achievementTitle,
        rewardTitles: ((rewards ?? []) as { title: string }[]).map(
          (r) => r.title,
        ),
        ctaUrl: `${frontendUrl}/dashboard`,
        rewardsUrl: `${frontendUrl}/dashboard/rewards`,
        assetsBaseUrl,
      });
      await this.emailService.send({ to: [partnerEmail], subject, html });
    }

    if (adminEmails.length > 0) {
      const name = partnerName ?? partnerEmail ?? 'Parceiro';
      const { subject, html } = stageCompletedAdminEmail({
        partnerLabel: partnerCompany ? `${name} (${partnerCompany})` : name,
        stageNumber: milestone.order_index,
        stageTitle: milestone.title,
        achievementTitle,
        completedAt: new Date(),
        isLastStage,
        ctaUrl: `${frontendUrl}/admin/partners/${partnerId}`,
        assetsBaseUrl,
      });
      await this.sendToAdmins(adminEmails, subject, html);
    }
  }

  private async notifyProgramCompleted(
    partnerId: string,
    milestones: Milestone[],
  ) {
    // Este email reemplaza al de "etapa concluída" de la última etapa, así que
    // también avisa que su brinde está disponible para resgate.
    const lastMilestone = milestones.reduce((a, b) =>
      b.order_index > a.order_index ? b : a,
    );
    const [
      { partnerEmail, partnerName, partnerCompany, adminEmails },
      { data: rewards },
    ] = await Promise.all([
      this.getNotificationRecipients(partnerId),
      this.client
        .from('rewards')
        .select('title')
        .eq('milestone_id', lastMilestone.id)
        .eq('is_active', true),
    ]);
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');

    if (partnerEmail && frontendUrl && assetsBaseUrl) {
      const { subject, html } = programCompletedEmail({
        partnerName,
        stageCount: milestones.length,
        rewardTitles: ((rewards ?? []) as { title: string }[]).map(
          (r) => r.title,
        ),
        ctaUrl: `${frontendUrl}/dashboard`,
        rewardsUrl: `${frontendUrl}/dashboard/rewards`,
        assetsBaseUrl,
      });
      await this.emailService.send({ to: [partnerEmail], subject, html });
    } else if (partnerEmail) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de programa concluído não enviado',
      );
    }

    if (adminEmails.length > 0 && frontendUrl && assetsBaseUrl) {
      const name = partnerName ?? partnerEmail ?? 'Parceiro';
      const { subject, html } = programCompletedAdminEmail({
        partnerName: name,
        partnerLabel: partnerCompany ? `${name} (${partnerCompany})` : name,
        stageCount: milestones.length,
        completedAt: new Date(),
        ctaUrl: `${frontendUrl}/admin/partners/${partnerId}`,
        assetsBaseUrl,
      });
      await this.sendToAdmins(adminEmails, subject, html);
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
    values: EvidenceValues,
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
