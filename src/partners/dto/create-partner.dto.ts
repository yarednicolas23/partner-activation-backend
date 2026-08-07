import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePartnerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  companyName?: string;
}
