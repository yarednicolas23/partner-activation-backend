import { IsInt, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsInt()
  @Min(1)
  @Max(60)
  durationMonths: number;

  @IsInt()
  @Min(1)
  @Max(24)
  extensionMonths: number;
}
