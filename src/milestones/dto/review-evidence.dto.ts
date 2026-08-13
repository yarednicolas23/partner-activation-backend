import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewEvidenceDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  note?: string;
}
