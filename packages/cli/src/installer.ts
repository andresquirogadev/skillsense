import { mkdir, writeFile, rm, access, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { SkillEntry } from './resolver.js';

export interface InstallOptions {
  dryRun?: boolean;
  onProgress?: (
    skill: string,
    status: 'downloading' | 'verifying' | 'copying' | 'done' | 'error',
  ) => void;
}

export interface InstallResult {
  installed: string[];
  skipped: string[];
  failed?: string;
}

async function downloadSkill(url: string): Promise<string> {
  if (url.startsWith('file://')) {
    return readFile(fileURLToPath(url), 'utf-8');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} downloading ${url}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Returns true when the hash matches, or when the hash is a placeholder.
 * Placeholder values: empty string, "TBD", or all-zero hex string.
 */
function verifySha256(content: string, expectedHash: string): boolean {
  const cleaned = expectedHash.trim();
  if (!cleaned || cleaned === 'TBD' || /^0+$/.test(cleaned)) {
    return true;
  }
  // Normalize to LF before hashing so the result matches GitHub-served content
  const normalized = content.replace(/\r\n/g, '\n');
  const actual = createHash('sha256').update(normalized, 'utf-8').digest('hex');
  return actual === cleaned;
}

export async function installSkills(
  skills: SkillEntry[],
  skillsDir: string,
  options: InstallOptions = {},
): Promise<InstallResult> {
  const { dryRun = false, onProgress } = options;

  if (dryRun) {
    return { installed: skills.map((s) => s.name), skipped: [] };
  }

  const installedPaths: string[] = [];
  const installed: string[] = [];

  for (const skill of skills) {
    const destDir = join(skillsDir, skill.name);
    const destFile = join(destDir, 'SKILL.md');

    try {
      onProgress?.(skill.name, 'downloading');
      const content = await downloadSkill(skill.url);

      onProgress?.(skill.name, 'verifying');
      if (!verifySha256(content, skill.sha256)) {
        throw new Error(
          `SHA-256 mismatch for skill "${skill.name}". Expected: ${skill.sha256}`,
        );
      }

      onProgress?.(skill.name, 'copying');
      await mkdir(destDir, { recursive: true });
      await writeFile(destFile, content, 'utf-8');
      installedPaths.push(destFile);

      onProgress?.(skill.name, 'done');
      installed.push(skill.name);
    } catch (error) {
      onProgress?.(skill.name, 'error');
      await rollback(installedPaths);
      return {
        installed: [],
        skipped: [],
        failed: `Failed to install "${skill.name}": ${(error as Error).message}`,
      };
    }
  }

  return { installed, skipped: [] };
}

export async function rollback(installedPaths: string[]): Promise<void> {
  // Reverse order so child paths are removed before parents
  for (const filePath of [...installedPaths].reverse()) {
    try {
      await rm(filePath, { force: true });
      // Remove the skill subdirectory (e.g. .claude/skills/nextjs/) — recursive in
      // case the installer ever writes more than one file per skill directory.
      try {
        await rm(dirname(filePath), { recursive: true, force: true });
      } catch {
        // Directory not empty or already removed — that is fine
      }
    } catch {
      // Best-effort: continue rolling back other files
    }
  }
}

export async function skillIsInstalled(
  skillsDir: string,
  skillName: string,
): Promise<boolean> {
  try {
    await access(join(skillsDir, skillName, 'SKILL.md'));
    return true;
  } catch {
    return false;
  }
}

export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}
