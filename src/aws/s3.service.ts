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

    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, EVIDENCE_MAX_BYTES],
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
}
