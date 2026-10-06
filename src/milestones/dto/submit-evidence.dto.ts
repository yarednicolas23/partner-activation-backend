import { IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitEvidenceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  textValue?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  filePath?: string;

  /** Obligatorio en missões 'choice': key de la opción elegida. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionKey?: string;
}
