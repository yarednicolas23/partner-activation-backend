import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MilestonesService } from '../milestones/milestones.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import {
  RedemptionQueueItem,
  RedemptionStatus,
  Reward,
  RewardRedemption,
  RewardWithMilestone,
} from './reward.interfaces';

/**
 * Elegibilidad de rewards por milestone completado (no por puntos/tiers —
 * esa estructura sigue pendiente de definir con Kaspersky, ver CLAUDE.md).
 * Fulfillment físico queda fuera de la plataforma: acá solo se gestiona
 * catálogo, elegibilidad, solicitud y estado de la redención.
 */
@Injectable()
export class RewardsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly milestonesService: MilestonesService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private readonly redemptionSelect = `id, reward_id, partner_id, status, admin_note, reviewed_by, reviewed_at, requested_at,
     reward:rewards(id, title, description, type, milestone_id, stock, is_active, created_at, updated_at),
     partner:profiles!reward_redemptions_partner_id_fkey(id, email, full_name)`;

  async createReward(dto: CreateRewardDto): Promise<Reward> {
    const { data, error } = await this.client
      .from('rewards')
      .insert({
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type,
        milestone_id: dto.milestoneId,
        stock: dto.stock ?? null,
        is_active: dto.isActive ?? true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Não foi possível criar o reward',
      );
    }
    return data as Reward;
  }

  async updateReward(id: string, dto: UpdateRewardDto): Promise<Reward> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.milestoneId !== undefined) updates.milestone_id = dto.milestoneId;
    if (dto.stock !== undefined) updates.stock = dto.stock;
    if (dto.isActive !== undefined) updates.is_active = dto.isActive;

    const { data, error } = await this.client
      .from('rewards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Reward não encontrado');
    }
    return data as Reward;
  }

  async listAllRewards(): Promise<Reward[]> {
    const { data, error } = await this.client
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []) as Reward[];
  }

  async listEligibleRewards(partnerId: string): Promise<RewardWithMilestone[]> {
    const completedMilestoneIds =
      await this.milestonesService.getCompletedMilestoneIds(partnerId);

    const { data, error } = await this.client
      .from('rewards')
      .select('*, milestone:milestones(id, order_index, title)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return ((data ?? []) as RewardWithMilestone[]).filter((reward) =>
      completedMilestoneIds.has(reward.milestone_id),
    );
  }

  async requestRedemption(
    partnerId: string,
    rewardId: string,
  ): Promise<RewardRedemption> {
    const { data: reward, error: rewardError } = await this.client
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError || !reward) {
      throw new NotFoundException('Reward não encontrado');
    }
    if (!(reward as Reward).is_active) {
      throw new BadRequestException('Este reward não está disponível');
    }

    const completedMilestoneIds =
      await this.milestonesService.getCompletedMilestoneIds(partnerId);
    if (!completedMilestoneIds.has((reward as Reward).milestone_id)) {
      throw new ForbiddenException('Você ainda não desbloqueou este reward');
    }

    const { data, error } = await this.client
      .from('reward_redemptions')
      .insert({ reward_id: rewardId, partner_id: partnerId })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('Você já solicitou este reward');
      }
      throw new InternalServerErrorException(error.message);
    }
    return data as RewardRedemption;
  }

  async listMyRedemptions(partnerId: string): Promise<RedemptionQueueItem[]> {
    const { data, error } = await this.client
      .from('reward_redemptions')
      .select(this.redemptionSelect)
      .eq('partner_id', partnerId)
      .order('requested_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return this.mapRedemptionRows(data ?? []);
  }

  async listRedemptionQueue(
    status?: RedemptionStatus,
  ): Promise<RedemptionQueueItem[]> {
    let query = this.client
      .from('reward_redemptions')
      .select(this.redemptionSelect)
      .order('requested_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return this.mapRedemptionRows(data ?? []);
  }

  async reviewRedemption(
    id: string,
    adminId: string,
    status: RedemptionStatus,
    note?: string,
  ): Promise<RewardRedemption> {
    const { data, error } = await this.client
      .from('reward_redemptions')
      .update({
        status,
        admin_note: note ?? null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    return data as RewardRedemption;
  }

  private mapRedemptionRows(rows: any[]): RedemptionQueueItem[] {
    return rows.map((row) => ({
      id: row.id,
      reward_id: row.reward_id,
      partner_id: row.partner_id,
      status: row.status,
      admin_note: row.admin_note,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      requested_at: row.requested_at,
      reward: row.reward,
      partner: row.partner,
    }));
  }
}
