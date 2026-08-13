import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
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
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
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

    return profile as PartnerProfile;
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
