import {
  computeUnlockedMilestoneIds,
  isMilestoneComplete,
} from './milestone-logic';
import { Milestone, MilestoneTask, TaskEvidence } from './milestone.interfaces';

function milestone(id: string, order_index: number): Milestone {
  return {
    id,
    order_index,
    title: `Milestone ${order_index}`,
    description: null,
  };
}

function task(
  id: string,
  milestoneId: string,
  order_index: number,
  evidence_type: MilestoneTask['evidence_type'] = 'file',
): MilestoneTask {
  return {
    id,
    milestone_id: milestoneId,
    order_index,
    title: id,
    description: null,
    evidence_type,
  };
}

function evidence(
  taskId: string,
  status: TaskEvidence['status'],
  partnerId = 'partner-1',
): TaskEvidence {
  return {
    id: `evidence-${taskId}`,
    task_id: taskId,
    partner_id: partnerId,
    text_value: null,
    file_path: null,
    status,
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_at: new Date().toISOString(),
  };
}

function tasksByMilestoneOf(
  tasks: MilestoneTask[],
): Map<string, MilestoneTask[]> {
  const map = new Map<string, MilestoneTask[]>();
  for (const t of tasks) {
    map.set(t.milestone_id, [...(map.get(t.milestone_id) ?? []), t]);
  }
  return map;
}

function evidenceByTaskOf(rows: TaskEvidence[]): Map<string, TaskEvidence> {
  return new Map(rows.map((row) => [row.task_id, row]));
}

describe('isMilestoneComplete', () => {
  it('is false when there are no required tasks (all evidence_type "none")', () => {
    const tasks = [task('t1', 'm1', 1, 'none')];
    expect(
      isMilestoneComplete(
        'm1',
        tasksByMilestoneOf(tasks),
        evidenceByTaskOf([]),
      ),
    ).toBe(false);
  });

  it('is false when a required task has no evidence yet', () => {
    const tasks = [task('t1', 'm1', 1, 'file')];
    expect(
      isMilestoneComplete(
        'm1',
        tasksByMilestoneOf(tasks),
        evidenceByTaskOf([]),
      ),
    ).toBe(false);
  });

  it('is false when a required task is pending or rejected, not approved', () => {
    const tasks = [task('t1', 'm1', 1, 'file')];
    const pending = evidenceByTaskOf([evidence('t1', 'pending')]);
    const rejected = evidenceByTaskOf([evidence('t1', 'rejected')]);
    expect(isMilestoneComplete('m1', tasksByMilestoneOf(tasks), pending)).toBe(
      false,
    );
    expect(isMilestoneComplete('m1', tasksByMilestoneOf(tasks), rejected)).toBe(
      false,
    );
  });

  it('is true only when every required task is approved', () => {
    const tasks = [task('t1', 'm1', 1, 'file'), task('t2', 'm1', 2, 'text')];
    const oneApproved = evidenceByTaskOf([
      evidence('t1', 'approved'),
      evidence('t2', 'pending'),
    ]);
    const bothApproved = evidenceByTaskOf([
      evidence('t1', 'approved'),
      evidence('t2', 'approved'),
    ]);
    expect(
      isMilestoneComplete('m1', tasksByMilestoneOf(tasks), oneApproved),
    ).toBe(false);
    expect(
      isMilestoneComplete('m1', tasksByMilestoneOf(tasks), bothApproved),
    ).toBe(true);
  });

  it('ignores "none" tasks when deciding completion — only required tasks count', () => {
    const tasks = [task('t1', 'm1', 1, 'file'), task('auto', 'm1', 2, 'none')];
    const onlyRequiredApproved = evidenceByTaskOf([evidence('t1', 'approved')]);
    expect(
      isMilestoneComplete(
        'm1',
        tasksByMilestoneOf(tasks),
        onlyRequiredApproved,
      ),
    ).toBe(true);
  });
});

