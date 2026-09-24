/**
 * Pure policy helpers for multi-frame check-in.
 *
 * A frame may be discarded by quality/recognition, but attendance is only
 * eligible when the same claimed identity is confirmed by the configured
 * minimum number of frames. Liveness is summarized separately after that
 * identity gate.
 */

export interface IdentityFrame<T> {
  frame: T;
  similarity: number;
}

export interface LivenessFrameResult {
  passed: boolean;
  confidence: number;
  reason?: string;
}

export function selectConsistentIdentityFrames<T>(
  results: IdentityFrame<T>[],
  matchThreshold: number,
  minimumRequired: number
): IdentityFrame<T>[] | null {
  if (!Number.isFinite(matchThreshold) || matchThreshold < 0 || matchThreshold > 1) {
    throw new Error("matchThreshold harus berada pada rentang [0, 1].");
  }
  if (!Number.isInteger(minimumRequired) || minimumRequired < 1) {
    throw new Error("minimumRequired harus berupa bilangan bulat positif.");
  }

  const consistent = results.filter(
    (result) => Number.isFinite(result.similarity) && result.similarity >= matchThreshold
  );
  return consistent.length >= minimumRequired ? consistent : null;
}

export function summarizeLiveness(
  results: LivenessFrameResult[],
  minimumRequired: number
): LivenessFrameResult {
  if (!Number.isInteger(minimumRequired) || minimumRequired < 1) {
    throw new Error("minimumRequired harus berupa bilangan bulat positif.");
  }

  const passed = results.filter(
    (result) => result.passed && Number.isFinite(result.confidence) && result.confidence >= 0
  );
  const isPassed = passed.length >= minimumRequired;

  return {
    passed: isPassed,
    // Report the weakest passing frame so an aggregate score cannot hide a
    // very weak frame behind a high average.
    confidence: isPassed ? Math.min(...passed.map((result) => result.confidence)) : 0,
    reason: isPassed ? undefined : results.find((result) => result.reason)?.reason ?? "SPOOF_SUSPECTED",
  };
}
