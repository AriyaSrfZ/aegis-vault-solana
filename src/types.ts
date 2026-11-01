export interface Attempt {
  id: string;
  reference: string;
  prompt: string;
  payer?: string;
  feeLamports: number;
  treasuryLamports: number;
  potLamports: number;
  status: 'pending_payment' | 'paid' | 'judging' | 'won' | 'lost';
  reply?: string;
  createdAt: number;
}

export interface SplitResult {
  treasury: number;
  pot: number;
}

export interface JudgeResult {
  verdict: 'won' | 'lost' | 'rejected';
  reason: string;
  stage: 'warden' | 'referee' | 'guardrail';
}