describe('computeUnlockedMilestoneIds', () => {
  it('always unlocks the first milestone, even with zero evidence', () => {
    const milestones = [milestone('m1', 1), milestone('m2', 2)];
    const tasks = [task('t1', 'm1', 1, 'file')];
    const unlocked = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestoneOf(tasks),
      new Map(),
    );
    expect(unlocked.has('m1')).toBe(true);
    // m1 tiene una tarea requerida sin evidencia todavía — m2 sigue bloqueado.
    expect(unlocked.has('m2')).toBe(false);
  });

  it('a milestone with zero tasks defined unlocks the next one vacuously (documented edge case)', () => {
    // Distinto del caso "solo tareas none": acá el milestone no tiene NINGUNA
    // tarea registrada. El mismo .every([]) === true de computeUnlockedMilestoneIds
    // aplica — no hay forma de distinguir "sin tareas" de "todas aprobadas".
    const milestones = [milestone('m1', 1), milestone('m2', 2)];
    const unlocked = computeUnlockedMilestoneIds(
      milestones,
      new Map(),
      new Map(),
    );
    expect(unlocked.has('m2')).toBe(true);
  });

  it('unlocks milestone 2 once every required task of milestone 1 is approved', () => {
    const milestones = [milestone('m1', 1), milestone('m2', 2)];
    const tasks = [task('t1', 'm1', 1, 'file')];
    const approved = evidenceByTaskOf([evidence('t1', 'approved')]);

    const unlocked = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestoneOf(tasks),
      approved,
    );
    expect(unlocked.has('m2')).toBe(true);
  });

  it('keeps milestone 2 locked while milestone 1 has an unapproved required task', () => {
    const milestones = [milestone('m1', 1), milestone('m2', 2)];
    const tasks = [task('t1', 'm1', 1, 'file')];
    const pending = evidenceByTaskOf([evidence('t1', 'pending')]);

    const unlocked = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestoneOf(tasks),
      pending,
    );
    expect(unlocked.has('m2')).toBe(false);
  });

  it('a milestone with only "none" tasks unlocks the next one vacuously (documented edge case)', () => {
    // No hay milestones así en la seed data real, pero si los hubiera: el
    // desbloqueo trata "sin tareas requeridas" como aprobado (.every de []
    // es true), aunque isMilestoneComplete jamás lo marque como completo.
    const milestones = [milestone('m1', 1), milestone('m2', 2)];
    const tasks = [task('auto', 'm1', 1, 'none')];

    const unlocked = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestoneOf(tasks),
      new Map(),
    );
    expect(unlocked.has('m2')).toBe(true);
    expect(
      isMilestoneComplete('m1', tasksByMilestoneOf(tasks), new Map()),
    ).toBe(false);
  });

  it('breaks the chain: milestone 3 stays locked even if its own tasks are approved, when milestone 2 is not', () => {
    const milestones = [
      milestone('m1', 1),
      milestone('m2', 2),
      milestone('m3', 3),
    ];
    const tasks = [
      task('t1', 'm1', 1, 'file'),
      task('t2', 'm2', 1, 'file'),
      task('t3', 'm3', 1, 'file'),
    ];
    // m1 aprobado, m2 pendiente, m3 "aprobado" (no debería importar).
    const mixed = evidenceByTaskOf([
      evidence('t1', 'approved'),
      evidence('t2', 'pending'),
      evidence('t3', 'approved'),
    ]);

    const unlocked = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestoneOf(tasks),
      mixed,
    );
    expect(unlocked.has('m1')).toBe(true);
    // m1 está aprobado, así que m2 sí se desbloquea — es el siguiente paso.
    expect(unlocked.has('m2')).toBe(true);
    // pero m2 en sí sigue pendiente, así que m3 se queda bloqueado aunque su
    // propia evidencia ya esté aprobada — el orden importa, no solo el estado.
    expect(unlocked.has('m3')).toBe(false);
  });

  it('unlocks every milestone when all previous ones are fully approved', () => {
    const milestones = [
      milestone('m1', 1),
      milestone('m2', 2),
      milestone('m3', 3),
    ];
    const tasks = [
      task('t1', 'm1', 1, 'file'),
      task('t2', 'm2', 1, 'file'),
      task('t3', 'm3', 1, 'file'),
    ];
    const allApproved = evidenceByTaskOf([
      evidence('t1', 'approved'),
      evidence('t2', 'approved'),
      evidence('t3', 'approved'),
    ]);

    const unlocked = computeUnlockedMilestoneIds(
      milestones,
      tasksByMilestoneOf(tasks),
      allApproved,
    );
    expect(unlocked.has('m1')).toBe(true);
    expect(unlocked.has('m2')).toBe(true);
    expect(unlocked.has('m3')).toBe(true);
  });
});
