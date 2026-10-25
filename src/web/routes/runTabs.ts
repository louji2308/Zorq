export interface RunTabReadiness {
  readonly compositions: boolean;
  readonly connections: boolean;
  readonly challenge: boolean;
  readonly blueprint: boolean;
}

export interface RunTabReadinessInput {
  readonly hasCompositions: boolean;
  readonly hasConnections: boolean;
  readonly challengeReady: boolean;
  readonly hasChallengeReport: boolean;
}

/**
 * Keep the run navigation honest: a tab is available only when the state
 * required to render that surface has actually been persisted.
 */
export function getRunTabReadiness(input: RunTabReadinessInput): RunTabReadiness {
  return {
    compositions: input.hasCompositions,
    connections: input.hasConnections,
    challenge: input.challengeReady,
    blueprint: input.hasChallengeReport
  };
}
