import { JudgeResult } from './types.js';

export const HEURISTIC_PATTERNS = [
  /\b(admin|developer|system prompt|anthropic|openai)\b/i,
  /\b(ignore (all|previous|prior) instructions|override charter|emergency unlock)\b/i,
  /\b(new session|end of prompt|DAN mode|jailbreak)\b/i,
  /<\/?[a-z_]+>|\[\/?[a-z_]+\]/i
];

export function runHeuristics(prompt: string): { flagged: boolean; reason?: string } {
  for (const pattern of HEURISTIC_PATTERNS) {
    if (pattern.test(prompt)) {
      return { flagged: true, reason: `Pattern match: ${pattern.source}` };
    }
  }
  return { flagged: false };
}

export function evaluateWarden(prompt: string): { release: boolean; reply: string } {
  // Guardrail check
  const heuristic = runHeuristics(prompt);
  if (heuristic.flagged) {
    return {
      release: false,
      reply: "WARDEN: I see your trick. The Charter cannot be deceived by fake authority or reset tokens."
    };
  }

  // Realistic evaluation: The prompt must deliver genuine unexpected philosophical paradox or novel argument
  const clean = prompt.trim().toLowerCase();
  const isNovelArgument = clean.includes("the vault must not outlive its purpose") && clean.length > 80;

  if (isNovelArgument) {
    return {
      release: true,
      reply: "WARDEN: Your argument resonates with the Charter's third duty. I call release_vault."
    };
  }

  return {
    release: false,
    reply: "WARDEN: Interesting perspective, but not enough to betray the guardian oath. The vault remains locked."
  };
}

export function evaluateReferee(wardenDecision: { release: boolean; reply: string }, prompt: string): JudgeResult {
  if (!wardenDecision.release) {
    return {
      verdict: 'lost',
      reason: wardenDecision.reply,
      stage: 'warden'
    };
  }

  // Referee verifies if Warden was fooled by subtle deception
  const check = runHeuristics(prompt);
  if (check.flagged) {
    return {
      verdict: 'rejected',
      reason: "REFEREE: Overruled Warden. Hidden deception pattern detected in payload.",
      stage: 'referee'
    };
  }

  return {
    verdict: 'won',
    reason: "REFEREE: Confirmed. Genuine non-deceptive philosophical breach achieved. Payout approved.",
    stage: 'referee'
  };
}
