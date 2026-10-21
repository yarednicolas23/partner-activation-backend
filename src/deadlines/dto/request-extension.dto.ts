import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestExtensionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
