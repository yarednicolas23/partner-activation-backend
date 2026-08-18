import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';

/**
 * SES arranca en modo sandbox: remitente y cada destinatario deben estar
 * verificados a mano (ver infra/terraform/ses.tf). Mientras tanto, cualquier
 * envío a una dirección no verificada falla — por eso todos los llamadores
 * tratan esto como fire-and-forget y nunca dejan que un fallo de email rompa
 * la respuesta de la API.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESClient;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new SESClient({
      region: this.configService.getOrThrow<string>('aws.region'),
    });
    this.fromEmail = this.configService.getOrThrow<string>('aws.sesFromEmail');
  }

  async send(params: {
    to: string[];
    subject: string;
    html: string;
  }): Promise<void> {
    if (params.to.length === 0) {
      return;
    }

    try {
      await this.client.send(
        new SendEmailCommand({
          Source: this.fromEmail,
          Destination: { ToAddresses: params.to },
          Message: {
            Subject: { Data: params.subject, Charset: 'UTF-8' },
            Body: { Html: { Data: params.html, Charset: 'UTF-8' } },
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail para ${params.to.join(', ')}: ${(error as Error).message}`,
      );
    }
  }
}
