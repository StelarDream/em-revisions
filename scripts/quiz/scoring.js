const STORAGE_KEY = 'em_scoring_cfg';
export const DEFAULT_SCORING = { decayRate: 0.5, hintPenalty: 0.25 };

export function loadScoringConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SCORING, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SCORING };
}

export function saveScoringConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// Fill / numeric: (1 - decayRate)^wrongAttempts, minus hintPenalty if hint used
export function calcPoints(wrongAttempts, hintUsed, cfg) {
  const base = Math.pow(1 - cfg.decayRate, wrongAttempts);
  return Math.max(0, hintUsed ? base - cfg.hintPenalty : base);
}

// MCQ: (N_wrong - wrongFlags) / N_wrong  where N_wrong = totalOptions - correctCount
// wrongFlags = total wrong options picked across all retries
export function calcMCQPoints(totalOptions, correctCount, wrongFlags, hintUsed, cfg) {
  const wrongOptions = totalOptions - correctCount;
  const base = wrongOptions > 0 ? Math.max(0, (wrongOptions - wrongFlags) / wrongOptions) : 1;
  return Math.max(0, hintUsed ? base - cfg.hintPenalty : base);
}
