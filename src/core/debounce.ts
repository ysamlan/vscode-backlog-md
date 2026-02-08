/**
 * Creates a debounced handler that delays invoking the callback
 * until after `delay` milliseconds have elapsed since the last invocation.
 * Uses the most recent argument when the debounced call fires.
 */
export function createDebouncedHandler<T>(
  handler: (arg: T) => void,
  delay: number
): (arg: T) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (arg: T) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      handler(arg);
    }, delay);
  };
}
