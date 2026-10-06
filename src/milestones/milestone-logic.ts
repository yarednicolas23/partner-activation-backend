import {
  EvidenceInputType,
  Milestone,
  MilestoneTask,
  TaskEvidence,
} from './milestone.interfaces';

/**
 * Lógica pura de desbloqueo/finalización de milestones — separada de
 * MilestonesService para poder testearla sin mockear Supabase. Ver
 * milestone-logic.spec.ts.
 */

export function isMilestoneComplete(
  milestoneId: string,
  tasksByMilestone: Map<string, MilestoneTask[]>,
  evidenceByTask: Map<string, TaskEvidence>,
): boolean {
  const requiredTasks = (tasksByMilestone.get(milestoneId) ?? []).filter(
    (t) => t.evidence_type !== 'none',
  );
  return (
    requiredTasks.length > 0 &&
    requiredTasks.every((t) => evidenceByTask.get(t.id)?.status === 'approved')
  );
}

/**
 * Desbloqueo secuencial (brief §4: cada milestone depende de que el
 * anterior esté completo). Un milestone sin tareas que requieran evidencia
 * (todas 'none') se considera "aprobado" para efectos de desbloqueo — el
 * `.every()` sobre una lista vacía es true — aunque `isMilestoneComplete`
 * nunca lo marque como completo (exige al menos 1 tarea requerida). No hay
 * milestones así en la seed data actual; si se agrega uno, desbloquearía al
 * siguiente pero no aparecería como "concluído" en stats/rewards/emails.
 */
export function computeUnlockedMilestoneIds(
  milestones: Milestone[],
  tasksByMilestone: Map<string, MilestoneTask[]>,
  evidenceByTask: Map<string, TaskEvidence>,
): Set<string> {
  const unlocked = new Set<string>();

  for (let i = 0; i < milestones.length; i++) {
    if (i === 0) {
      unlocked.add(milestones[i].id);
      continue;
    }

    const previous = milestones[i - 1];
    const previousTasks = (tasksByMilestone.get(previous.id) ?? []).filter(
      (task) => task.evidence_type !== 'none',
    );
    const previousApproved = previousTasks.every(
      (task) => evidenceByTask.get(task.id)?.status === 'approved',
    );

    if (!previousApproved) {
      break; // secuencial: si N-1 no está completo, N y los siguientes quedan bloqueados
    }
    unlocked.add(milestones[i].id);
  }

  return unlocked;
}

export type ResolvedEvidenceInput =
  | { ok: true; inputType: EvidenceInputType; optionKey: string | null }
  | { ok: false; error: string };

/**
 * Tipo concreto de comprovação que acepta la missão. En missões 'choice' lo
 * define la opción elegida por el parceiro (ej. canal "Social Media" → link,
 * "E-mail Marketing" → arquivo); en las demás, el propio evidence_type.
 */
export function resolveEvidenceInput(
  task: Pick<MilestoneTask, 'evidence_type' | 'evidence_options'>,
  optionKey?: string,
): ResolvedEvidenceInput {
  if (task.evidence_type === 'none') {
    return { ok: false, error: 'Esta missão não exige comprovação' };
  }
  if (task.evidence_type !== 'choice') {
    return { ok: true, inputType: task.evidence_type, optionKey: null };
  }
  if (!optionKey) {
    return { ok: false, error: 'Escolha uma opção antes de enviar' };
  }
  const option = (task.evidence_options ?? []).find((o) => o.key === optionKey);
  if (!option) {
    return { ok: false, error: 'Opção inválida para esta missão' };
  }
  return { ok: true, inputType: option.evidence_type, optionKey: option.key };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mensaje de error para el parceiro, o null si el valor es válido. */
export function validateTextEvidence(
  inputType: Exclude<EvidenceInputType, 'file'>,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Preencha a comprovação antes de enviar';

  if (inputType === 'email' && !EMAIL_PATTERN.test(trimmed)) {
    return 'Digite um e-mail válido.';
  }
  if (inputType === 'url') {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return 'Informe um link válido (https://...).';
      }
    } catch {
      return 'Informe um link válido (https://...).';
    }
  }
  return null;
}
