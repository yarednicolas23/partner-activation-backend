import { IsIn, IsOptional, IsString } from 'class-validator';
import type { RedemptionStatus } from '../reward.interfaces';

export class ReviewRedemptionDto {
  @IsIn(['approved', 'rejected', 'fulfilled'])
  status: RedemptionStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
