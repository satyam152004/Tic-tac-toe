/** Per-socket token bucket: `rate` events/sec with a burst of `rate`. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  public violations = 0;

  constructor(private readonly rate: number) {
    this.tokens = rate;
  }

  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.rate, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    this.violations++;
    return false;
  }
}
