/** Input for POST /api/analyze — matches server schema */
export interface AnalyzeInput {
  happened: string;
  youDid: string;
  theyDid: string;
  relationship?: string | null;
  context?: string | null;
  tone: 'soft' | 'neutral' | 'firm';
}

export interface Interpretation {
  label: 'most_likely' | 'also_possible' | 'less_likely';
  text: string;
}

export interface DoNothing {
  wait_hours: number;
  why: string;
}

export interface FollowUpOption {
  tone: 'soft' | 'neutral' | 'firm';
  why: string;
  texts: [string, string, string];
}

export interface FollowUp {
  options: [FollowUpOption, FollowUpOption, FollowUpOption];
}

export interface Repair {
  why: string;
  texts: [string, string, string];
}

export interface NextMoves {
  recommended: 'do_nothing' | 'follow_up' | 'repair';
  do_nothing: DoNothing;
  follow_up: FollowUp;
  repair: Repair;
}

/** Result from POST /api/analyze — matches server schema */
export interface AnalyzeResult {
  verdict: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  interpretations: [Interpretation, Interpretation, Interpretation];
  support_points: [string, string, string];
  next_moves: NextMoves;
  safety_note: string;
}

/** Thrown when the free daily limit is reached (402) */
export class LimitError extends Error {
  readonly name = 'LimitError';
  readonly status = 402;

  constructor(message = 'Free limit reached') {
    super(message);
    Object.setPrototypeOf(this, LimitError.prototype);
  }
}

/** Thrown when scenario cooldown applies (429) */
export class CooldownError extends Error {
  readonly name = 'CooldownError';
  readonly status = 429;
  readonly retryAfterHours: number;

  constructor(message = 'You already checked this recently.', retryAfterHours = 6) {
    super(message);
    this.retryAfterHours = retryAfterHours;
    Object.setPrototypeOf(this, CooldownError.prototype);
  }
}
