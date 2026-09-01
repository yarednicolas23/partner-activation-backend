import { TaskWithEvidence } from '../milestones/milestone.interfaces';

export const INACTIVITY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReminderCheckInput {
  now: number;
  remindedAt: string | null;
  createdAt: string;
  unlockedTasks: TaskWithEvidence[];
}

export interface ReminderDecision {
  shouldRemind: boolean;
  pendingCount: number;
}

/**
 * Lógica pura de decisión del recordatorio de inactividad — separada de
 * RemindersService para poder testearla sin mockear Supabase/cron. Ver
 * reminder-logic.spec.ts.
 */
export function evaluateReminder(input: ReminderCheckInput): ReminderDecision {
  const { now, remindedAt, createdAt, unlockedTasks } = input;

  if (
    remindedAt &&
    now - new Date(remindedAt).getTime() < INACTIVITY_THRESHOLD_MS
  ) {
    return { shouldRemind: false, pendingCount: 0 };
  }

  const pendingTasks = unlockedTasks.filter(
    (t) =>
      t.evidence_type !== 'none' &&
      (!t.evidence || t.evidence.status === 'rejected'),
  );

  if (pendingTasks.length === 0) {
    return { shouldRemind: false, pendingCount: 0 };
  }

  const submittedTimestamps = unlockedTasks
    .map((t) => t.evidence?.submitted_at)
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime());
  const lastActivity =
    submittedTimestamps.length > 0
      ? Math.max(...submittedTimestamps)
      : new Date(createdAt).getTime();

  if (now - lastActivity < INACTIVITY_THRESHOLD_MS) {
    return { shouldRemind: false, pendingCount: 0 };
  }

  return { shouldRemind: true, pendingCount: pendingTasks.length };
}
