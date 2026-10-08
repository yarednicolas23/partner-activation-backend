import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MilestonesService } from '../milestones/milestones.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import {
  redemptionAdminEmail,
  redemptionStatusEmail,
} from '../email/templates';
import { randomUUID } from 'crypto';
import { REWARD_IMAGE_CONTENT_TYPES, S3Service } from '../aws/s3.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import {
  RedemptionQueueItem,
  RedemptionStatus,
  Reward,
  RewardRedemption,
  RewardType,
  RewardWithMilestone,
} from './reward.interfaces';
import {
  PartnerProfile,
  ShippingAddress,
  shippingAddressFromProfile,
} from '../partners/partner-profile.interface';

/**
 * Elegibilidad de rewards por milestone completado (no por puntos/tiers —
 * esa estructura sigue pendiente de definir con Kaspersky, ver CLAUDE.md).
 * Fulfillment físico queda fuera de la plataforma: acá solo se gestiona
 * catálogo, elegibilidad, solicitud y estado de la redención.
 */
@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly milestonesService: MilestonesService,
    private readonly emailService: EmailService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private readonly redemptionSelect = `id, reward_id, partner_id, status, admin_note, reviewed_by, reviewed_at, requested_at, shipping_address,
     reward:rewards(id, title, description, type, milestone_id, stock, image_url, image_key, is_active, created_at, updated_at),
     partner:profiles!reward_redemptions_partner_id_fkey(id, email, full_name, company_name, phone)`;

  async createReward(dto: CreateRewardDto): Promise<Reward> {
    const { data, error } = await this.client
      .from('rewards')
      .insert({
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type ?? 'physical',
        milestone_id: dto.milestoneId,
        stock: dto.stock ?? null,
        // Imagem enviada (image_key) tem prioridade sobre a estática.
        image_url: dto.imageKey ? null : dto.imageUrl || null,
        image_key: dto.imageKey || null,
        is_active: dto.isActive ?? true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Não foi possível criar o reward',
      );
    }
    return this.withImageUrl(data as Reward);
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
    if (dto.imageUrl !== undefined) {
      updates.image_url = dto.imageUrl || null;
      if (dto.imageUrl) updates.image_key = null;
    }
    if (dto.imageKey !== undefined) {
      updates.image_key = dto.imageKey || null;
      if (dto.imageKey) updates.image_url = null;
    }
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
    return this.withImageUrl(data as Reward);
  }

  /**
   * Presigned POST para o admin enviar a imagem de um reward direto ao S3
   * (mesmo bucket privado das evidências, prefixo "rewards/"). A key gerada
   * aqui é a que o admin manda depois em imageKey ao criar/editar.
   */
  async createImageUploadPost(contentType: string) {
    const extension = REWARD_IMAGE_CONTENT_TYPES[contentType];
    const key = `rewards/${randomUUID()}.${extension ?? 'bin'}`;
    const { url, fields } = await this.s3Service.createRewardImageUploadPost(
      key,
      contentType,
    );
    return { url, fields, key };
  }

  /** Troca image_url pela URL assinada quando a imagem está no S3. */
  private async withImageUrl<T extends Reward>(reward: T): Promise<T> {
    if (!reward.image_key) return reward;
    return {
      ...reward,
      image_url: await this.s3Service.getSignedDisplayUrl(reward.image_key),
    };
  }

  /**
   * Exclui um reward sem solicitações. Com solicitações, a exclusão
   * apagaria em cascata o histórico de resgates (e endereços de envio) —
   * nesse caso o admin deve desativar o reward em vez de excluir.
   */
  async deleteReward(id: string): Promise<void> {
    const { count, error: countError } = await this.client
      .from('reward_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('reward_id', id);

    if (countError) {
      throw new InternalServerErrorException(countError.message);
    }
    if (count) {
      throw new ConflictException(
        'Este reward já tem solicitações de resgate — desative-o em vez de excluir',
      );
    }

    const { data, error } = await this.client
      .from('rewards')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data?.length) {
      throw new NotFoundException('Reward não encontrado');
    }
  }

  async listAllRewards(): Promise<Reward[]> {
    const { data, error } = await this.client
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return Promise.all(
      ((data ?? []) as Reward[]).map((r) => this.withImageUrl(r)),
    );
  }

  async listEligibleRewards(partnerId: string): Promise<RewardWithMilestone[]> {
    const completedMilestoneIds =
      await this.milestonesService.getCompletedMilestoneIds(partnerId);

    const catalog = await this.listCatalog();

    return catalog.filter((reward) =>
      completedMilestoneIds.has(reward.milestone_id),
    );
  }

  // Catálogo completo (inclui rewards de etapas ainda não desbloqueadas) —
  // usado pela tela de Recompensas do parceiro, que mostra também os
  // rewards bloqueados com a etapa necessária para desbloquear.
  async listCatalog(): Promise<RewardWithMilestone[]> {
    const { data, error } = await this.client
      .from('rewards')
      .select('*, milestone:milestones(id, order_index, title)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return Promise.all(
      ((data ?? []) as RewardWithMilestone[]).map((r) => this.withImageUrl(r)),
    );
  }

  async requestRedemption(
    partnerId: string,
    rewardId: string,
    addressConfirmed: boolean,
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

    const shippingAddress =
      (reward as Reward).type === 'digital'
        ? null
        : await this.confirmedShippingAddress(partnerId, addressConfirmed);

    const { data, error } = await this.client
      .from('reward_redemptions')
      .insert({
        reward_id: rewardId,
        partner_id: partnerId,
        shipping_address: shippingAddress,
      })
      .select()
      .single();

    let redemption = data as RewardRedemption | null;
    if (error) {
      if (error.code !== '23505') {
        throw new InternalServerErrorException(error.message);
      }
      redemption = await this.reopenRejectedRedemption(
        partnerId,
        rewardId,
        shippingAddress,
      );
    }
    if (!redemption) {
      throw new InternalServerErrorException('Não foi possível solicitar');
    }

    this.notifyAdminsOfRedemption(redemption.id, 'requested').catch((err) =>
      this.logger.error(
        `Falha ao avisar admins da solicitação de resgate: ${(err as Error).message}`,
      ),
    );
    return redemption;
  }

  /**
   * Já existe uma solicitação deste reward (unique reward_id + partner_id).
   * Se foi rejeitada, o parceiro pode pedir de novo: a mesma linha volta a
   * 'pending' como um pedido novo — igual ao reenvio de evidência após uma
   * rejeição. Em qualquer outro status continua sendo duplicada.
   */
  private async reopenRejectedRedemption(
    partnerId: string,
    rewardId: string,
    shippingAddress: ShippingAddress | null,
  ): Promise<RewardRedemption> {
    const { data, error } = await this.client
      .from('reward_redemptions')
      .update({
        status: 'pending',
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        requested_at: new Date().toISOString(),
        shipping_address: shippingAddress,
      })
      .eq('reward_id', rewardId)
      .eq('partner_id', partnerId)
      .eq('status', 'rejected')
      .select()
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new ConflictException('Você já solicitou este reward');
    }
    return data as RewardRedemption;
  }

  /**
   * Rewards físicos/mistos precisam de endereço de entrega completo no
   * perfil e da confirmação explícita do parceiro. O endereço é copiado
   * para a solicitação — editar o perfil depois não altera este envio.
   */
  private async confirmedShippingAddress(
    partnerId: string,
    addressConfirmed: boolean,
  ): Promise<ShippingAddress> {
    const { data: profile, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (error || !profile) {
      throw new NotFoundException('Perfil não encontrado');
    }

    const address = shippingAddressFromProfile(profile as PartnerProfile);
    if (!address) {
      throw new BadRequestException(
        'Cadastre seu endereço de entrega no perfil antes de resgatar',
      );
    }
    if (!addressConfirmed) {
      throw new BadRequestException('Confirme o endereço de entrega');
    }
    return address;
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
      .select(this.redemptionSelect)
      .single();

    if (error || !data) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    const [redemption] = this.mapRedemptionRows([data]);
    this.notifyRedemptionStatusChanged(redemption).catch((error) =>
      this.logger.error(
        `Falha ao notificar mudança de status de resgate: ${(error as Error).message}`,
      ),
    );

    return redemption;
  }

  private async notifyRedemptionStatusChanged(redemption: RedemptionQueueItem) {
    // Solo los estados que el admin puede asignar (ReviewRedemptionDto).
    if (redemption.status === 'pending') return;

    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de status de resgate não enviado',
      );
      return;
    }

    const { subject, html } = redemptionStatusEmail({
      partnerName: redemption.partner.full_name,
      rewardTitle: redemption.reward.title,
      status: redemption.status,
      adminNote: redemption.admin_note,
      ctaUrl: `${frontendUrl}/dashboard/rewards`,
      assetsBaseUrl,
    });
    await this.emailService.send({
      to: [redemption.partner.email],
      subject,
      html,
    });

    // Con la aprobación, logística recibe los datos de envío + la nota.
    if (redemption.status === 'approved') {
      await this.notifyAdminsOfRedemption(redemption.id, 'approved');
    }
  }

  private static readonly REWARD_TYPE_LABEL: Record<RewardType, string> = {
    physical: 'Físico',
    digital: 'Digital',
    mixed: 'Misto',
  };

  /**
   * Aviso a todos los admins: al solicitar (para revisarlo sin tener que
   * entrar al sistema) y al aprobar (datos de envío + nota de aprobación).
   */
  private async notifyAdminsOfRedemption(
    redemptionId: string,
    event: 'requested' | 'approved',
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — aviso de resgate aos admins não enviado',
      );
      return;
    }

    const [{ data: row }, { data: admins }] = await Promise.all([
      this.client
        .from('reward_redemptions')
        .select(this.redemptionSelect)
        .eq('id', redemptionId)
        .single(),
      this.client.from('profiles').select('email').eq('role', 'admin'),
    ]);
    if (!row) return;
    const adminEmails = ((admins ?? []) as { email: string }[]).map(
      (a) => a.email,
    );
    if (adminEmails.length === 0) return;

    const [redemption] = this.mapRedemptionRows([row]);
    const { subject, html } = redemptionAdminEmail({
      event,
      partnerName: redemption.partner.full_name ?? redemption.partner.email,
      companyName: redemption.partner.company_name,
      partnerEmail: redemption.partner.email,
      partnerPhone: redemption.partner.phone,
      rewardTitle: redemption.reward.title,
      rewardTypeLabel: RewardsService.REWARD_TYPE_LABEL[redemption.reward.type],
      shippingAddress: redemption.shipping_address,
      adminNote: redemption.admin_note,
      eventAt: new Date(
        event === 'approved'
          ? (redemption.reviewed_at ?? Date.now())
          : redemption.requested_at,
      ),
      ctaUrl: `${frontendUrl}/admin/rewards`,
      assetsBaseUrl,
    });

    // En serie para no pasar el límite de requests/s de Resend.
    for (const email of adminEmails) {
      await this.emailService.send({ to: [email], subject, html });
    }
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
      shipping_address: row.shipping_address,
      reward: row.reward,
      partner: row.partner,
    }));
  }
}
