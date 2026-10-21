export type ExtensionStatus = 'pending' | 'approved' | 'rejected';

export interface ExtensionRequest {
  id: string;
  partner_id: string;
  status: ExtensionStatus;
  reason: string | null;
  previous_deadline_at: string;
  new_deadline_at: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  requested_at: string;
}

/**
 * Origem do prazo de um parceiro: snapshot do prazo geral no pré-cadastro,
 * ajuste manual do admin ou prorrogação aprovada.
 */
export type DeadlineSource = 'program' | 'admin' | 'extension';

/** Fila de `program_deadlines` (uma por parceiro, criada no pré-cadastro). */
export interface ProgramDeadlineRow {
  partner_id: string;
  deadline_at: string;
  source: DeadlineSource;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
}

/** Prazo resolvido de um parceiro, para o painel dele e para o admin. */
export interface ProgramDeadline {
  partner_id: string;
  /** Pré-cadastro (profiles.created_at): início da contagem. */
  started_at: string;
  deadline_at: string;
  source: DeadlineSource;
  note: string | null;
  updated_at: string | null;
  expired: boolean;
  journey_completed: boolean;
  can_request_extension: boolean;
  extension_months: number;
  /** Prazo sugerido para aprovar a solicitação pendente, se houver. */
  suggested_extension_deadline_at: string | null;
  /** Mais recente primeiro. */
  requests: ExtensionRequest[];
}

/** Item da fila de solicitações de prorrogação do admin. */
export interface ExtensionQueueItem extends ExtensionRequest {
  partner: {
    id: string;
    email: string;
    full_name: string | null;
    company_name: string | null;
  };
  /** Prazo pré-preenchido no formulário de aprovação. */
  suggested_deadline_at: string;
}

/** Prazo geral do programa (`program_settings`, linha única). */
export interface ProgramSettings {
  /** Duração do prazo para parceiros convidados a partir de agora. */
  duration_months: number;
  extension_months: number;
  updated_by: string | null;
  updated_at: string | null;
}

/** Linha da tabela de prazos do Timeline (admin). */
export interface TimelineRow {
  partner: {
    id: string;
    email: string;
    full_name: string | null;
    company_name: string | null;
  };
  started_at: string;
  deadline_at: string;
  source: DeadlineSource;
  expired: boolean;
  completed_stages: number;
  total_stages: number;
  pending_request_id: string | null;
}
