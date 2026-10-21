import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateDeadlineDto {
  /** Data (YYYY-MM-DD); o prazo vale até o fim desse dia em Brasília. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida (AAAA-MM-DD)' })
  deadlineDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
