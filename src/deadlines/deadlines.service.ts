import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MilestonesService } from '../milestones/milestones.service';
import {
  DEFAULT_DURATION_MONTHS,
  DEFAULT_EXTENSION_MONTHS,
  defaultDeadline,
  endOfDayBrasilia,
  ExtensionBlockReason,
  extensionBlockReason,
  suggestedExtensionDeadline,
} from './deadline-logic';
import type {
  DeadlineSource,
  ExtensionQueueItem,
  ExtensionRequest,
  ExtensionStatus,
  ProgramDeadline,
  ProgramDeadlineRow,
  ProgramSettings,
  TimelineRow,
} from './deadline.interfaces';
import { RequestExtensionDto } from './dto/request-extension.dto';
import { ReviewExtensionDto } from './dto/review-extension.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const BLOCK_MESSAGE: Record<ExtensionBlockReason, string> = {
  not_expired: 'Seu prazo ainda não venceu',
  journey_completed: 'Você já concluiu a jornada',
  already_requested: 'Você já solicitou a prorrogação deste prazo',
  limit_reached: 'O limite de prorrogações já foi atingido',
};

/**
 * Prazo do programa e solicitações de prorrogação.
 *
 * - Prazo geral (`program_settings`): duração em meses para parceiros
 *   convidados a partir da alteração — não muda prazos já gravados.
 * - Prazo de cada parceiro (`program_deadlines`): gravado por um trigger no
 *   pré-cadastro com o prazo geral vigente; o admin pode ajustá-lo e uma
 *   prorrogação aprovada o substitui.
 * - Quando o prazo vence, o parceiro pode pedir prorrogação; o admin aprova
 *   ou recusa.
 *
 * Regras em deadline-logic.ts; schema em supabase/schema_program_deadlines.sql
 * e schema_program_settings.sql.
 */
