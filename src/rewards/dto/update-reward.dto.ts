import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import type { RewardType } from '../reward.interfaces';

export class UpdateRewardDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['physical', 'digital', 'mixed'])
  type?: RewardType;

  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  // Ruta pública (/rewards/…) o URL absoluta; "" la quita.
  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Key devolvida por POST /rewards/images/upload-url; "" remove a imagem.
  @IsOptional()
  @IsString()
  @Matches(/^(rewards\/[0-9a-f-]{36}\.(png|jpg|webp))?$/, {
    message: 'imageKey inválido',
  })
  imageKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
