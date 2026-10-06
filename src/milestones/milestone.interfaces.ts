export type EvidenceType =
  'none' | 'text' | 'email' | 'url' | 'file' | 'choice';
/** Tipo concreto de comprovação que el parceiro envía (una opción de 'choice' nunca es 'none'/'choice'). */
export type EvidenceInputType = 'text' | 'email' | 'url' | 'file';

/** Opción de una missão 'choice' (ej. canal de divulgação, ação de demanda). */
export interface EvidenceOption {
  key: string;
  label: string;
  evidence_type: EvidenceInputType;
  evidence_label: string;
}
export type EvidenceStatus = 'pending' | 'approved' | 'rejected';

export interface Milestone {
  id: string;
  order_index: number;
  title: string;
  description: string | null;
}

export interface MilestoneTask {
  id: string;
  milestone_id: string;
  order_index: number;
  title: string;
  description: string | null;
  evidence_type: EvidenceType;
  /** Texto de "Comprovação exigida". */
  evidence_label: string | null;
  /** Solo para evidence_type = 'choice'. */
  evidence_options: EvidenceOption[] | null;
}

export interface TaskEvidence {
  id: string;
  task_id: string;
  partner_id: string;
  text_value: string | null;
  file_path: string | null;
  /** Opción elegida en una missão 'choice'. */
  option_key: string | null;
  status: EvidenceStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

export interface TaskWithEvidence extends MilestoneTask {
  evidence: TaskEvidence | null;
}

export interface MilestoneView {
  id: string;
  order_index: number;
  locked: boolean;
  title?: string;
  description?: string;
  tasks?: TaskWithEvidence[];
}

export interface EvidenceQueueItem extends TaskEvidence {
  task: MilestoneTask;
  milestone: Milestone;
  partner: { id: string; email: string; full_name: string | null };
}
