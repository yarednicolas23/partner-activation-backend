import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { S3Service } from '../aws/s3.service';
import {
  EvidenceQueueItem,
  EvidenceStatus,
  Milestone,
  MilestoneTask,
  MilestoneView,
  TaskEvidence,
  TaskWithEvidence,
} from './milestone.interfaces';

/**
 * Desbloqueo secuencial de milestones (brief §4: "each milestone depends on
 * the completion of the previous one"), calculado en el momento a partir de
 * `task_evidence` — sin tabla de estado redundante que se pueda desincronizar.
 */
@Injectable()
export class MilestonesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly s3Service: S3Service,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getPartnerView(partnerId: string): Promise<MilestoneView[]> {
    const { milestones, tasksByMilestone, evidenceByTask } =
      await this.loadMilestoneData(partnerId);
    const unlockedIds = this.computeUnlockedMilestoneIds(
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
    return this.upsertEvidence(task.id, partnerId, {
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

    return this.upsertEvidence(task.id, partnerId, {
      text_value: null,
      file_path: filePath,
    });
  }

  async listEvidenceQueue(
    status?: EvidenceStatus,
  ): Promise<EvidenceQueueItem[]> {
    let query = this.client
      .from('task_evidence')
      .select(
        `id, task_id, partner_id, text_value, file_path, status, review_note, reviewed_by, reviewed_at, submitted_at,
         task:milestone_tasks(id, milestone_id, order_index, title, description, evidence_type, milestone:milestones(id, order_index, title, description)),
         partner:profiles!task_evidence_partner_id_fkey(id, email, full_name)`,
      )
      .order('submitted_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return ((data ?? []) as any[]).map((row) => ({
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

    return data as TaskEvidence;
  }

  // --- helpers ---

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
    const unlockedIds = this.computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestone,
      evidenceByTask,
    );
    if (!unlockedIds.has(milestoneId)) {
      throw new ForbiddenException('Este milestone ainda não foi desbloqueado');
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

  private computeUnlockedMilestoneIds(
    milestones: Milestone[],
    tasksByMilestone: Map<string, MilestoneTask[]>,
    evidenceByTask: Map<string, TaskEvidence>,
  ): Set<string> {
    const unlocked = new Set<string>();

    for (let i = 0; i < milestones.length; i++) {
      if (i === 0) {
        unlocked.add(milestones[i].id);
        continue;
      }

      const previous = milestones[i - 1];
      const previousTasks = (tasksByMilestone.get(previous.id) ?? []).filter(
        (task) => task.evidence_type !== 'none',
      );
      const previousApproved = previousTasks.every(
        (task) => evidenceByTask.get(task.id)?.status === 'approved',
      );

      if (!previousApproved) {
        break; // secuencial: si N-1 no está completo, N y los siguientes quedan bloqueados
      }
      unlocked.add(milestones[i].id);
    }

    return unlocked;
  }
}
