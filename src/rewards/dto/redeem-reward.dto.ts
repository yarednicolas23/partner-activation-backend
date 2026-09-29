import { IsBoolean, IsOptional } from 'class-validator';

export class RedeemRewardDto {
  // Obrigatório (true) para rewards físicos/mistos: o parceiro confirma que
  // o endereço do perfil é o endereço de entrega.
  @IsOptional()
  @IsBoolean()
  addressConfirmed?: boolean;
}
