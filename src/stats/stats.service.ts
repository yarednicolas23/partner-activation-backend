import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminStats } from './stats.interfaces';
import { computeAdminStats } from './stats-logic';

/**
 * KPIs priorizados para MVP (CLAUDE.md §"Objetivo del programa"): tasa de
 * activación, tasa de finalización de milestones, tiempo a la primera venta.
 * Calculados en el momento a partir de las tablas existentes — sin tabla de
 * agregación separada, mismo criterio que el resto del motor de milestones.
 * El cálculo en sí vive en stats-logic.ts (testeable sin mockear Supabase).
 */
@Injectable()
export class StatsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getAdminStats(): Promise<AdminStats> {
    const [
      { data: partners, error: partnersError },
      { data: milestones, error: milestonesError },
      { data: tasks, error: tasksError },
      { data: evidence, error: evidenceError },
    ] = await Promise.all([
      this.client
        .from('profiles')
        .select('id, created_at')
        .eq('role', 'partner'),
      this.client
        .from('milestones')
        .select('id, order_index')
        .order('order_index'),
      this.client
        .from('milestone_tasks')
        .select('id, milestone_id, evidence_type'),
      this.client
        .from('task_evidence')
        .select('partner_id, task_id, status, reviewed_at'),
    ]);

    if (partnersError || milestonesError || tasksError || evidenceError) {
      throw new InternalServerErrorException(
        partnersError?.message ??
          milestonesError?.message ??
          tasksError?.message ??
          evidenceError?.message,
      );
    }

    return computeAdminStats(
      partners ?? [],
      milestones ?? [],
      tasks ?? [],
      evidence ?? [],
    );
  }
}
