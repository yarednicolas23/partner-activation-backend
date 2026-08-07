export interface PartnerProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: 'partner' | 'admin';
  created_at: string;
  updated_at: string;
}
