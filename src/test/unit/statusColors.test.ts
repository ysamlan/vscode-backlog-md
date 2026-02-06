import { describe, it, expect } from 'vitest';
import {
  statusToClass,
  isKnownStatus,
  customStatusStyle,
  customStatusBarStyle,
  customStatCardStyle,
} from '../../webview/lib/statusColors';

describe('statusColors', () => {
  describe('statusToClass', () => {
    it('converts standard statuses to CSS class suffixes', () => {
      expect(statusToClass('To Do')).toBe('to-do');
      expect(statusToClass('In Progress')).toBe('in-progress');
      expect(statusToClass('Done')).toBe('done');
      expect(statusToClass('Draft')).toBe('draft');
    });

    it('converts custom statuses to safe CSS class names', () => {
      expect(statusToClass('QA Review')).toBe('qa-review');
      expect(statusToClass('Backlog')).toBe('backlog');
      expect(statusToClass('Deployed')).toBe('deployed');
    });

    it('strips non-alphanumeric characters', () => {
      expect(statusToClass("Won't Fix")).toBe('wont-fix');
      expect(statusToClass('Status (Test)')).toBe('status-test');
    });
  });

  describe('isKnownStatus', () => {
    it('recognizes known statuses (case-insensitive)', () => {
      expect(isKnownStatus('To Do')).toBe(true);
      expect(isKnownStatus('to do')).toBe(true);
      expect(isKnownStatus('In Progress')).toBe(true);
      expect(isKnownStatus('Done')).toBe(true);
      expect(isKnownStatus('Draft')).toBe(true);
      expect(isKnownStatus('todo')).toBe(true);
    });

    it('does not recognize custom statuses', () => {
      expect(isKnownStatus('QA Review')).toBe(false);
      expect(isKnownStatus('Backlog')).toBe(false);
      expect(isKnownStatus('Deployed')).toBe(false);
    });
  });

  describe('customStatusStyle', () => {
    it('returns empty string for known statuses', () => {
      expect(customStatusStyle('To Do')).toBe('');
      expect(customStatusStyle('In Progress')).toBe('');
      expect(customStatusStyle('Done')).toBe('');
    });

    it('returns inline style for custom statuses', () => {
      const style = customStatusStyle('QA Review');
      expect(style).toContain('background-color: hsla(');
      expect(style).toContain('color: hsl(');
    });

    it('returns consistent colors for the same status', () => {
      expect(customStatusStyle('Review')).toBe(customStatusStyle('Review'));
    });

    it('returns different colors for different statuses', () => {
      // Not strictly guaranteed but statistically likely for distinct strings
      const a = customStatusStyle('QA');
      const b = customStatusStyle('Deployed');
      expect(a).not.toBe(b);
    });
  });

  describe('customStatusBarStyle', () => {
    it('returns empty string for known statuses', () => {
      expect(customStatusBarStyle('Done')).toBe('');
    });

    it('returns background style for custom statuses', () => {
      const style = customStatusBarStyle('Review');
      expect(style).toContain('background: hsl(');
    });
  });

  describe('customStatCardStyle', () => {
    it('returns empty string for known statuses', () => {
      expect(customStatCardStyle('To Do')).toBe('');
    });

    it('returns border-left style for custom statuses', () => {
      const style = customStatCardStyle('Backlog');
      expect(style).toContain('border-left: 3px solid hsl(');
    });
  });
});
