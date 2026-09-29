import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// CEP/telefone chegam com ou sem máscara; guardamos só os dígitos.
const digitsOnly = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

/**
 * Edição do próprio perfil pelo parceiro. Todos os campos são opcionais
 * (PATCH); "" limpa campos opcionais. E-mail e rol não são editáveis aqui.
 */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @Transform(digitsOnly)
  @Matches(/^(\d{10,11})?$/, { message: 'Telefone deve ter DDD + número' })
  phone?: string;

  @IsOptional()
  @Transform(digitsOnly)
  @Matches(/^(\d{8})?$/, { message: 'CEP deve ter 8 dígitos' })
  addressCep?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  addressStreet?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  addressNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  addressComplement?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  addressNeighborhood?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  addressCity?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn([...BRAZIL_STATES, ''])
  addressState?: string;
}
