export type RewardType = 'physical' | 'digital' | 'mixed';
export type RedemptionStatus =
  'pending' | 'approved' | 'rejected' | 'fulfilled';

export interface Reward {
  id: string;
  title: string;
  description: string | null;
  type: RewardType;
  milestone_id: string;
  stock: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RewardWithMilestone extends Reward {
  milestone: { id: string; order_index: number; title: string };
}

export interface RewardRedemption {
  id: string;
  reward_id: string;
  partner_id: string;
  status: RedemptionStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  requested_at: string;
}

export interface RedemptionQueueItem extends RewardRedemption {
  reward: Reward;
  partner: { id: string; email: string; full_name: string | null };
}
