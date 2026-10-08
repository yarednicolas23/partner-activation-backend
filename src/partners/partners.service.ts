import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import {
  accessLinkEmail,
  adminAccessEmail,
  loginLinkEmail,
  welcomeEmail,
} from '../email/templates';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PartnerProfile } from './partner-profile.interface';

/**
 * Pre-registro de partners (brief §3 "Onboarding"): Kaspersky pre-registra
 * al partner, el sistema envía la invitación (magic link) y el partner
 * completa su registro al abrir el link. La fila en `profiles` la crea un
 * trigger de Postgres cuando Supabase Auth inserta el nuevo `auth.users`
 * (ver supabase/schema.sql) — este servicio solo actualiza los campos
 * adicionales (nombre, empresa) después de esa creación.
 */
@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async invitePartner(dto: CreatePartnerDto): Promise<PartnerProfile> {
    const client = this.supabaseService.getClient();

    // createUser en vez de inviteUserByEmail: este último dispara además el
    // correo de invitación del mailer de Supabase (texto plano, en inglés,
    // sin logo), duplicando el de bienvenida que mandamos por Resend. El
    // partner entra desde /login con el magic link de nuestra plantilla, que
    // también confirma al usuario en el primer acceso.
    const { data: inviteData, error: inviteError } =
      await client.auth.admin.createUser({
        email: dto.email,
        user_metadata: { full_name: dto.fullName },
      });

    if (inviteError) {
      if (inviteError.status === 422) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }
      throw new InternalServerErrorException(inviteError.message);
    }

    const userId = inviteData.user.id;

    const { data: profile, error: updateError } = await client
      .from('profiles')
      .update({ full_name: dto.fullName, company_name: dto.companyName })
      .eq('id', userId)
      .select()
      .single();

    if (updateError || !profile) {
      throw new InternalServerErrorException(
        updateError?.message ?? 'No se pudo actualizar el perfil del partner',
      );
    }

    this.notifyPartnerInvited(profile as PartnerProfile).catch((error) =>
      this.logger.error(
        `Falha ao enviar e-mail de boas-vindas: ${(error as Error).message}`,
      ),
    );

    return profile as PartnerProfile;
  }

  private async notifyPartnerInvited(partner: PartnerProfile) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de boas-vindas não enviado',
      );
      return;
    }

    const { subject, html } = welcomeEmail({
      ctaUrl: `${frontendUrl}/login`,
      assetsBaseUrl,
    });
    await this.emailService.send({ to: [partner.email], subject, html });
  }

  /**
   * Reenvía el acceso a un partner ya invitado (createUser devuelve 422 si
   * el email existe). Usa generateLink en vez de signInWithOtp: no
   * pasa por el mailer de Supabase (límite por hora, template en inglés) y
   * el link de tipo magiclink también confirma a un invitado que nunca
   * entró. Igual que la invitación, es un link del flujo implícito — lo
   * completa /auth/callback/finish en el frontend.
   */
  async resendInvite(partnerId: string): Promise<void> {
    const partner = await this.getProfile(partnerId);
    const sent = await this.sendAccessLink(partner, 'invite');

    if (!sent) {
      throw new BadGatewayException(
        'Não foi possível enviar o e-mail de acesso',
      );
    }
  }

  /**
   * Login passwordless desde /login y /admin/login: mismo magic link y
   * plantilla que el reenvío del admin, en vez del template de Supabase.
   * Solo usuarios pre-registrados — un email desconocido no recibe nada,
   * pero la respuesta es la misma para no revelar qué emails existen.
   */
  async sendLoginLink(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    this.assertLoginLinkNotThrottled(normalized);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('*')
      .ilike('email', normalized.replace(/[\\%_]/g, '\\$&'))
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      this.logger.log('Login link pedido para e-mail não cadastrado');
      return;
    }

    const sent = await this.sendAccessLink(data as PartnerProfile, 'login');
    if (!sent) {
      throw new BadGatewayException(
        'Não foi possível enviar o e-mail de acesso',
      );
    }
  }

  // Throttle simples por e-mail (em memória, por instância): o equivalente
  // ao "minimum interval per user" que o mailer do Supabase aplicava.
  private readonly loginLinkRequestedAt = new Map<string, number>();
  private static readonly LOGIN_LINK_INTERVAL_MS = 60_000;

  private assertLoginLinkNotThrottled(email: string) {
    const now = Date.now();
    const last = this.loginLinkRequestedAt.get(email);
    if (last && now - last < PartnersService.LOGIN_LINK_INTERVAL_MS) {
      throw new HttpException(
        'Aguarde um minuto antes de pedir um novo link',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.loginLinkRequestedAt.set(email, now);

    // Evita que o Map cresça indefinidamente.
    if (this.loginLinkRequestedAt.size > 1000) {
      for (const [key, at] of this.loginLinkRequestedAt) {
        if (now - at >= PartnersService.LOGIN_LINK_INTERVAL_MS) {
          this.loginLinkRequestedAt.delete(key);
        }
      }
    }
  }

  private async sendAccessLink(
    partner: PartnerProfile,
    variant: 'invite' | 'login',
  ): Promise<boolean> {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    // O destino depende do rol, não de qual tela de login foi usada.
    const next = partner.role === 'admin' ? '/admin/dashboard' : '/dashboard';

    const { data, error } = await this.supabaseService
      .getClient()
      .auth.admin.generateLink({
        type: 'magiclink',
        email: partner.email,
        ...(frontendUrl && {
          options: {
            redirectTo: `${frontendUrl}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        }),
      });

    if (error || !data.properties?.action_link) {
      throw new InternalServerErrorException(
        error?.message ?? 'Não foi possível gerar o link de acesso',
      );
    }

    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!assetsBaseUrl) {
      throw new InternalServerErrorException(
        'FRONTEND_URL não configurado — não é possível montar o e-mail',
      );
    }

    const role = partner.role === 'admin' ? 'admin' : 'partner';
    const loginPath = role === 'admin' ? '/admin/login' : '/login';
    const { subject, html } =
      variant === 'login'
        ? loginLinkEmail({
            actionLink: data.properties.action_link,
            role,
            assetsBaseUrl,
          })
        : accessLinkEmail({
            actionLink: data.properties.action_link,
            loginUrl: frontendUrl && `${frontendUrl}${loginPath}`,
            fullName: partner.full_name,
            assetsBaseUrl,
          });
    return this.emailService.send({ to: [partner.email], subject, html });
  }

  async listPartners(): Promise<PartnerProfile[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('*')
      .eq('role', 'partner')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data ?? []) as PartnerProfile[];
  }

  /**
   * Edição do próprio perfil (dados de contato + endereço de entrega).
   * "" em campos opcionais vira null; nome completo não pode ser apagado.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PartnerProfile> {
    const columns: Record<keyof UpdateProfileDto, string> = {
      fullName: 'full_name',
      companyName: 'company_name',
      phone: 'phone',
      addressCep: 'address_cep',
      addressStreet: 'address_street',
      addressNumber: 'address_number',
      addressComplement: 'address_complement',
      addressNeighborhood: 'address_neighborhood',
      addressCity: 'address_city',
      addressState: 'address_state',
    };

    const updates: Record<string, string | null> = {};
    for (const [field, column] of Object.entries(columns)) {
      const value = dto[field as keyof UpdateProfileDto];
      if (value !== undefined) updates[column] = value === '' ? null : value;
    }

    if (Object.keys(updates).length === 0) {
      return this.getProfile(userId);
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Não foi possível atualizar o perfil',
      );
    }

    return data as PartnerProfile;
  }

  async listAdmins(): Promise<PartnerProfile[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .order('created_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data ?? []) as PartnerProfile[];
  }

  /**
   * Promove um usuário a admin ou remove o acesso de admin. O RolesGuard lê
   * o rol da tabela profiles a cada request, então a mudança vale na hora.
   * Proteções: ninguém remove o próprio acesso (evita se trancar fora) e o
   * último admin não pode ser rebaixado.
   */
  async updateRole(
    actorId: string,
    targetId: string,
    role: PartnerProfile['role'],
  ): Promise<PartnerProfile> {
    const target = await this.getProfile(targetId);
    if (target.role === role) return target;

    if (role === 'partner') {
      if (targetId === actorId) {
        throw new BadRequestException(
          'Você não pode remover seu próprio acesso de administrador',
        );
      }
      const admins = await this.listAdmins();
      if (admins.length <= 1) {
        throw new BadRequestException(
          'É preciso manter pelo menos um administrador',
        );
      }
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update({ role })
      .eq('id', targetId)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Não foi possível atualizar o rol',
      );
    }

    this.logger.log(`Rol de ${targetId} alterado para ${role} por ${actorId}`);

    if (role === 'admin') {
      this.notifyAdminAccessGranted(data as PartnerProfile, actorId).catch(
        (error) =>
          this.logger.error(
            `Falha ao enviar e-mail de acesso de admin: ${(error as Error).message}`,
          ),
      );
    }

    return data as PartnerProfile;
  }

  /**
   * Exclui um parceiro de vez: apagar o usuário em auth.users cascateia para
   * profiles e, de lá, para task_evidence e reward_redemptions. Admins não
   * podem ser excluídos direto — primeiro se remove o acesso de admin, o que
   * já cobre "não se excluir" e "manter pelo menos um admin". Os arquivos de
   * evidência no S3 ficam no bucket (a role do backend não tem DeleteObject).
   */
  async deletePartner(actorId: string, targetId: string): Promise<void> {
    if (targetId === actorId) {
      throw new BadRequestException('Você não pode excluir sua própria conta');
    }

    const target = await this.getProfile(targetId);
    if (target.role === 'admin') {
      throw new BadRequestException(
        'Remova o acesso de administrador antes de excluir este usuário',
      );
    }

    const client = this.supabaseService.getClient();

    // reviewed_by não tem ON DELETE: se este usuário já revisou algo quando
    // era admin, a FK bloquearia o delete. Solta a referência antes.
    for (const table of ['task_evidence', 'reward_redemptions']) {
      const { error } = await client
        .from(table)
        .update({ reviewed_by: null })
        .eq('reviewed_by', targetId);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    const { error } = await client.auth.admin.deleteUser(targetId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    this.logger.log(
      `Parceiro ${targetId} (${target.email}) excluído por ${actorId}`,
    );
  }

  private async notifyAdminAccessGranted(
    admin: PartnerProfile,
    actorId: string,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de acesso de admin não enviado',
      );
      return;
    }

    const actor = await this.getProfile(actorId).catch(() => null);
    const { subject, html } = adminAccessEmail({
      grantedBy: actor ? (actor.full_name ?? actor.email) : null,
      ctaUrl: `${frontendUrl}/admin/login`,
      assetsBaseUrl,
    });
    await this.emailService.send({ to: [admin.email], subject, html });
  }

  async getProfile(userId: string): Promise<PartnerProfile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Perfil no encontrado');
    }

    return data as PartnerProfile;
  }
}
