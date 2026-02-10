import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectClaudeCodeIntegration,
  detectCodexIntegration,
  detectGuidelinesMarker,
  detectIntegration,
  detectPackageManager,
} from '../../core/AgentIntegrationDetector';
import * as fs from 'fs/promises';
import * as childProcess from 'child_process';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock util.promisify to return a function that calls exec mock
vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util');
  return {
    ...actual,
    promisify: vi.fn((fn: unknown) => {
      return (...args: unknown[]) => {
        return new Promise((resolve, reject) => {
          (fn as (...a: unknown[]) => void)(...args, (err: Error | null, result: unknown) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };
    }),
  };
});

const mockReadFile = vi.mocked(fs.readFile);
const mockExec = vi.mocked(childProcess.exec);

describe('AgentIntegrationDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to set up readFile mock for specific paths
  function mockFileContents(files: Record<string, string | null>) {
    mockReadFile.mockImplementation(async (path: unknown) => {
      const pathStr = String(path);
      for (const [key, value] of Object.entries(files)) {
        if (pathStr.endsWith(key) || pathStr === key) {
          if (value === null) {
            throw new Error('ENOENT: no such file or directory');
          }
          return value;
        }
      }
      throw new Error('ENOENT: no such file or directory');
    });
  }

  describe('detectClaudeCodeIntegration', () => {
    it('should detect backlog in .mcp.json mcpServers', async () => {
      mockFileContents({
        '.mcp.json': JSON.stringify({
          mcpServers: {
            backlog: { command: 'backlog', args: ['mcp'] },
          },
        }),
      });

      const result = await detectClaudeCodeIntegration('/workspace');
      expect(result.mcpConfigured).toBe(true);
      expect(result.guidelinesInjected).toBe(false);
    });

    it('should not detect backlog when .mcp.json has other servers', async () => {
      mockFileContents({
        '.mcp.json': JSON.stringify({
          mcpServers: {
            other: { command: 'other' },
          },
        }),
      });

      const result = await detectClaudeCodeIntegration('/workspace');
      expect(result.mcpConfigured).toBe(false);
    });

    it('should handle missing .mcp.json', async () => {
      mockFileContents({});

      const result = await detectClaudeCodeIntegration('/workspace');
      expect(result.mcpConfigured).toBe(false);
      expect(result.guidelinesInjected).toBe(false);
    });

    it('should handle invalid JSON in .mcp.json with fallback string check', async () => {
      mockFileContents({
        '.mcp.json': '{ "mcpServers": { "backlog": broken json',
      });

      const result = await detectClaudeCodeIntegration('/workspace');
      expect(result.mcpConfigured).toBe(true); // fallback string check finds "backlog"
    });

    it('should detect guidelines marker in CLAUDE.md', async () => {
      mockFileContents({
        'CLAUDE.md':
          'Some content\n<!-- BACKLOG.MD MCP GUIDELINES START -->\nGuidelines here\n<!-- BACKLOG.MD MCP GUIDELINES END -->',
      });

      const result = await detectClaudeCodeIntegration('/workspace');
      expect(result.guidelinesInjected).toBe(true);
    });

    it('should detect guidelines marker in AGENTS.md', async () => {
      mockFileContents({
        'AGENTS.md':
          '<!-- BACKLOG.MD MCP GUIDELINES START -->\nAgent guidelines\n<!-- BACKLOG.MD MCP GUIDELINES END -->',
      });

      const result = await detectClaudeCodeIntegration('/workspace');
      expect(result.guidelinesInjected).toBe(true);
    });

    it('should not detect guidelines when files have no marker', async () => {
      mockFileContents({
        'CLAUDE.md': 'Some other content',
        'AGENTS.md': 'More content without marker',
      });

      const result = await detectClaudeCodeIntegration('/workspace');
      expect(result.guidelinesInjected).toBe(false);
    });
  });

  describe('detectCodexIntegration', () => {
    it('should detect mcp_servers.backlog in .codex/config.toml', async () => {
      mockFileContents({
        'config.toml': '[mcp_servers.backlog]\ncommand = "backlog"\nargs = ["mcp"]',
      });

      const result = await detectCodexIntegration('/workspace');
      expect(result.mcpConfigured).toBe(true);
    });

    it('should not detect when .codex/config.toml has no backlog entry', async () => {
      mockFileContents({
        'config.toml': '[mcp_servers.other]\ncommand = "other"',
      });

      const result = await detectCodexIntegration('/workspace');
      expect(result.mcpConfigured).toBe(false);
    });

    it('should handle missing .codex/config.toml', async () => {
      mockFileContents({});

      const result = await detectCodexIntegration('/workspace');
      expect(result.mcpConfigured).toBe(false);
      expect(result.guidelinesInjected).toBe(false);
    });

    it('should detect guidelines marker in AGENTS.md', async () => {
      mockFileContents({
        'AGENTS.md':
          '<!-- BACKLOG.MD MCP GUIDELINES START -->\nGuidelines\n<!-- BACKLOG.MD MCP GUIDELINES END -->',
      });

      const result = await detectCodexIntegration('/workspace');
      expect(result.guidelinesInjected).toBe(true);
    });
  });

  describe('detectGuidelinesMarker', () => {
    it('should detect MCP guidelines marker', async () => {
      mockFileContents({
        'AGENTS.md': 'stuff\n<!-- BACKLOG.MD MCP GUIDELINES START -->\nmore stuff',
      });

      const result = await detectGuidelinesMarker('/workspace');
      expect(result).toBe(true);
    });

    it('should detect CLI guidelines marker', async () => {
      mockFileContents({
        'AGENTS.md': 'stuff\n<!-- BACKLOG.MD GUIDELINES START -->\nmore stuff',
      });

      const result = await detectGuidelinesMarker('/workspace');
      expect(result).toBe(true);
    });

    it('should return false when no marker exists', async () => {
      mockFileContents({
        'AGENTS.md': 'Just some content without any marker',
      });

      const result = await detectGuidelinesMarker('/workspace');
      expect(result).toBe(false);
    });

    it('should return false when AGENTS.md is missing', async () => {
      mockFileContents({});

      const result = await detectGuidelinesMarker('/workspace');
      expect(result).toBe(false);
    });
  });

  describe('detectIntegration', () => {
    it('should return hasAnyIntegration true when Claude MCP is configured', async () => {
      mockFileContents({
        '.mcp.json': JSON.stringify({
          mcpServers: { backlog: { command: 'backlog' } },
        }),
      });

      const result = await detectIntegration('/workspace');
      expect(result.hasAnyIntegration).toBe(true);
      expect(result.claudeCode.mcpConfigured).toBe(true);
    });

    it('should return hasAnyIntegration true when guidelines are injected', async () => {
      mockFileContents({
        'AGENTS.md': '<!-- BACKLOG.MD MCP GUIDELINES START -->',
      });

      const result = await detectIntegration('/workspace');
      expect(result.hasAnyIntegration).toBe(true);
      expect(result.generalGuidelines).toBe(true);
    });

    it('should return hasAnyIntegration false when nothing is configured', async () => {
      mockFileContents({});

      const result = await detectIntegration('/workspace');
      expect(result.hasAnyIntegration).toBe(false);
      expect(result.claudeCode.mcpConfigured).toBe(false);
      expect(result.claudeCode.guidelinesInjected).toBe(false);
      expect(result.codex.mcpConfigured).toBe(false);
      expect(result.codex.guidelinesInjected).toBe(false);
      expect(result.generalGuidelines).toBe(false);
    });
  });

  describe('detectPackageManager', () => {
    it('should return bun when bun is available', async () => {
      mockExec.mockImplementation(((
        cmd: string,
        callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        if (cmd.includes('bun')) {
          callback(null, { stdout: '/usr/local/bin/bun\n', stderr: '' });
        } else {
          callback(new Error('not found'), { stdout: '', stderr: '' });
        }
      }) as typeof childProcess.exec);

      const result = await detectPackageManager();
      expect(result).toBe('bun');
    });

    it('should return npm when only npm is available', async () => {
      mockExec.mockImplementation(((
        cmd: string,
        callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        if (cmd.includes('npm')) {
          callback(null, { stdout: '/usr/local/bin/npm\n', stderr: '' });
        } else {
          callback(new Error('not found'), { stdout: '', stderr: '' });
        }
      }) as typeof childProcess.exec);

      const result = await detectPackageManager();
      expect(result).toBe('npm');
    });

    it('should prefer bun when both are available', async () => {
      mockExec.mockImplementation(((
        cmd: string,
        callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        callback(null, { stdout: '/usr/local/bin/something\n', stderr: '' });
      }) as typeof childProcess.exec);

      const result = await detectPackageManager();
      expect(result).toBe('bun');
    });

    it('should return null when neither is available', async () => {
      mockExec.mockImplementation(((
        cmd: string,
        callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        callback(new Error('not found'), { stdout: '', stderr: '' });
      }) as typeof childProcess.exec);

      const result = await detectPackageManager();
      expect(result).toBeNull();
    });
  });
});
