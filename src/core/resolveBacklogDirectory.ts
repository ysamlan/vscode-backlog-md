/**
 * Backlog directory resolution — ported from upstream Backlog.md (BACK-402).
 *
 * Determines the backlog directory for a project root using the same algorithm
 * as the Backlog.md CLI, ensuring VS Code discovers the same backlog folder.
 */
import { readFileSync, statSync } from 'fs';
import { join, normalize } from 'path';

// Constants (inlined from upstream src/constants/index.ts)
const ROOT_CONFIG = 'backlog.config.yml';
const BACKLOG_DIR = 'backlog';
const HIDDEN_BACKLOG_DIR = '.backlog';
const CONFIG_YML = 'config.yml';
const CONFIG_YAML = 'config.yaml';

export type BacklogDirectorySource = 'backlog' | '.backlog' | 'custom';
export type BacklogConfigSource = 'folder' | 'root';

export interface BacklogDirectoryResolution {
  projectRoot: string;
  backlogDir: string | null;
  backlogPath: string | null;
  source: BacklogDirectorySource | null;
  configPath: string | null;
  configSource: BacklogConfigSource | null;
  rootConfigPath: string;
  rootConfigExists: boolean;
}

interface BacklogConfigMetadata {
  projectName: string | null;
  backlogDirectory: string | null;
}

function directoryExists(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function parseBacklogConfigMetadata(content: string): BacklogConfigMetadata {
  let projectName: string | null = null;
  let backlogDirectory: string | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const key = line.slice(0, colonIndex).trim();
    const value = line
      .slice(colonIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if ((key === 'project_name' || key === 'projectName') && value) {
      projectName = value;
      continue;
    }
    if (key === 'backlog_directory' || key === 'backlogDirectory') {
      backlogDirectory = normalizeProjectBacklogDirectory(value);
    }
  }
  return { projectName, backlogDirectory };
}

function readRootBacklogConfigMetadata(rootConfigPath: string): BacklogConfigMetadata | null {
  if (!fileExists(rootConfigPath)) {
    return null;
  }
  try {
    const metadata = parseBacklogConfigMetadata(readFileSync(rootConfigPath, 'utf8'));
    return metadata.projectName ? metadata : null;
  } catch {
    return null;
  }
}

function resolveFolderConfigPath(backlogPath: string): string | null {
  const primary = join(backlogPath, CONFIG_YML);
  if (fileExists(primary)) {
    return primary;
  }
  const alternate = join(backlogPath, CONFIG_YAML);
  return fileExists(alternate) ? alternate : null;
}

function resolveBuiltInBacklogDirectory(projectRoot: string): {
  backlogDir: string;
  backlogPath: string;
  source: 'backlog' | '.backlog';
} | null {
  const defaultBacklogPath = join(projectRoot, BACKLOG_DIR);
  const hiddenBacklogPath = join(projectRoot, HIDDEN_BACKLOG_DIR);
  const defaultBacklogExists = directoryExists(defaultBacklogPath);
  const hiddenBacklogExists = directoryExists(hiddenBacklogPath);
  const defaultConfigPath = defaultBacklogExists
    ? resolveFolderConfigPath(defaultBacklogPath)
    : null;
  const hiddenConfigPath = hiddenBacklogExists ? resolveFolderConfigPath(hiddenBacklogPath) : null;

  if (defaultConfigPath) {
    return { backlogDir: BACKLOG_DIR, backlogPath: defaultBacklogPath, source: 'backlog' };
  }
  if (hiddenConfigPath) {
    return {
      backlogDir: HIDDEN_BACKLOG_DIR,
      backlogPath: hiddenBacklogPath,
      source: '.backlog',
    };
  }
  if (defaultBacklogExists) {
    return { backlogDir: BACKLOG_DIR, backlogPath: defaultBacklogPath, source: 'backlog' };
  }
  if (hiddenBacklogExists) {
    return {
      backlogDir: HIDDEN_BACKLOG_DIR,
      backlogPath: hiddenBacklogPath,
      source: '.backlog',
    };
  }
  return null;
}

export function normalizeProjectBacklogDirectory(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return null;
  }
  // Reject absolute paths (Unix or Windows)
  if (/^(?:[a-zA-Z]:)?[\\/]/.test(trimmed)) {
    return null;
  }

  const normalized = normalize(trimmed).replace(/\\/g, '/').replace(/\/+$/g, '');
  if (!normalized || normalized === '.') {
    return null;
  }
  if (normalized === '..' || normalized.startsWith('../')) {
    return null;
  }
  return normalized;
}

export function resolveBacklogDirectory(projectRoot: string): BacklogDirectoryResolution {
  const rootConfigPath = join(projectRoot, ROOT_CONFIG);
  const rootConfigExists = fileExists(rootConfigPath);

  if (rootConfigExists) {
    const metadata = readRootBacklogConfigMetadata(rootConfigPath);
    const configuredBacklogDir = metadata?.backlogDirectory ?? null;
    if (metadata && configuredBacklogDir) {
      const configuredBacklogPath = join(projectRoot, configuredBacklogDir);
      const configuredSource: BacklogDirectorySource =
        configuredBacklogDir === BACKLOG_DIR
          ? 'backlog'
          : configuredBacklogDir === HIDDEN_BACKLOG_DIR
            ? '.backlog'
            : 'custom';
      return {
        projectRoot,
        backlogDir: configuredBacklogDir,
        backlogPath: configuredBacklogPath,
        source: configuredSource,
        configPath: rootConfigPath,
        configSource: 'root',
        rootConfigPath,
        rootConfigExists,
      };
    }

    if (metadata) {
      const builtIn = resolveBuiltInBacklogDirectory(projectRoot);
      if (builtIn) {
        return {
          projectRoot,
          backlogDir: builtIn.backlogDir,
          backlogPath: builtIn.backlogPath,
          source: builtIn.source,
          configPath: rootConfigPath,
          configSource: 'root',
          rootConfigPath,
          rootConfigExists,
        };
      }

      return {
        projectRoot,
        backlogDir: null,
        backlogPath: null,
        source: null,
        configPath: null,
        configSource: null,
        rootConfigPath,
        rootConfigExists,
      };
    }
  }

  const builtIn = resolveBuiltInBacklogDirectory(projectRoot);
  if (!builtIn) {
    return {
      projectRoot,
      backlogDir: null,
      backlogPath: null,
      source: null,
      configPath: null,
      configSource: null,
      rootConfigPath,
      rootConfigExists,
    };
  }

  const folderConfigPath = resolveFolderConfigPath(builtIn.backlogPath);
  return {
    projectRoot,
    backlogDir: builtIn.backlogDir,
    backlogPath: builtIn.backlogPath,
    source: builtIn.source,
    configPath: folderConfigPath,
    configSource: folderConfigPath ? 'folder' : null,
    rootConfigPath,
    rootConfigExists,
  };
}
