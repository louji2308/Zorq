import { QlooUpstreamError } from "./errors.js";

export class QlooCallBudget {
  readonly #maxCalls: number;
  #used = 0;

  constructor(maxCalls: number) {
    this.#maxCalls = Math.max(1, Math.floor(maxCalls));
  }

  get used(): number {
    return this.#used;
  }

  get remaining(): number {
    return Math.max(0, this.#maxCalls - this.#used);
  }

  assertAcquire(): void {
    if (this.#used >= this.#maxCalls) {
      throw new QlooUpstreamError(
        "RATE_LIMITED",
        `Qloo call budget exhausted (${this.#maxCalls} upstream attempts)`,
        { retryable: false },
        [{ path: "qloo.budget", message: `budget of ${this.#maxCalls} upstream attempts exhausted after ${this.#used} calls` }]
      );
    }
    this.#used += 1;
  }
}
