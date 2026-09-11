import {
  computeAdminStats,
  EvidenceRow,
  MilestoneRow,
  PartnerRow,
  TaskRow,
  weekLabel,
} from './stats-logic';

function partner(id: string, created_at: string): PartnerRow {
  return { id, created_at };
}

function milestone(id: string, order_index: number, title = id): MilestoneRow {
  return { id, order_index, title };
}

function task(
  id: string,
  milestone_id: string,
  evidence_type = 'file',
): TaskRow {
  return { id, milestone_id, evidence_type };
}

function evidence(
  partner_id: string,
  task_id: string,
  status: string,
  reviewed_at: string | null = null,
): EvidenceRow {
  return { partner_id, task_id, status, reviewed_at };
}

describe('weekLabel', () => {
  it('always returns the Monday of the week, regardless of weekday', () => {
    // 2026-08-24 es lunes; 2026-08-27 jueves y 2026-08-30 domingo caen en
    // la misma semana ISO — las tres deben mapear al mismo lunes.
    expect(weekLabel('2026-08-24T10:00:00Z')).toBe('2026-08-24');
    expect(weekLabel('2026-08-27T23:59:00Z')).toBe('2026-08-24');
    expect(weekLabel('2026-08-30T00:00:01Z')).toBe('2026-08-24');
  });

  it('does not push a Sunday into the following week', () => {
    // Con getUTCDay() domingo=0 — sin el ajuste (day+6)%7 esto rompería.
    expect(weekLabel('2026-08-30T12:00:00Z')).toBe('2026-08-24');
  });
});

describe('computeAdminStats', () => {
  it('returns all-zero/null stats with no partners, without dividing by zero', () => {
    const stats = computeAdminStats([], [milestone('m1', 1)], [], []);
    expect(stats.totalPartners).toBe(0);
    expect(stats.activationRate).toBe(0);
    expect(stats.avgMilestoneCompletionRate).toBe(0);
    expect(stats.avgTimeToFirstSaleDays).toBeNull();
    expect(stats.partnersCompletedProgram).toBe(0);
  });

  it('counts a partner as activated once they have at least one evidence row, regardless of status', () => {
    const partners = [
      partner('p1', '2026-08-01T00:00:00Z'),
      partner('p2', '2026-08-01T00:00:00Z'),
    ];
    const milestones = [milestone('m1', 1)];
    const tasks = [task('t1', 'm1')];
    // p1 tiene evidencia (aunque rechazada) — cuenta como activado; p2 no tiene nada.
    const evidenceRows = [evidence('p1', 't1', 'rejected')];

    const stats = computeAdminStats(partners, milestones, tasks, evidenceRows);
    expect(stats.activatedPartners).toBe(1);
    expect(stats.activationRate).toBe(0.5);
  });

  it('averages per-partner milestone completion ratio across all partners', () => {
    const partners = [
      partner('p1', '2026-08-01T00:00:00Z'),
      partner('p2', '2026-08-01T00:00:00Z'),
    ];
    const milestones = [milestone('m1', 1), milestone('m2', 2)];
    const tasks = [task('t1', 'm1'), task('t2', 'm2')];
    // p1 completó m1 (1/2 = 0.5), p2 no completó nada (0/2 = 0).
    const evidenceRows = [evidence('p1', 't1', 'approved')];

    const stats = computeAdminStats(partners, milestones, tasks, evidenceRows);
    expect(stats.avgMilestoneCompletionRate).toBe(0.25); // (0.5 + 0) / 2
  });

  it('buckets each partner under the first milestone they have not yet completed', () => {
    const partners = [
      partner('p1', '2026-08-01T00:00:00Z'), // parado en m1
      partner('p2', '2026-08-01T00:00:00Z'), // completó m1, parado en m2
      partner('p3', '2026-08-01T00:00:00Z'), // completó todo — no cuenta en ningún balde
    ];
    const milestones = [
      milestone('m1', 1, 'Discover'),
      milestone('m2', 2, 'Enablement'),
    ];
    const tasks = [task('t1', 'm1'), task('t2', 'm2')];
    const evidenceRows = [
      evidence('p2', 't1', 'approved'),
      evidence('p3', 't1', 'approved'),
      evidence('p3', 't2', 'approved'),
    ];

    const stats = computeAdminStats(partners, milestones, tasks, evidenceRows);
    expect(stats.partnersByMilestone).toEqual([
      { milestoneId: 'm1', orderIndex: 1, title: 'Discover', partnerCount: 1 },
      {
        milestoneId: 'm2',
        orderIndex: 2,
        title: 'Enablement',
        partnerCount: 1,
      },
    ]);
  });

  it('ignores "none" tasks when deciding whether a milestone counts as completed', () => {
    const partners = [partner('p1', '2026-08-01T00:00:00Z')];
    const milestones = [milestone('m1', 1)];
    const tasks = [task('t1', 'm1', 'file'), task('auto', 'm1', 'none')];
    const evidenceRows = [evidence('p1', 't1', 'approved')];

    const stats = computeAdminStats(partners, milestones, tasks, evidenceRows);
    expect(stats.avgMilestoneCompletionRate).toBe(1);
  });

  it('only counts time-to-first-sale for partners who completed every milestone, using the last milestone task review time', () => {
    const partners = [
      partner('p1', '2026-08-01T00:00:00Z'), // completa todo
      partner('p2', '2026-08-01T00:00:00Z'), // solo completa m1
    ];
    const milestones = [milestone('m1', 1), milestone('m2', 2)];
    const tasks = [task('t1', 'm1'), task('t2', 'm2')];
    const evidenceRows = [
      evidence('p1', 't1', 'approved'),
      evidence('p1', 't2', 'approved', '2026-08-05T00:00:00Z'), // +4 días
      evidence('p2', 't1', 'approved'),
    ];

    const stats = computeAdminStats(partners, milestones, tasks, evidenceRows);
    expect(stats.partnersCompletedProgram).toBe(1);
    expect(stats.avgTimeToFirstSaleDays).toBe(4);
  });

  it('leaves avgTimeToFirstSaleDays null when a partner completed everything but the last milestone task was never reviewed', () => {
    const partners = [partner('p1', '2026-08-01T00:00:00Z')];
    const milestones = [milestone('m1', 1)];
    const tasks = [task('t1', 'm1')];
    // approved pero sin reviewed_at (no debería pasar en la práctica, pero
    // no debe romper el cálculo).
    const evidenceRows = [evidence('p1', 't1', 'approved', null)];

    const stats = computeAdminStats(partners, milestones, tasks, evidenceRows);
    expect(stats.partnersCompletedProgram).toBe(1);
    expect(stats.avgTimeToFirstSaleDays).toBeNull();
  });

  it('buckets partner signups by the Monday of their registration week', () => {
    const partners = [
      partner('p1', '2026-08-24T08:00:00Z'), // lunes
      partner('p2', '2026-08-27T08:00:00Z'), // jueves, misma semana
      partner('p3', '2026-08-31T08:00:00Z'), // lunes siguiente
    ];
    const stats = computeAdminStats(partners, [], [], []);
    expect(stats.partnersRegisteredByWeek).toEqual([
      { week: '2026-08-24', count: 2 },
      { week: '2026-08-31', count: 1 },
    ]);
  });
});
