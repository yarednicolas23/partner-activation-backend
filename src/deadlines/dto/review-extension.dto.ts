import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { ExtensionStatus } from '../deadline.interfaces';

export class ReviewExtensionDto {
  @IsIn(['approved', 'rejected'])
  status: Exclude<ExtensionStatus, 'pending'>;

  /** Só na aprovação; se omitida, usa o prazo sugerido (+3 meses). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida (AAAA-MM-DD)' })
  deadlineDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
