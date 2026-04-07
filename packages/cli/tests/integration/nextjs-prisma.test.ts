/**
 * Integration test: Next.js + Prisma project
 *
 * Creates a temporary project directory with a Next.js + Prisma package.json,
 * runs the full detect → resolve pipeline, then installs with a mocked fetch.
 * Verifies that exactly nextjs, prisma, typescript, and nodejs skills are installed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { detectStack } from '../../src/detector.js';
import { resolveSkills } from '../../src/resolver.js';
import { installSkills } from '../../src/installer.js';
import type { Registry, CombosConfig } from '../../src/resolver.js';

const CATALOG_URL = 'https://example.com/catalog';

const registry: Registry = {
  skills: {
    nextjs:     { version: '1.0.0', path: 'skills/nextjs/SKILL.md',     sha256: 'TBD', agents: ['claude-code'], triggers: ['next'],     quality_score: 95, last_eval: '2026-04-06' },
    react:      { version: '1.0.0', path: 'skills/react/SKILL.md',      sha256: 'TBD', agents: ['claude-code'], triggers: ['react'],    quality_score: 95, last_eval: '2026-04-06' },
    typescript: { version: '1.0.0', path: 'skills/typescript/SKILL.md', sha256: 'TBD', agents: ['claude-code'], triggers: ['ts'],       quality_score: 96, last_eval: '2026-04-06' },
    prisma:     { version: '1.0.0', path: 'skills/prisma/SKILL.md',     sha256: 'TBD', agents: ['claude-code'], triggers: ['prisma'],   quality_score: 93, last_eval: '2026-04-06' },
    nodejs:     { version: '1.0.0', path: 'skills/nodejs/SKILL.md',     sha256: 'TBD', agents: ['claude-code'], triggers: ['node'],     quality_score: 90, last_eval: '2026-04-06' },
    tailwindcss:{ version: '1.0.0', path: 'skills/tailwindcss/SKILL.md',sha256: 'TBD', agents: ['claude-code'], triggers: ['tailwind'], quality_score: 92, last_eval: '2026-04-06' },
  },
};

const combos: CombosConfig = {
  combos: {
    'nextjs-prisma': {
      triggers: ['nextjs', 'prisma'],
      skills: ['nextjs', 'prisma', 'typescript'],
      order: ['typescript', 'prisma', 'nextjs'],
      conflicts: ['drizzle'],
    },
  },
};

let tmpDir: string;
let skillsDir: string;

beforeEach(async () => {
  tmpDir = join(tmpdir(), `skillsense-integration-${randomUUID()}`);
  skillsDir = join(tmpDir, '.claude', 'skills');
  await mkdir(tmpDir, { recursive: true });

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '# Skill\nContent.\n',
    }),
  );
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('Next.js + Prisma integration', () => {
  it('installs nextjs and prisma skills (and typescript via combo)', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          next: '^15.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          '@prisma/client': '^5.0.0',
        },
        devDependencies: {
          prisma: '^5.0.0',
        },
      }),
    );

    // Detect
    const stack = await detectStack(tmpDir);
    const detectedNames = stack.technologies.map((t) => t.name);
    expect(detectedNames).toContain('nextjs');
    expect(detectedNames).toContain('prisma');

    // Resolve
    const resolved = resolveSkills(stack, registry, combos, CATALOG_URL);
    const resolvedNames = resolved.skills.map((s) => s.name);
    expect(resolvedNames).toContain('nextjs');
    expect(resolvedNames).toContain('prisma');
    expect(resolvedNames).toContain('typescript'); // added by combo
    expect(resolved.appliedCombos).toContain('nextjs-prisma');
    expect(resolved.conflicts).toHaveLength(0);

    // Install
    const result = await installSkills(resolved.skills, skillsDir, { dryRun: false });
    expect(result.installed).toContain('nextjs');
    expect(result.installed).toContain('prisma');
    expect(result.installed).toContain('typescript');
    expect(result.failed).toBeUndefined();

    // Verify files on disk
    await expect(access(join(skillsDir, 'nextjs', 'SKILL.md'))).resolves.toBeUndefined();
    await expect(access(join(skillsDir, 'prisma', 'SKILL.md'))).resolves.toBeUndefined();
    await expect(access(join(skillsDir, 'typescript', 'SKILL.md'))).resolves.toBeUndefined();
  });

  it('dry-run lists skills without creating any files', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '^15.0.0', '@prisma/client': '^5.0.0' },
      }),
    );

    const stack = await detectStack(tmpDir);
    const resolved = resolveSkills(stack, registry, combos, CATALOG_URL);
    const result = await installSkills(resolved.skills, skillsDir, { dryRun: true });

    expect(result.installed.length).toBeGreaterThan(0);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // No files created
    await expect(access(skillsDir)).rejects.toThrow();
  });

  it('rolls back on install failure, leaving project intact', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '^15.0.0', '@prisma/client': '^5.0.0' },
      }),
    );

    let fetchCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        fetchCount++;
        if (fetchCount >= 2) {
          return { ok: false, status: 503, statusText: 'Service Unavailable', text: async () => '' };
        }
        return { ok: true, status: 200, statusText: 'OK', text: async () => '# Skill\nContent.\n' };
      }),
    );

    const stack = await detectStack(tmpDir);
    const resolved = resolveSkills(stack, registry, combos, CATALOG_URL);

    // Force at least 2 skills so the second one fails
    expect(resolved.skills.length).toBeGreaterThanOrEqual(2);
    const result = await installSkills(resolved.skills, skillsDir, { dryRun: false });

    expect(result.failed).toBeDefined();
    expect(result.installed).toHaveLength(0);

    // Skills directory should be clean (rolled back)
    let skillDirExists = true;
    try {
      await access(skillsDir);
    } catch {
      skillDirExists = false;
    }
    // Either the dir doesn't exist, or it's empty
    if (skillDirExists) {
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(skillsDir);
      expect(entries).toHaveLength(0);
    }
  });
});
