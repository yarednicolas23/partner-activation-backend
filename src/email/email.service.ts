import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Reemplaza el envío anterior por AWS SES (sandbox, exigía verificar a mano
 * cada destinatario de prueba — ver historial de git). Resend no tiene ese
 * modo sandbox: solo requiere el dominio del remitente verificado (SPF/DKIM)
 * una vez. Igual que antes, un fallo de envío nunca debe romper el flujo que
 * lo dispara — todos los llamadores lo tratan como fire-and-forget.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Resend(
      this.configService.getOrThrow<string>('resend.apiKey'),
    );
    this.fromEmail = this.configService.getOrThrow<string>('resend.fromEmail');
  }

  async send(params: {
    to: string[];
    subject: string;
    html: string;
  }): Promise<boolean> {
    if (params.to.length === 0) {
      return false;
    }

    const { error } = await this.client.emails.send({
      // Nombre visible temporal hasta que Kaspersky confirme el dominio
      // propio (noreply@kaspersky.com) — el address real sigue siendo el
      // remitente verificado en Resend, esto solo cambia el "From" que ve
      // el destinatario.
      from: `Kaspersky Partner Quest <${this.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar e-mail para ${params.to.join(', ')}: ${error.message}`,
      );
      return false;
    }

    return true;
  }
}
