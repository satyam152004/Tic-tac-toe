import { logger } from './logger.js';

export type Phase = 'starting' | 'ready' | 'shutting_down';

/**
 * Process lifecycle, separate from HTTP liveness: the HTTP server starts listening immediately (so the platform can
 * detect the port), while `ready` only flips once MongoDB, indexes and seed data are initialised.
 */
export class Lifecycle {
  private phase: Phase = 'starting';
  // Measured from process start, so the first stage includes module loading (which happens before any code of ours runs).
  private readonly t0 = Date.now() - Math.round(process.uptime() * 1000);
  private readonly stages: Record<string, number> = {};
  private lastStage = this.t0;
  private lastError: string | null = null;

  get current(): Phase {
    return this.phase;
  }
  get isReady(): boolean {
    return this.phase === 'ready';
  }
  get isShuttingDown(): boolean {
    return this.phase === 'shutting_down';
  }
  get snapshot() {
    return { phase: this.phase, stagesMs: { ...this.stages }, lastError: this.lastError };
  }

  /** Records how long the stage that just finished took, and logs it. */
  stage(name: string, extra?: Record<string, unknown>): void {
    const now = Date.now();
    this.stages[name] = now - this.lastStage;
    logger.info({ stage: name, ms: this.stages[name], sinceProcessStartMs: now - this.t0, ...extra }, 'startup stage');
    this.lastStage = now;
  }

  setError(message: string | null): void {
    this.lastError = message;
  }

  markReady(): void {
    this.phase = 'ready';
    this.lastError = null;
    logger.info({ totalMs: Date.now() - this.t0 }, 'Application ready');
  }

  markShuttingDown(): void {
    this.phase = 'shutting_down';
  }
}

export const lifecycle = new Lifecycle();
