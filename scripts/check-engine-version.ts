#!/usr/bin/env bun
/**
 * Validates that @types/vscode is compatible with engines.vscode.
 *
 * vsce package will refuse to build if @types/vscode specifies a higher
 * minimum version than engines.vscode. This script catches that mismatch
 * early — in CI on every PR — instead of at release time.
 */

import pkg from '../package.json';

function parseMinVersion(spec: string): number[] {
  // Strip range operators (^, ~, >=, etc.) to get the base version
  const version = spec.replace(/^[^\d]*/, '');
  return version.split('.').map(Number);
}

const typesSpec = pkg.devDependencies['@types/vscode'];
const engineSpec = pkg.engines.vscode;

if (!typesSpec) {
  console.log('No @types/vscode dependency found, skipping check.');
  process.exit(0);
}

const typesVersion = parseMinVersion(typesSpec);
const engineVersion = parseMinVersion(engineSpec);

for (let i = 0; i < 3; i++) {
  const t = typesVersion[i] ?? 0;
  const e = engineVersion[i] ?? 0;
  if (t > e) {
    console.error(
      `ERROR: @types/vscode ${typesSpec} requires a higher VS Code version than engines.vscode ${engineSpec}`
    );
    console.error('vsce package will fail. Bump engines.vscode or use an older @types/vscode.');
    process.exit(1);
  }
  if (t < e) break;
}

console.log(`OK: @types/vscode ${typesSpec} is compatible with engines.vscode ${engineSpec}`);
