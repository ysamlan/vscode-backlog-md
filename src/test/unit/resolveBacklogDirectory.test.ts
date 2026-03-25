import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  resolveBacklogDirectory,
  normalizeProjectBacklogDirectory,
} from '../../core/resolveBacklogDirectory';

describe('resolveBacklogDirectory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'backlog-dir-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // --- Root config with custom backlog_directory ---

  it('uses root backlog.config.yml with backlog_directory for custom folders', () => {
    mkdirSync(join(testDir, 'planning', 'backlog-data', 'tasks'), { recursive: true });
    writeFileSync(
      join(testDir, 'backlog.config.yml'),
      'project_name: "Test"\nbacklog_directory: "planning/backlog-data"\n'
    );

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('custom');
    expect(res.configSource).toBe('root');
    expect(res.backlogDir).toBe('planning/backlog-data');
    expect(res.configPath).toBe(join(testDir, 'backlog.config.yml'));
  });

  it('resolves custom dir even when dir does not exist yet', () => {
    writeFileSync(
      join(testDir, 'backlog.config.yml'),
      'project_name: "Test"\nbacklog_directory: "planning/backlog-data"\n'
    );

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('custom');
    expect(res.backlogDir).toBe('planning/backlog-data');
    expect(res.backlogPath).toBe(join(testDir, 'planning', 'backlog-data'));
  });

  // --- Root config without backlog_directory ---

  it('falls back to built-in backlog/ when root config has no backlog_directory', () => {
    mkdirSync(join(testDir, 'backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, 'backlog.config.yml'), 'project_name: "Test"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('backlog');
    expect(res.configSource).toBe('root');
    expect(res.backlogDir).toBe('backlog');
    expect(res.configPath).toBe(join(testDir, 'backlog.config.yml'));
  });

  it('falls back to .backlog/ when root config exists but no backlog/ dir', () => {
    mkdirSync(join(testDir, '.backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, 'backlog.config.yml'), 'project_name: "Test"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('.backlog');
    expect(res.configSource).toBe('root');
    expect(res.backlogDir).toBe('.backlog');
  });

  // --- No root config, folder-local config ---

  it('discovers backlog/ with folder-local config.yml', () => {
    mkdirSync(join(testDir, 'backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, 'backlog', 'config.yml'), 'project_name: "Test"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('backlog');
    expect(res.configSource).toBe('folder');
    expect(res.backlogDir).toBe('backlog');
    expect(res.configPath).toBe(join(testDir, 'backlog', 'config.yml'));
  });

  it('discovers .backlog/ with folder-local config.yml', () => {
    mkdirSync(join(testDir, '.backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, '.backlog', 'config.yml'), 'project_name: "Test"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('.backlog');
    expect(res.configSource).toBe('folder');
    expect(res.backlogDir).toBe('.backlog');
    expect(res.configPath).toBe(join(testDir, '.backlog', 'config.yml'));
  });

  it('prefers backlog/ with config over .backlog/ with config', () => {
    mkdirSync(join(testDir, 'backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, 'backlog', 'config.yml'), 'project_name: "A"\n');
    mkdirSync(join(testDir, '.backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, '.backlog', 'config.yml'), 'project_name: "B"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('backlog');
    expect(res.backlogDir).toBe('backlog');
  });

  it('prefers .backlog/ with config over backlog/ without config', () => {
    mkdirSync(join(testDir, 'backlog'), { recursive: true });
    mkdirSync(join(testDir, '.backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, '.backlog', 'config.yml'), 'project_name: "Test"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('.backlog');
    expect(res.backlogDir).toBe('.backlog');
  });

  // --- Directory exists without config ---

  it('discovers backlog/ directory even without config', () => {
    mkdirSync(join(testDir, 'backlog'), { recursive: true });

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('backlog');
    expect(res.configSource).toBeNull();
    expect(res.backlogDir).toBe('backlog');
  });

  it('discovers .backlog/ directory even without config', () => {
    mkdirSync(join(testDir, '.backlog'), { recursive: true });

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('.backlog');
    expect(res.configSource).toBeNull();
    expect(res.backlogDir).toBe('.backlog');
  });

  // --- Nothing found ---

  it('returns nulls when nothing found', () => {
    const res = resolveBacklogDirectory(testDir);
    expect(res.backlogDir).toBeNull();
    expect(res.backlogPath).toBeNull();
    expect(res.source).toBeNull();
    expect(res.configPath).toBeNull();
    expect(res.configSource).toBeNull();
    expect(res.rootConfigExists).toBe(false);
  });

  // --- Invalid root config ---

  it('ignores root config without project_name', () => {
    mkdirSync(join(testDir, '.backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, '.backlog', 'config.yml'), 'project_name: "Test"\n');
    writeFileSync(join(testDir, 'backlog.config.yml'), 'name: "placeholder"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('.backlog');
    expect(res.configSource).toBe('folder');
    expect(res.backlogDir).toBe('.backlog');
  });

  // --- config.yaml fallback ---

  it('discovers config.yaml as alternative to config.yml', () => {
    mkdirSync(join(testDir, 'backlog', 'tasks'), { recursive: true });
    writeFileSync(join(testDir, 'backlog', 'config.yaml'), 'project_name: "Test"\n');

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('backlog');
    expect(res.configSource).toBe('folder');
    expect(res.configPath).toBe(join(testDir, 'backlog', 'config.yaml'));
  });

  // --- backlog_directory sets source correctly for known dirs ---

  it('sets source to "backlog" when backlog_directory is "backlog"', () => {
    mkdirSync(join(testDir, 'backlog'), { recursive: true });
    writeFileSync(
      join(testDir, 'backlog.config.yml'),
      'project_name: "Test"\nbacklog_directory: "backlog"\n'
    );

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('backlog');
    expect(res.configSource).toBe('root');
  });

  it('sets source to ".backlog" when backlog_directory is ".backlog"', () => {
    mkdirSync(join(testDir, '.backlog'), { recursive: true });
    writeFileSync(
      join(testDir, 'backlog.config.yml'),
      'project_name: "Test"\nbacklog_directory: ".backlog"\n'
    );

    const res = resolveBacklogDirectory(testDir);
    expect(res.source).toBe('.backlog');
    expect(res.configSource).toBe('root');
  });
});

describe('normalizeProjectBacklogDirectory', () => {
  it('normalizes valid relative path', () => {
    expect(normalizeProjectBacklogDirectory('planning/backlog-data')).toBe('planning/backlog-data');
  });

  it('trims whitespace', () => {
    expect(normalizeProjectBacklogDirectory('  tasks  ')).toBe('tasks');
  });

  it('rejects empty string', () => {
    expect(normalizeProjectBacklogDirectory('')).toBeNull();
  });

  it('rejects null/undefined', () => {
    expect(normalizeProjectBacklogDirectory(null)).toBeNull();
    expect(normalizeProjectBacklogDirectory(undefined)).toBeNull();
  });

  it('rejects absolute Unix path', () => {
    expect(normalizeProjectBacklogDirectory('/etc/backlog')).toBeNull();
  });

  it('rejects absolute Windows path', () => {
    expect(normalizeProjectBacklogDirectory('C:\\backlog')).toBeNull();
  });

  it('rejects parent directory traversal', () => {
    expect(normalizeProjectBacklogDirectory('..')).toBeNull();
    expect(normalizeProjectBacklogDirectory('../other')).toBeNull();
  });

  it('rejects "." (current dir)', () => {
    expect(normalizeProjectBacklogDirectory('.')).toBeNull();
  });

  it('strips trailing slashes', () => {
    expect(normalizeProjectBacklogDirectory('backlog/')).toBe('backlog');
    expect(normalizeProjectBacklogDirectory('planning/data/')).toBe('planning/data');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizeProjectBacklogDirectory('planning\\data')).toBe('planning/data');
  });
});
