import {
  BadGatewayException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
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
    const frontendUrl = this.configService.get<string>('frontendUrl');

    const { data: inviteData, error: inviteError } =
      await client.auth.admin.inviteUserByEmail(dto.email, {
        data: { full_name: dto.fullName },
        // Sin esto, Supabase usa el Site URL global del proyecto — un solo
        // valor compartido entre local/Railway/AWS. Con FRONTEND_URL
        // seteado por entorno, cada deploy manda el link al dominio
        // correcto sin depender de mantener el Site URL sincronizado.
        ...(frontendUrl && {
          redirectTo: `${frontendUrl}/auth/callback`,
        }),
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
    const greeting = partner.full_name ? `Olá, ${partner.full_name}` : 'Olá';

    await this.emailService.send({
      to: [partner.email],
      subject: 'Bem-vindo ao Kaspersky Partner Quest',
      html: `<p>${greeting}!</p>
        <p>Você foi cadastrado no Kaspersky Partner Quest. O programa tem 5 etapas — Descoberta, Capacitação, Engajamento, Prospecção e Conquista — que vão te guiar até a sua primeira venda.</p>
        <p>Verifique seu e-mail: você recebeu (ou vai receber em instantes) um link de acesso separado para entrar na plataforma pela primeira vez.</p>
        ${frontendUrl ? `<p><a href="${frontendUrl}/login">Acessar a plataforma</a></p>` : ''}`,
    });
  }

  /**
   * Reenvía el acceso a un partner ya invitado (inviteUserByEmail devuelve
   * 422 si el email existe). Usa generateLink en vez de signInWithOtp: no
   * pasa por el mailer de Supabase (límite por hora, template en inglés) y
   * el link de tipo magiclink también confirma a un invitado que nunca
   * entró. Igual que la invitación, es un link del flujo implícito — lo
   * completa /auth/callback/finish en el frontend.
   */
  async resendInvite(partnerId: string): Promise<void> {
    const partner = await this.getProfile(partnerId);
    const frontendUrl = this.configService.get<string>('frontendUrl');

    const { data, error } = await this.supabaseService
      .getClient()
      .auth.admin.generateLink({
        type: 'magiclink',
        email: partner.email,
        ...(frontendUrl && {
          options: { redirectTo: `${frontendUrl}/auth/callback` },
        }),
      });

    if (error || !data.properties?.action_link) {
      throw new InternalServerErrorException(
        error?.message ?? 'Não foi possível gerar o link de acesso',
      );
    }

    const greeting = partner.full_name ? `Olá, ${partner.full_name}` : 'Olá';
    const sent = await this.emailService.send({
      to: [partner.email],
      subject: 'Seu acesso ao Kaspersky Partner Quest',
      html: `<p>${greeting}!</p>
        <p>Você foi convidado para o Kaspersky Partner Quest. Use o link abaixo para acessar a plataforma — ele é de uso único e expira em breve.</p>
        <p><a href="${data.properties.action_link}">Acessar a plataforma</a></p>
        ${frontendUrl ? `<p>Se o link expirar, solicite um novo em <a href="${frontendUrl}/login">${frontendUrl}/login</a>.</p>` : ''}`,
    });

    if (!sent) {
      throw new BadGatewayException(
        'Não foi possível enviar o e-mail de acesso',
      );
    }
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
