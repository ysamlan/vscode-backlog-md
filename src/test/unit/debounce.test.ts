import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedHandler } from '../../core/debounce';

describe('createDebouncedHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call handler after the delay', () => {
    const handler = vi.fn();
    const debounced = createDebouncedHandler(handler, 300);

    debounced('a');
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('a');
  });

  it('should coalesce rapid calls into a single invocation', () => {
    const handler = vi.fn();
    const debounced = createDebouncedHandler(handler, 300);

    debounced('a');
    debounced('b');
    debounced('c');

    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should use the most recent argument', () => {
    const handler = vi.fn();
    const debounced = createDebouncedHandler(handler, 300);

    debounced('a');
    debounced('b');
    debounced('c');

    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledWith('c');
  });

  it('should reset the timer on each call', () => {
    const handler = vi.fn();
    const debounced = createDebouncedHandler(handler, 300);

    debounced('a');
    vi.advanceTimersByTime(200);
    expect(handler).not.toHaveBeenCalled();

    debounced('b');
    vi.advanceTimersByTime(200);
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('b');
  });

  it('should allow separate invocations after the delay has elapsed', () => {
    const handler = vi.fn();
    const debounced = createDebouncedHandler(handler, 300);

    debounced('a');
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('a');

    debounced('b');
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith('b');
  });
});
