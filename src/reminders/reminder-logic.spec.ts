import { evaluateReminder, INACTIVITY_THRESHOLD_MS } from './reminder-logic';
import { TaskWithEvidence } from '../milestones/milestone.interfaces';

const NOW = new Date('2026-08-28T09:00:00Z').getTime();
const EIGHT_DAYS_AGO = new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString();
const SIX_DAYS_AGO = new Date(NOW - 6 * 24 * 60 * 60 * 1000).toISOString();

function task(overrides: Partial<TaskWithEvidence> = {}): TaskWithEvidence {
  return {
    id: 't1',
    milestone_id: 'm1',
    order_index: 1,
    title: 'Tarefa',
    description: null,
    evidence_type: 'file',
    evidence: null,
    ...overrides,
  };
}

describe('evaluateReminder', () => {
  it('does not remind when throttled by a recent reminded_at, even if otherwise due', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: SIX_DAYS_AGO, // dentro de las 7 días de throttle
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [task({ evidence: null })],
    });
    expect(decision.shouldRemind).toBe(false);
  });

  it('is eligible again once the throttle window has fully passed', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: EIGHT_DAYS_AGO, // throttle ya venció
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [task({ evidence: null })],
    });
    expect(decision.shouldRemind).toBe(true);
  });

  it('does not remind a partner with zero pending tasks', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [
        task({
          evidence: {
            id: 'e1',
            task_id: 't1',
            partner_id: 'p1',
            text_value: null,
            file_path: 'x',
            status: 'approved',
            review_note: null,
            reviewed_by: 'admin',
            reviewed_at: EIGHT_DAYS_AGO,
            submitted_at: EIGHT_DAYS_AGO,
          },
        }),
      ],
    });
    expect(decision.shouldRemind).toBe(false);
  });

  it('does not treat "none" evidence_type tasks as pending', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [task({ evidence_type: 'none', evidence: null })],
    });
    expect(decision.shouldRemind).toBe(false);
  });

  it('treats a rejected evidence as pending — the partner still owes a resubmission', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [
        task({
          evidence: {
            id: 'e1',
            task_id: 't1',
            partner_id: 'p1',
            text_value: null,
            file_path: 'x',
            status: 'rejected',
            review_note: 'falta o print',
            reviewed_by: 'admin',
            reviewed_at: EIGHT_DAYS_AGO,
            submitted_at: EIGHT_DAYS_AGO,
          },
        }),
      ],
    });
    expect(decision.pendingCount).toBe(1);
  });

  it('does not remind when the partner has a pending task but was recently active on another task', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [
        task({ id: 't1', evidence: null }), // pendente, nunca enviada
        task({
          id: 't2',
          evidence: {
            id: 'e2',
            task_id: 't2',
            partner_id: 'p1',
            text_value: null,
            file_path: 'x',
            status: 'pending',
            review_note: null,
            reviewed_by: null,
            reviewed_at: null,
            submitted_at: SIX_DAYS_AGO, // atividade recente em outra tarefa
          },
        }),
      ],
    });
    expect(decision.shouldRemind).toBe(false);
  });

  it('falls back to profile creation date as last activity when nothing was ever submitted', () => {
    const remindsWhenOld = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [task({ evidence: null })],
    });
    const doesNotRemindWhenRecent = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: SIX_DAYS_AGO,
      unlockedTasks: [task({ evidence: null })],
    });
    expect(remindsWhenOld.shouldRemind).toBe(true);
    expect(doesNotRemindWhenRecent.shouldRemind).toBe(false);
  });

  it('is due exactly at the 7-day boundary', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: new Date(NOW - INACTIVITY_THRESHOLD_MS).toISOString(),
      unlockedTasks: [task({ evidence: null })],
    });
    expect(decision.shouldRemind).toBe(true);
  });

  it('counts every pending task, not just the first', () => {
    const decision = evaluateReminder({
      now: NOW,
      remindedAt: null,
      createdAt: EIGHT_DAYS_AGO,
      unlockedTasks: [
        task({ id: 't1', evidence: null }),
        task({ id: 't2', evidence: null }),
        task({ id: 't3', evidence_type: 'none', evidence: null }),
      ],
    });
    expect(decision.pendingCount).toBe(2);
  });
});
