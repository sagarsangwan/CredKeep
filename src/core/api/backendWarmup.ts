let isWarmingUp = false;
let warmUpCompleted = false;

const HEALTH_URL = 'https://credkeep-v2-staging.onrender.com/api/v2/health/';
const TIMEOUT_MS = 12000;

/**
 * Triggers an asynchronous, non-blocking health check ping to wake the Render staging server.
 * - Single-flight: Prevents duplicate concurrent requests.
 * - Non-blocking: Bounded timeout, does not throw or block UI.
 * - No credentials or tokens attached.
 */
export function triggerBackendWarmup(): void {
  if (isWarmingUp || warmUpCompleted) {
    return;
  }

  isWarmingUp = true;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  fetch(HEALTH_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: controller.signal,
  })
    .then((res) => {
      clearTimeout(timer);
      isWarmingUp = false;
      if (res.ok) {
        warmUpCompleted = true;
      }
    })
    .catch(() => {
      clearTimeout(timer);
      isWarmingUp = false;
      // Best-effort warm-up; failures are swallowed silently
    });
}
