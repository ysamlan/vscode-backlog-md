import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Task, TaskStatus } from './types';
import { BacklogParser } from './BacklogParser';

/**
 * Raw frontmatter structure for YAML serialization
 */
interface FrontmatterData {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  milestone?: string;
  labels?: string[];
  assignee?: string[];
  dependencies?: string[];
  created_date?: string;
  updated_date?: string;
  [key: string]: unknown;
}

/**
 * Writes changes back to Backlog.md task files
 */
export class BacklogWriter {
  /**
   * Update a task's status in its file
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    parser: BacklogParser
  ): Promise<void> {
    await this.updateTask(taskId, { status: newStatus }, parser);
  }

  /**
   * Update a task with partial changes
   */
  async updateTask(taskId: string, updates: Partial<Task>, parser: BacklogParser): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const content = fs.readFileSync(task.filePath, 'utf-8');
    const { frontmatter, body } = this.extractFrontmatter(content);

    // Apply updates to frontmatter
    if (updates.status !== undefined) {
      frontmatter.status = updates.status;
    }
    if (updates.priority !== undefined) {
      frontmatter.priority = updates.priority;
    }
    if (updates.title !== undefined) {
      frontmatter.title = updates.title;
    }
    if (updates.labels !== undefined) {
      frontmatter.labels = updates.labels;
    }
    if (updates.milestone !== undefined) {
      frontmatter.milestone = updates.milestone;
    }
    if (updates.assignee !== undefined) {
      frontmatter.assignee = updates.assignee;
    }

    // Update the updated_date
    frontmatter.updated_date = new Date().toISOString().split('T')[0];

    // Handle description update (stored in body, not frontmatter)
    let updatedBody = body;
    if (updates.description !== undefined) {
      updatedBody = this.updateDescriptionInBody(body, updates.description);
    }

    // Reconstruct the file
    const updatedContent = this.reconstructFile(frontmatter, updatedBody);
    fs.writeFileSync(task.filePath, updatedContent, 'utf-8');
  }

  /**
   * Update description content in the markdown body
   */
  private updateDescriptionInBody(body: string, newDescription: string): string {
    const beginMarker = '<!-- SECTION:DESCRIPTION:BEGIN -->';
    const endMarker = '<!-- SECTION:DESCRIPTION:END -->';

    const beginIndex = body.indexOf(beginMarker);
    const endIndex = body.indexOf(endMarker);

    if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
      // Replace content between markers
      const before = body.substring(0, beginIndex + beginMarker.length);
      const after = body.substring(endIndex);
      return `${before}\n${newDescription}\n${after}`;
    }

    // No markers found - look for ## Description section and add markers
    const descriptionHeaderRegex = /^## Description\s*$/m;
    const match = body.match(descriptionHeaderRegex);

    if (match && match.index !== undefined) {
      // Find the next section header or end of file
      const afterHeader = body.substring(match.index + match[0].length);
      const nextSectionMatch = afterHeader.match(/^## /m);
      const nextSectionIndex = nextSectionMatch?.index ?? afterHeader.length;

      const before = body.substring(0, match.index + match[0].length);
      const after = body.substring(match.index + match[0].length + nextSectionIndex);

      return `${before}\n\n${beginMarker}\n${newDescription}\n${endMarker}\n${after}`;
    }

    // No description section - add one after frontmatter
    return `\n## Description\n\n${beginMarker}\n${newDescription}\n${endMarker}\n${body}`;
  }

  /**
   * Toggle a checklist item
   */
  async toggleChecklistItem(
    taskId: string,
    _listType: 'acceptanceCriteria' | 'definitionOfDone',
    itemId: number,
    parser: BacklogParser
  ): Promise<void> {
    const task = await parser.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let content = fs.readFileSync(task.filePath, 'utf-8');

    // Find and toggle the specific checklist item by its #id
    // This is in the markdown body, not YAML, so regex is appropriate here
    const regex = new RegExp(`^(- \\[)([ xX])(\\]\\s*#${itemId}\\s+.*)$`, 'gm');
    content = content.replace(regex, (_match, prefix, check, suffix) => {
      const newCheck = check === ' ' ? 'x' : ' ';
      return `${prefix}${newCheck}${suffix}`;
    });

    fs.writeFileSync(task.filePath, content, 'utf-8');
  }

  /**
   * Extract YAML frontmatter and body from file content
   */
  private extractFrontmatter(content: string): { frontmatter: FrontmatterData; body: string } {
    const lines = content.split('\n');

    if (lines[0]?.trim() !== '---') {
      // No frontmatter, return empty object and full content as body
      return { frontmatter: {}, body: content };
    }

    // Find closing ---
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      // Malformed frontmatter
      return { frontmatter: {}, body: content };
    }

    const frontmatterYaml = lines.slice(1, endIndex).join('\n');
    const body = lines.slice(endIndex + 1).join('\n');

    try {
      const frontmatter = (yaml.load(frontmatterYaml) as FrontmatterData) || {};
      return { frontmatter, body };
    } catch {
      return { frontmatter: {}, body: content };
    }
  }

  /**
   * Reconstruct file from frontmatter and body
   */
  private reconstructFile(frontmatter: FrontmatterData, body: string): string {
    // Use yaml.dump with specific options for clean output
    const yamlContent = yaml.dump(frontmatter, {
      lineWidth: -1, // Don't wrap lines
      quotingType: "'", // Use single quotes for strings
      forceQuotes: false, // Only quote when necessary
      sortKeys: false, // Preserve key order
    });

    return `---\n${yamlContent}---${body}`;
  }
}
