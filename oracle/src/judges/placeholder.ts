import type { IJudge, JudgeParams, JudgeResult } from './interface.js';

/**
 * Placeholder judge implementation.
 * Replace with actual LLM integration when ready.
 */
export class PlaceholderJudge implements IJudge {
  readonly id = 'placeholder';

  async judge(params: JudgeParams): Promise<JudgeResult> {
    // TODO: Implement actual LLM-based judging
    // This placeholder always returns outcome 0 with low confidence

    console.log(`[PlaceholderJudge] Judging question: ${params.question}`);
    console.log(`[PlaceholderJudge] Outcomes: ${params.outcomes.join(', ')}`);
    console.log(`[PlaceholderJudge] Evidence count: ${params.evidence.length}`);

    return {
      winningOutcome: 0,
      confidence: 0.0,
      reasoning: 'Placeholder judge - not implemented',
      evidenceUsed: [],
    };
  }
}
