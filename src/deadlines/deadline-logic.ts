/**
 * Regras do prazo do programa e das prorrogações — lógica pura, separada do
 * DeadlinesService para testar sem Supabase (ver deadline-logic.spec.ts).
 *
 * A duração do prazo geral e os meses de prorrogação vêm de
 * `program_settings` (editáveis no admin, Timeline); os DEFAULT_* abaixo são
 * só o fallback se a linha não existir. Valores provisórios até a
 * confirmação da Kaspersky: 6 meses e uma única prorrogação de 3 meses.
 */
export const DEFAULT_DURATION_MONTHS = 6;
export const DEFAULT_EXTENSION_MONTHS = 3;
export const MAX_APPROVED_EXTENSIONS = 1;

/**
 * Soma meses sem estourar o fim do mês: 31/08 + 6 meses vira 28/02 (último
 * dia de fevereiro), não 03/03. Mesma regra que o frontend usava.
 */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString();
}

/**
 * Prazo geral a partir do pré-cadastro. Normalmente já vem gravado em
 * `program_deadlines` (snapshot do trigger no pré-cadastro); isto é o
 * fallback para um parceiro sem linha.
 */
export function defaultDeadline(
  registeredAt: string,
  durationMonths: number,
): string {
  return addMonths(registeredAt, durationMonths);
}

/**
 * Data escolhida pelo admin (YYYY-MM-DD) → fim desse dia no horário de
 * Brasília. O Brasil não tem horário de verão desde 2019, então -03:00 é fixo.
 */
export function endOfDayBrasilia(date: string): string {
  return new Date(`${date}T23:59:59.999-03:00`).toISOString();
}

/**
 * Prazo sugerido ao aprovar uma prorrogação: os meses de prorrogação somados
 * ao prazo vencido. Se o parceiro pediu tão tarde que esse novo prazo já
 * passou, conta a partir de hoje. O admin pode ajustar a data antes de aprovar.
 */
export function suggestedExtensionDeadline(
  previousDeadlineAt: string,
  now: number,
  extensionMonths: number,
): string {
  const extended = addMonths(previousDeadlineAt, extensionMonths);
  if (Date.parse(extended) > now) return extended;
  return addMonths(new Date(now).toISOString(), extensionMonths);
}

export interface ExtensionCheckInput {
  now: number;
  deadlineAt: string;
  journeyCompleted: boolean;
  requests: { status: string; previous_deadline_at: string }[];
}

export type ExtensionBlockReason =
  'not_expired' | 'journey_completed' | 'already_requested' | 'limit_reached';

/**
 * O parceiro pode pedir prorrogação quando o prazo venceu, a jornada não foi
 * concluída, ainda não pediu para este prazo (pendente ou recusada) e não
 * esgotou o limite de prorrogações aprovadas. Se o admin ajustar o prazo
 * depois de uma recusa, o novo prazo abre uma nova janela de solicitação.
 */
export function extensionBlockReason(
  input: ExtensionCheckInput,
): ExtensionBlockReason | null {
  const { now, deadlineAt, journeyCompleted, requests } = input;

  if (journeyCompleted) return 'journey_completed';
  if (Date.parse(deadlineAt) > now) return 'not_expired';

  const deadline = Date.parse(deadlineAt);
  if (
    requests.some(
      (r) =>
        r.status === 'pending' ||
        Date.parse(r.previous_deadline_at) === deadline,
    )
  ) {
    return 'already_requested';
  }

  const approved = requests.filter((r) => r.status === 'approved').length;
  if (approved >= MAX_APPROVED_EXTENSIONS) return 'limit_reached';

  return null;
}
