#!/usr/bin/env bun
/**
 * Screenshot Validation Script
 *
 * Checks that all screenshots referenced in README.md exist, are valid PNGs,
 * have the expected dimensions, and warns if they're older than source changes.
 *
 * Usage:
 *   bun scripts/screenshots/validate.ts
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const PROJECT_ROOT = path.resolve(import.meta.dir, '../..');
const README_PATH = path.join(PROJECT_ROOT, 'README.md');
const SOURCE_DIRS = [
  path.join(PROJECT_ROOT, 'src/webview'),
  path.join(PROJECT_ROOT, 'src/providers'),
];

/** Minimum acceptable file size in bytes (10KB) */
const MIN_FILE_SIZE = 10 * 1024;

/** Expected image dimensions (at 2x DPI, with chrome padding) */
const EXPECTED_WIDTH_RANGE = { min: 2800, max: 3500 };
const EXPECTED_HEIGHT_RANGE = { min: 1800, max: 2600 };

interface ValidationResult {
  file: string;
  errors: string[];
  warnings: string[];
}

/**
 * Extract all image paths referenced in README.md
 */
function extractImageRefs(readmePath: string): string[] {
  const content = fs.readFileSync(readmePath, 'utf-8');
  const refs: string[] = [];

  // Match markdown image syntax: ![alt](path)
  const mdRegex = /!\[.*?\]\((docs\/images\/[^)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(content)) !== null) {
    refs.push(match[1]);
  }

  // Match HTML srcset and src attributes: srcset="path" or src="path"
  const htmlRegex = /(?:srcset|src)="(docs\/images\/[^"]+)"/g;
  while ((match = htmlRegex.exec(content)) !== null) {
    refs.push(match[1]);
  }

  // Deduplicate
  return [...new Set(refs)];
}

/**
 * Get the most recent modification time across source directories
 */
function getLatestSourceMtime(dirs: string[]): Date {
  let latest = new Date(0);

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    walkDir(dir, (filePath) => {
      if (filePath.endsWith('.ts') || filePath.endsWith('.svelte') || filePath.endsWith('.css')) {
        const stat = fs.statSync(filePath);
        if (stat.mtime > latest) latest = stat.mtime;
      }
    });
  }

  return latest;
}

/**
 * Recursively walk a directory
 */
function walkDir(dir: string, callback: (path: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

/**
 * Validate a single image file
 */
async function validateImage(
  imagePath: string,
  latestSourceMtime: Date
): Promise<ValidationResult> {
  const result: ValidationResult = { file: imagePath, errors: [], warnings: [] };
  const fullPath = path.join(PROJECT_ROOT, imagePath);

  // Check existence
  if (!fs.existsSync(fullPath)) {
    result.errors.push('File does not exist');
    return result;
  }

  // Check file size
  const stat = fs.statSync(fullPath);
  if (stat.size < MIN_FILE_SIZE) {
    result.errors.push(
      `File too small: ${(stat.size / 1024).toFixed(1)} KB (minimum: ${MIN_FILE_SIZE / 1024} KB)`
    );
  }

  // Check it's a valid PNG with correct dimensions
  try {
    const metadata = await sharp(fullPath).metadata();

    if (metadata.format !== 'png') {
      result.errors.push(`Not a PNG file (format: ${metadata.format})`);
    }

    if (metadata.width) {
      if (metadata.width < EXPECTED_WIDTH_RANGE.min || metadata.width > EXPECTED_WIDTH_RANGE.max) {
        result.warnings.push(
          `Width ${metadata.width}px outside expected range [${EXPECTED_WIDTH_RANGE.min}, ${EXPECTED_WIDTH_RANGE.max}]`
        );
      }
    }

    if (metadata.height) {
      if (
        metadata.height < EXPECTED_HEIGHT_RANGE.min ||
        metadata.height > EXPECTED_HEIGHT_RANGE.max
      ) {
        result.warnings.push(
          `Height ${metadata.height}px outside expected range [${EXPECTED_HEIGHT_RANGE.min}, ${EXPECTED_HEIGHT_RANGE.max}]`
        );
      }
    }
  } catch (err) {
    result.errors.push(`Invalid image file: ${err}`);
  }

  // Check staleness
  if (stat.mtime < latestSourceMtime) {
    const daysSinceSource = Math.floor(
      (latestSourceMtime.getTime() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24)
    );
    result.warnings.push(
      `Screenshot is ${daysSinceSource} day(s) older than latest source change. Consider regenerating with: bun run screenshots`
    );
  }

  return result;
}

// --- Main ---

async function main(): Promise<void> {
  console.log('Screenshot Validation');
  console.log('====================\n');

  // Extract image references from README
  const imageRefs = extractImageRefs(README_PATH);
  console.log(`Found ${imageRefs.length} image reference(s) in README.md:\n`);

  if (imageRefs.length === 0) {
    console.log('No image references found in README.md');
    process.exit(0);
  }

  for (const ref of imageRefs) {
    console.log(`  - ${ref}`);
  }
  console.log();

  // Get latest source modification time
  const latestSourceMtime = getLatestSourceMtime(SOURCE_DIRS);
  console.log(`Latest source change: ${latestSourceMtime.toISOString()}\n`);

  // Validate each image
  let hasErrors = false;
  let hasWarnings = false;

  for (const ref of imageRefs) {
    const result = await validateImage(ref, latestSourceMtime);

    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log(`${ref}:`);
      for (const error of result.errors) {
        console.log(`  ERROR: ${error}`);
        hasErrors = true;
      }
      for (const warning of result.warnings) {
        console.log(`  WARN: ${warning}`);
        hasWarnings = true;
      }
      console.log();
    } else {
      console.log(`${ref}: OK`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(40));
  if (hasErrors) {
    console.log('FAILED: One or more screenshots have errors.');
    console.log('Run "bun run screenshots" to regenerate.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('PASSED with warnings. Screenshots may be stale.');
  } else {
    console.log('PASSED: All screenshots are valid and up to date.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
