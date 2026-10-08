export interface PartnerProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: 'partner' | 'admin';
  phone: string | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Endereço de entrega no padrão brasileiro — snapshot gravado em
 * `reward_redemptions.shipping_address` no momento do resgate.
 */
export interface ShippingAddress {
  recipient_name: string | null;
  phone: string | null;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

/**
 * Devolve o endereço do perfil se todos os campos obrigatórios estiverem
 * preenchidos, ou null se estiver incompleto (complemento é opcional).
 */
export function shippingAddressFromProfile(
  profile: PartnerProfile,
): ShippingAddress | null {
  const {
    address_cep: cep,
    address_street: street,
    address_number: number,
    address_neighborhood: neighborhood,
    address_city: city,
    address_state: state,
  } = profile;

  if (!cep || !street || !number || !neighborhood || !city || !state) {
    return null;
  }

  return {
    recipient_name: profile.full_name,
    phone: profile.phone,
    cep,
    street,
    number,
    complement: profile.address_complement,
    neighborhood,
    city,
    state,
  };
}

/**
 * Acessos do parceiro para o histórico do admin (auth.users + profiles).
 * Só guarda o primeiro e o último login, não cada acesso.
 */
export interface PartnerAccess {
  /** Quando a Kaspersky pré-cadastrou o parceiro (profiles.created_at). */
  invited_at: string;
  /** Primeiro login pelo link de acesso (confirmação do e-mail). */
  first_sign_in_at: string | null;
  last_sign_in_at: string | null;
  /** Último lembrete de inatividade enviado (só o último é guardado). */
  reminded_at: string | null;
}
