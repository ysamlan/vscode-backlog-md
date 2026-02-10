import { readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Per-agent integration status
 */
export interface AgentStatus {
  mcpConfigured: boolean;
  guidelinesInjected: boolean;
}

/**
 * Overall integration detection result
 */
export interface IntegrationStatus {
  hasAnyIntegration: boolean;
  claudeCode: AgentStatus;
  codex: AgentStatus;
  generalGuidelines: boolean;
}

/** Markers used in instruction files to indicate Backlog.md integration */
const GUIDELINES_MARKERS = [
  '<!-- BACKLOG.MD MCP GUIDELINES START -->',
  '<!-- BACKLOG.MD GUIDELINES START -->',
];

/**
 * Safely read a file, returning null if it doesn't exist or can't be read.
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check whether a file contains a Backlog.md guidelines marker.
 */
function hasGuidelinesMarker(content: string): boolean {
  return GUIDELINES_MARKERS.some((marker) => content.includes(marker));
}

/**
 * Detect Claude Code integration in the workspace.
 *
 * Checks:
 * - `.mcp.json` for a `backlog` key in `mcpServers`
 * - `CLAUDE.md` or `AGENTS.md` for the guidelines marker
 */
export async function detectClaudeCodeIntegration(workspaceRoot: string): Promise<AgentStatus> {
  const result: AgentStatus = { mcpConfigured: false, guidelinesInjected: false };

  // Check .mcp.json
  const mcpContent = await safeReadFile(join(workspaceRoot, '.mcp.json'));
  if (mcpContent) {
    try {
      const parsed = JSON.parse(mcpContent);
      if (parsed?.mcpServers?.backlog) {
        result.mcpConfigured = true;
      }
    } catch {
      // Invalid JSON — check as raw string fallback
      if (mcpContent.includes('"backlog"')) {
        result.mcpConfigured = true;
      }
    }
  }

  // Check CLAUDE.md and AGENTS.md for guidelines marker
  for (const filename of ['CLAUDE.md', 'AGENTS.md']) {
    const content = await safeReadFile(join(workspaceRoot, filename));
    if (content && hasGuidelinesMarker(content)) {
      result.guidelinesInjected = true;
      break;
    }
  }

  return result;
}

/**
 * Detect Codex integration in the workspace.
 *
 * Checks:
 * - `.codex/config.toml` for `[mcp_servers.backlog]` or `mcp_servers.backlog`
 * - `AGENTS.md` for the guidelines marker
 */
export async function detectCodexIntegration(workspaceRoot: string): Promise<AgentStatus> {
  const result: AgentStatus = { mcpConfigured: false, guidelinesInjected: false };

  // Check .codex/config.toml (simple string search, no TOML parser)
  const codexConfig = await safeReadFile(join(workspaceRoot, '.codex', 'config.toml'));
  if (codexConfig && codexConfig.includes('mcp_servers.backlog')) {
    result.mcpConfigured = true;
  }

  // Check AGENTS.md for guidelines marker
  const agentsMd = await safeReadFile(join(workspaceRoot, 'AGENTS.md'));
  if (agentsMd && hasGuidelinesMarker(agentsMd)) {
    result.guidelinesInjected = true;
  }

  return result;
}

/**
 * Check if AGENTS.md has a general guidelines marker (not agent-specific).
 */
export async function detectGuidelinesMarker(workspaceRoot: string): Promise<boolean> {
  const content = await safeReadFile(join(workspaceRoot, 'AGENTS.md'));
  if (content && hasGuidelinesMarker(content)) {
    return true;
  }
  return false;
}

/**
 * Detect all agent integrations for a workspace.
 */
export async function detectIntegration(workspaceRoot: string): Promise<IntegrationStatus> {
  const [claudeCode, codex, generalGuidelines] = await Promise.all([
    detectClaudeCodeIntegration(workspaceRoot),
    detectCodexIntegration(workspaceRoot),
    detectGuidelinesMarker(workspaceRoot),
  ]);

  const hasAnyIntegration =
    claudeCode.mcpConfigured ||
    claudeCode.guidelinesInjected ||
    codex.mcpConfigured ||
    codex.guidelinesInjected ||
    generalGuidelines;

  return {
    hasAnyIntegration,
    claudeCode,
    codex,
    generalGuidelines,
  };
}

/**
 * Detect which package manager is available on PATH.
 * Prefers bun if both are available. Returns null if neither is found.
 */
export async function detectPackageManager(): Promise<'bun' | 'npm' | null> {
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';

  try {
    await execAsync(`${whichCmd} bun`);
    return 'bun';
  } catch {
    // bun not found
  }

  try {
    await execAsync(`${whichCmd} npm`);
    return 'npm';
  } catch {
    // npm not found
  }

  return null;
}
