import { IsIn } from 'class-validator';
import { REWARD_IMAGE_CONTENT_TYPES } from '../../aws/s3.service';

export class CreateImageUploadUrlDto {
  @IsIn(Object.keys(REWARD_IMAGE_CONTENT_TYPES), {
    message: 'Tipo de imagem não permitido. Aceitos: PNG, JPG, WEBP',
  })
  contentType: string;
}
