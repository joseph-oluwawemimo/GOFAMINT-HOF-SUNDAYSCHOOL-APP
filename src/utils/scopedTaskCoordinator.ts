/**
 * Serializes scope-changing tasks so two authoritative hydrations never replace
 * the same local stores concurrently. Repeated requests for the same scope join
 * the existing promise instead of pretending that hydration already succeeded.
 */
export class ScopedTaskCoordinator<T> {
  private tail: Promise<void> = Promise.resolve();
  private readonly pendingByScope = new Map<string, Promise<T>>();

  run(scopeKey: string, task: () => Promise<T>): Promise<T> {
    const existing = this.pendingByScope.get(scopeKey);
    if (existing) return existing;

    const scheduled = this.tail
      .catch(() => undefined)
      .then(task);

    this.pendingByScope.set(scopeKey, scheduled);
    this.tail = scheduled.then(() => undefined, () => undefined);

    const cleanup = () => {
      if (this.pendingByScope.get(scopeKey) === scheduled) {
        this.pendingByScope.delete(scopeKey);
      }
    };
    void scheduled.then(cleanup, cleanup);

    return scheduled;
  }

  hasPending(scopeKey: string): boolean {
    return this.pendingByScope.has(scopeKey);
  }
}
