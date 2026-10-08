import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const EVIDENCE_ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Imagens de rewards enviadas pelo admin (prefixo "rewards/" no mesmo bucket).
export const REWARD_IMAGE_CONTENT_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
export const REWARD_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const HOUR_MS = 60 * 60 * 1000;

/**
 * El SDK toma AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY solos del entorno (cadena
 * default de credenciales) — no se pasan a mano acá. Es lo que permite que el
 * mismo código sirva sin cambios el día que esto corra en App Runner con
 * instance role en vez de access keys (ver infra/terraform/s3.tf).
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new S3Client({
      region: this.configService.getOrThrow<string>('aws.region'),
    });
    this.bucket = this.configService.getOrThrow<string>('aws.s3Bucket');
  }

  async createEvidenceUploadPost(key: string, contentType: string) {
    if (!EVIDENCE_ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido. Aceitos: ${EVIDENCE_ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    return this.createUploadPost(key, contentType, EVIDENCE_MAX_BYTES);
  }

  async createRewardImageUploadPost(key: string, contentType: string) {
    if (!(contentType in REWARD_IMAGE_CONTENT_TYPES)) {
      throw new BadRequestException(
        'Tipo de imagem não permitido. Aceitos: PNG, JPG, WEBP',
      );
    }
    return this.createUploadPost(key, contentType, REWARD_IMAGE_MAX_BYTES);
  }

  private createUploadPost(key: string, contentType: string, maxBytes: number) {
    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
      },
      Expires: 300,
    });
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 300 });
  }

  /**
   * URL assinada para exibir imagens (rewards) em <img>/next/image. A data de
   * assinatura é arredondada para o início da hora e a validade cobre 2h:
   * dentro da mesma hora a URL é idêntica, então navegador e otimizador do
   * Next conseguem cachear a imagem em vez de baixá-la a cada render.
   */
  async getSignedDisplayUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const signingDate = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
    return getSignedUrl(this.client, command, {
      expiresIn: 2 * 60 * 60,
      signingDate,
    });
  }

  /**
   * URL para <img> de un email: dura el máximo que permite SigV4 (7 días),
   * porque el correo se abre mucho después de enviado. Gmail cachea la imagen
   * en su proxy al primer abrir; pasado el plazo, se ve el alt (título).
   */
  async getSignedEmailUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: 7 * 24 * 60 * 60,
    });
  }
}
