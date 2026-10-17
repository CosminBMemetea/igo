/** Serialize UI work while persisting privacy intent immediately, even during a slow request. */
export function createActions(beforeRun: () => Promise<unknown> | null, onBusy: (busy: boolean) => void) {
  let tail: Promise<unknown> = Promise.resolve(), count = 0, generation = 0;
  return {
    busy: () => count > 0,
    async run(task: () => Promise<void>, prepare?: () => Promise<void>) {
      if (!prepare && count > 0) return;
      if (prepare) ++generation;
      const version = generation, previous = tail;
      ++count; onBusy(true);
      // Attach the rejection handler immediately: the earlier request may take seconds.
      const preparation = (async () => { try { await prepare?.(); return null; } catch (error) { return { error }; } })();
      const job = (async () => {
        await previous.catch(() => {});
        const failure = await preparation;
        if (failure) throw failure.error;
        await beforeRun()?.catch(() => {});
        if (!prepare && version !== generation) return;
        await task();
      })();
      tail = job.catch(() => {});
      try { await job; }
      finally { --count; onBusy(count > 0); }
    },
  };
}
