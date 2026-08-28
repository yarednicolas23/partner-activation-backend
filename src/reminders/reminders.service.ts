import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { MilestonesService } from '../milestones/milestones.service';
import { EmailService } from '../email/email.service';

const INACTIVITY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

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
 * email — con throttle de 7 días para no repetirlo a diario.
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
    const now = Date.now();

    if (
      partner.reminded_at &&
      now - new Date(partner.reminded_at).getTime() < INACTIVITY_THRESHOLD_MS
    ) {
      return;
    }

    const milestones = await this.milestonesService.getPartnerView(partner.id);
    const unlockedTasks = milestones.flatMap((m) => m.tasks ?? []);
    const pendingTasks = unlockedTasks.filter(
      (t) =>
        t.evidence_type !== 'none' &&
        (!t.evidence || t.evidence.status === 'rejected'),
    );

    if (pendingTasks.length === 0) {
      return;
    }

    const submittedTimestamps = unlockedTasks
      .map((t) => t.evidence?.submitted_at)
      .filter((v): v is string => Boolean(v))
      .map((v) => new Date(v).getTime());
    const lastActivity =
      submittedTimestamps.length > 0
        ? Math.max(...submittedTimestamps)
        : new Date(partner.created_at).getTime();

    if (now - lastActivity < INACTIVITY_THRESHOLD_MS) {
      return;
    }

    await this.sendReminder(partner, pendingTasks.length);

    await this.client
      .from('profiles')
      .update({ reminded_at: new Date().toISOString() })
      .eq('id', partner.id);
  }

  private async sendReminder(partner: PartnerRow, pendingCount: number) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const greeting = partner.full_name ? `Olá, ${partner.full_name}` : 'Olá';

    await this.emailService.send({
      to: [partner.email],
      subject: 'Você tem missões pendentes no Partner Activation Program',
      html: `<p>${greeting},</p>
        <p>Notamos que você tem ${pendingCount} tarefa${pendingCount > 1 ? 's' : ''} pendente${pendingCount > 1 ? 's' : ''} no seu milestone atual. Continue de onde parou para avançar no programa.</p>
        ${frontendUrl ? `<p><a href="${frontendUrl}/dashboard">Ver minhas missões</a></p>` : ''}`,
    });
  }
}