@Injectable()
export class DeadlinesService {
  private readonly logger = new Logger(DeadlinesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly milestonesService: MilestonesService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getSettings(): Promise<ProgramSettings> {
    const { data, error } = await this.client
      .from('program_settings')
      .select('duration_months, extension_months, updated_by, updated_at')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (
      data ?? {
        duration_months: DEFAULT_DURATION_MONTHS,
        extension_months: DEFAULT_EXTENSION_MONTHS,
        updated_by: null,
        updated_at: null,
      }
    );
  }

  /** Vale só para parceiros convidados depois desta alteração. */
  async updateSettings(
    actorId: string,
    dto: UpdateSettingsDto,
  ): Promise<ProgramSettings> {
    const { error } = await this.client.from('program_settings').upsert({
      id: true,
      duration_months: dto.durationMonths,
      extension_months: dto.extensionMonths,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(
      `Prazo geral alterado para ${dto.durationMonths} meses (+${dto.extensionMonths} de prorrogação) por ${actorId}`,
    );
    return this.getSettings();
  }

  async getDeadline(partnerId: string): Promise<ProgramDeadline> {
    const [profile, row, requests, journeyCompleted, settings] =
      await Promise.all([
        this.getPartnerCreatedAt(partnerId),
        this.getDeadlineRow(partnerId),
        this.listPartnerRequests(partnerId),
        this.isJourneyCompleted(partnerId),
        this.getSettings(),
      ]);

    const now = Date.now();
    const deadlineAt =
      row?.deadline_at ??
      defaultDeadline(profile.created_at, settings.duration_months);
    const pending = requests.find((r) => r.status === 'pending');

    return {
      partner_id: partnerId,
      started_at: profile.created_at,
      deadline_at: deadlineAt,
      source: row?.source ?? 'program',
      note: row?.note ?? null,
      updated_at: row?.updated_at ?? null,
      expired: Date.parse(deadlineAt) <= now,
      journey_completed: journeyCompleted,
      can_request_extension:
        extensionBlockReason({
          now,
          deadlineAt,
          journeyCompleted,
          requests,
        }) === null,
      extension_months: settings.extension_months,
      suggested_extension_deadline_at: pending
        ? suggestedExtensionDeadline(
            pending.previous_deadline_at,
            now,
            settings.extension_months,
          )
        : null,
      requests,
    };
  }

  /**
   * Versão do parceiro: não expõe qual admin revisou — para ele, a decisão é
   * da equipe Kaspersky.
   */
  async getOwnDeadline(partnerId: string): Promise<ProgramDeadline> {
    const deadline = await this.getDeadline(partnerId);
    return {
      ...deadline,
      requests: deadline.requests.map((r) => ({ ...r, reviewed_by: null })),
    };
  }

  /**
   * Tabela de prazos do Timeline: todos os parceiros com prazo, origem,
   * progresso (etapas concluídas) e solicitação pendente. Progresso em lote,
   * com a mesma regra de isMilestoneComplete (todas as tarefas com evidência
   * exigida aprovadas), para não fazer uma consulta por parceiro.
   */
  async listTimeline(): Promise<TimelineRow[]> {
    const [profiles, rows, pending, milestones, tasks, approved, settings] =
      await Promise.all([
        this.client
          .from('profiles')
          .select('id, email, full_name, company_name, created_at')
          .eq('role', 'partner')
          .order('created_at', { ascending: false }),
        this.client
          .from('program_deadlines')
          .select('partner_id, deadline_at, source'),
        this.client
          .from('deadline_extension_requests')
          .select('id, partner_id')
          .eq('status', 'pending'),
        this.client.from('milestones').select('id'),
        this.client
          .from('milestone_tasks')
          .select('id, milestone_id, evidence_type'),
        this.client
          .from('task_evidence')
          .select('partner_id, task_id')
          .eq('status', 'approved'),
        this.getSettings(),
      ]);

    const error =
      profiles.error ??
      rows.error ??
      pending.error ??
      milestones.error ??
      tasks.error ??
      approved.error;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const partners = (profiles.data ?? []) as (TimelineRow['partner'] & {
      created_at: string;
    })[];
    const deadlineByPartner = new Map(
      (
        (rows.data ?? []) as Pick<
          ProgramDeadlineRow,
          'partner_id' | 'deadline_at' | 'source'
        >[]
      ).map((r) => [r.partner_id, r]),
    );
    const pendingByPartner = new Map(
      (
        (pending.data ?? []) as Pick<ExtensionRequest, 'id' | 'partner_id'>[]
      ).map((r) => [r.partner_id, r.id]),
    );

    const milestoneIds = ((milestones.data ?? []) as { id: string }[]).map(
      (m) => m.id,
    );
    const requiredTasks = new Map<string, string[]>();
    for (const task of (tasks.data ?? []) as {
      id: string;
      milestone_id: string;
      evidence_type: string;
    }[]) {
      if (task.evidence_type === 'none') continue;
      const list = requiredTasks.get(task.milestone_id) ?? [];
      list.push(task.id);
      requiredTasks.set(task.milestone_id, list);
    }
    const approvedKeys = new Set(
      ((approved.data ?? []) as { partner_id: string; task_id: string }[]).map(
        (e) => `${e.partner_id}:${e.task_id}`,
      ),
    );

    const now = Date.now();
    return partners.map(({ created_at, ...partner }) => {
      const row = deadlineByPartner.get(partner.id);
      const deadlineAt =
        row?.deadline_at ??
        defaultDeadline(created_at, settings.duration_months);
      const completedStages = milestoneIds.filter((id) => {
        const required = requiredTasks.get(id) ?? [];
        return (
          required.length > 0 &&
          required.every((taskId) =>
            approvedKeys.has(`${partner.id}:${taskId}`),
          )
        );
      }).length;

      return {
        partner,
        started_at: created_at,
        deadline_at: deadlineAt,
        source: row?.source ?? 'program',
        expired: Date.parse(deadlineAt) <= now,
        completed_stages: completedStages,
        total_stages: milestoneIds.length,
        pending_request_id: pendingByPartner.get(partner.id) ?? null,
      };
    });
  }

  async requestExtension(
    partnerId: string,
    dto: RequestExtensionDto,
  ): Promise<ProgramDeadline> {
    const deadline = await this.getDeadline(partnerId);
    const blocked = extensionBlockReason({
      now: Date.now(),
      deadlineAt: deadline.deadline_at,
      journeyCompleted: deadline.journey_completed,
      requests: deadline.requests,
    });
    if (blocked) {
      throw new BadRequestException(BLOCK_MESSAGE[blocked]);
    }

    const { error } = await this.client
      .from('deadline_extension_requests')
      .insert({
        partner_id: partnerId,
        reason: dto.reason?.trim() || null,
        previous_deadline_at: deadline.deadline_at,
      });

    if (error) {
      // Índice único parcial: já existe uma pendente (requisição duplicada).
      if (error.code === '23505') {
        throw new ConflictException(BLOCK_MESSAGE.already_requested);
      }
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(`Prorrogação solicitada por ${partnerId}`);
    return this.getOwnDeadline(partnerId);
  }

  /** Ajuste manual do prazo pelo admin (para frente ou para trás). */
  async setDeadline(
    actorId: string,
    partnerId: string,
    dto: UpdateDeadlineDto,
  ): Promise<ProgramDeadline> {
    await this.getPartnerCreatedAt(partnerId);
    const deadlineAt = this.parseDeadlineDate(dto.deadlineDate);

    await this.upsertDeadline(
      partnerId,
      deadlineAt,
      'admin',
      actorId,
      dto.note?.trim() || null,
    );
    this.logger.log(
      `Prazo de ${partnerId} alterado para ${deadlineAt} por ${actorId}`,
    );
    return this.getDeadline(partnerId);
  }

  async listRequests(status?: ExtensionStatus): Promise<ExtensionQueueItem[]> {
    let query = this.client
      .from('deadline_extension_requests')
      .select(
        `*, partner:profiles!deadline_extension_requests_partner_id_fkey(id, email, full_name, company_name)`,
      )
      .order('requested_at', { ascending: true });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const now = Date.now();
    const { extension_months } = await this.getSettings();
    return (
      (data ?? []) as unknown as Omit<
        ExtensionQueueItem,
        'suggested_deadline_at'
      >[]
    ).map((r) => ({
      ...r,
      suggested_deadline_at: suggestedExtensionDeadline(
        r.previous_deadline_at,
        now,
        extension_months,
      ),
    }));
  }

  async reviewRequest(
    actorId: string,
    requestId: string,
    dto: ReviewExtensionDto,
  ): Promise<ProgramDeadline> {
    const { data: request, error: fetchError } = await this.client
      .from('deadline_extension_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchError) {
      throw new InternalServerErrorException(fetchError.message);
    }
    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    const current = request as ExtensionRequest;
    if (current.status !== 'pending') {
      throw new ConflictException('Esta solicitação já foi analisada');
    }

    const note = dto.note?.trim() || null;
    const { extension_months } = await this.getSettings();
    const newDeadlineAt =
      dto.status === 'approved'
        ? dto.deadlineDate
          ? this.parseDeadlineDate(dto.deadlineDate)
          : suggestedExtensionDeadline(
              current.previous_deadline_at,
              Date.now(),
              extension_months,
            )
        : null;

    // .eq('status', 'pending'): se dois admins revisarem ao mesmo tempo, só
    // a primeira revisão vale.
    const { data: updated, error } = await this.client
      .from('deadline_extension_requests')
      .update({
        status: dto.status,
        new_deadline_at: newDeadlineAt,
        admin_note: note,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id');

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!updated || updated.length === 0) {
      throw new ConflictException('Esta solicitação já foi analisada');
    }

    if (newDeadlineAt) {
      await this.upsertDeadline(
        current.partner_id,
        newDeadlineAt,
        'extension',
        actorId,
        note ?? 'Prorrogação aprovada',
      );
    }

    this.logger.log(
      `Prorrogação ${requestId} de ${current.partner_id}: ${dto.status} por ${actorId}`,
    );
    return this.getDeadline(current.partner_id);
  }

  /** O novo prazo precisa estar no futuro (data de hoje vale até 23:59). */
  private parseDeadlineDate(date: string): string {
    const deadlineAt = endOfDayBrasilia(date);
    if (Number.isNaN(Date.parse(deadlineAt))) {
      throw new BadRequestException('Data inválida');
    }
    if (Date.parse(deadlineAt) <= Date.now()) {
      throw new BadRequestException('O prazo precisa ser uma data futura');
    }
    return deadlineAt;
  }

  private async upsertDeadline(
    partnerId: string,
    deadlineAt: string,
    source: Exclude<DeadlineSource, 'program'>,
    actorId: string,
    note: string | null,
  ) {
    const { error } = await this.client.from('program_deadlines').upsert({
      partner_id: partnerId,
      deadline_at: deadlineAt,
      source,
      note,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async getPartnerCreatedAt(
    partnerId: string,
  ): Promise<{ created_at: string }> {
    const { data, error } = await this.client
      .from('profiles')
      .select('created_at')
      .eq('id', partnerId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Perfil não encontrado');
    }
    return data;
  }

  private async getDeadlineRow(
    partnerId: string,
  ): Promise<ProgramDeadlineRow | null> {
    const { data, error } = await this.client
      .from('program_deadlines')
      .select('*')
      .eq('partner_id', partnerId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as ProgramDeadlineRow | null;
  }

  private async listPartnerRequests(
    partnerId: string,
  ): Promise<ExtensionRequest[]> {
    const { data, error } = await this.client
      .from('deadline_extension_requests')
      .select('*')
      .eq('partner_id', partnerId)
      .order('requested_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []) as ExtensionRequest[];
  }

  private async isJourneyCompleted(partnerId: string): Promise<boolean> {
    const [milestones, completed] = await Promise.all([
      this.milestonesService.listAllMilestones(),
      this.milestonesService.getCompletedMilestoneIds(partnerId),
    ]);
    return (
      milestones.length > 0 && milestones.every((m) => completed.has(m.id))
    );
  }
}
