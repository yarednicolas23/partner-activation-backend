import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  @MinLength(1)
  contentType: string;

  /** Obligatorio en missões 'choice': key de la opción elegida. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionKey?: string;
}
