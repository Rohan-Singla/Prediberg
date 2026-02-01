/**
 * Interface for AI Judge implementations.
 * Each judge can use different LLM providers (OpenAI, Anthropic, etc.)
 */
export interface IJudge {
  /**
   * Unique identifier for this judge
   */
  readonly id: string;

  /**
   * Judge a market question given the outcomes and evidence
   */
  judge(params: JudgeParams): Promise<JudgeResult>;
}

export interface JudgeParams {
  /** The market question to resolve */
  question: string;

  /** Possible outcomes */
  outcomes: string[];

  /** Evidence gathered from data sources */
  evidence: Evidence[];

  /** Market end time (for context) */
  endTime: Date;
}

export interface Evidence {
  /** Source identifier (e.g., "coingecko", "sports-api") */
  source: string;

  /** Raw data from the source */
  data: unknown;

  /** When this evidence was fetched */
  fetchedAt: Date;

  /** Relevance score (0-1) */
  relevance: number;
}

export interface JudgeResult {
  /** Winning outcome index */
  winningOutcome: number;

  /** Confidence score (0-1) */
  confidence: number;

  /** Reasoning explanation */
  reasoning: string;

  /** Evidence used for the decision */
  evidenceUsed: string[];
}
