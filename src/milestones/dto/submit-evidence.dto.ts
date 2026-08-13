import { IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitEvidenceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  textValue?: string;
}
