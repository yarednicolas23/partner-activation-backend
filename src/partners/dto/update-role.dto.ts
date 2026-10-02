import { IsIn } from 'class-validator';
import type { PartnerProfile } from '../partner-profile.interface';

export class UpdateRoleDto {
  @IsIn(['admin', 'partner'])
  role: PartnerProfile['role'];
}
