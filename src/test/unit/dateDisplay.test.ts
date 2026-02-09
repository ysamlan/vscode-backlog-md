import { describe, it, expect } from 'vitest';
import { parseStoredUtcDate, formatStoredUtcDateForDisplay } from '../../webview/lib/date-display';

describe('parseStoredUtcDate', () => {
  it('parses date-only string', () => {
    const result = parseStoredUtcDate('2026-01-15');
    expect(result).not.toBeNull();
    expect(result!.getUTCFullYear()).toBe(2026);
    expect(result!.getUTCMonth()).toBe(0); // January
    expect(result!.getUTCDate()).toBe(15);
  });

  it('parses date-time string with space separator', () => {
    const result = parseStoredUtcDate('2026-03-20 14:30');
    expect(result).not.toBeNull();
    expect(result!.getUTCFullYear()).toBe(2026);
    expect(result!.getUTCMonth()).toBe(2); // March
    expect(result!.getUTCDate()).toBe(20);
    expect(result!.getUTCHours()).toBe(14);
    expect(result!.getUTCMinutes()).toBe(30);
  });

  it('parses date-time string with T separator', () => {
    const result = parseStoredUtcDate('2026-06-01T09:00');
    expect(result).not.toBeNull();
    expect(result!.getUTCHours()).toBe(9);
    expect(result!.getUTCMinutes()).toBe(0);
  });

  it('returns null for empty string', () => {
    expect(parseStoredUtcDate('')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(parseStoredUtcDate('not-a-date')).toBeNull();
  });

  it('returns null for invalid date values (e.g. month 13)', () => {
    expect(parseStoredUtcDate('2026-13-01')).toBeNull();
  });

  it('returns null for invalid date values (e.g. Feb 30)', () => {
    expect(parseStoredUtcDate('2026-02-30')).toBeNull();
  });

  it('handles whitespace trimming', () => {
    const result = parseStoredUtcDate('  2026-01-15  ');
    expect(result).not.toBeNull();
    expect(result!.getUTCDate()).toBe(15);
  });
});

describe('formatStoredUtcDateForDisplay', () => {
  it('formats a date-only string to locale date', () => {
    const result = formatStoredUtcDateForDisplay('2026-01-15');
    // The exact format depends on locale, but it should not be the raw string
    expect(result).toBeTruthy();
    expect(result).not.toBe('');
    // Should contain the year somewhere
    expect(result).toContain('2026');
  });

  it('formats a date-time string to locale date and time', () => {
    const result = formatStoredUtcDateForDisplay('2026-03-20 14:30');
    expect(result).toBeTruthy();
    expect(result).toContain('2026');
  });

  it('returns the original string for invalid input', () => {
    expect(formatStoredUtcDateForDisplay('invalid-date')).toBe('invalid-date');
  });

  it('returns the original string for empty input', () => {
    expect(formatStoredUtcDateForDisplay('')).toBe('');
  });
});
