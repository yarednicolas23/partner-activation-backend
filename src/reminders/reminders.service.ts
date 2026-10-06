import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { MilestonesService } from '../milestones/milestones.service';
import { EmailService } from '../email/email.service';
import { reminderEmail } from '../email/templates';
import { evaluateReminder } from './reminder-logic';

interface PartnerRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  reminded_at: string | null;
}

/**
 * Recordatorio de inactividad (brief §"Comunicaciones"): si un partner con
 * un milestone desbloqueado no envía ninguna evidencia en 7 días, recibe un
 * email — con throttle de 7 días para no repetirlo a diario. La decisión en
 * sí vive en reminder-logic.ts (testeable sin mockear Supabase/cron).
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly milestonesService: MilestonesService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendInactivityReminders() {
    const { data: partners, error } = await this.client
      .from('profiles')
      .select('id, email, full_name, created_at, reminded_at')
      .eq('role', 'partner');

    if (error) {
      this.logger.error(`Falha ao listar partners: ${error.message}`);
      return;
    }

    for (const partner of (partners ?? []) as PartnerRow[]) {
      await this.checkAndRemind(partner).catch((err) =>
        this.logger.error(
          `Falha ao processar lembrete para ${partner.email}: ${(err as Error).message}`,
        ),
      );
    }
  }

  private async checkAndRemind(partner: PartnerRow) {
    const milestones = await this.milestonesService.getPartnerView(partner.id);
    const unlockedTasks = milestones.flatMap((m) => m.tasks ?? []);

    const { shouldRemind, pendingCount } = evaluateReminder({
      now: Date.now(),
      remindedAt: partner.reminded_at,
      createdAt: partner.created_at,
      unlockedTasks,
    });

    if (!shouldRemind) {
      return;
    }

    await this.sendReminder(partner, pendingCount);

    await this.client
      .from('profiles')
      .update({ reminded_at: new Date().toISOString() })
      .eq('id', partner.id);
  }

  private async sendReminder(partner: PartnerRow, pendingCount: number) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const assetsBaseUrl = this.configService.get<string>('emailAssetsUrl');
    if (!frontendUrl || !assetsBaseUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — lembrete de missões não enviado',
      );
      return;
    }

    const { subject, html } = reminderEmail({
      partnerName: partner.full_name,
      pendingCount,
      ctaUrl: `${frontendUrl}/dashboard`,
      assetsBaseUrl,
    });
    await this.emailService.send({ to: [partner.email], subject, html });
  }
}
