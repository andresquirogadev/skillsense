import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { installSkills, rollback, skillIsInstalled, computeSha256 } from '../src/installer.js';
import type { SkillEntry } from '../src/resolver.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = join(tmpdir(), `skillsense-installer-${randomUUID()}`);
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const SKILL_CONTENT = '# NextJS Skill\nInstructions for Next.js projects.\n';
const SKILL_HASH = createHash('sha256').update(SKILL_CONTENT, 'utf-8').digest('hex');

function makeSkill(name: string, content = SKILL_CONTENT, sha256 = SKILL_HASH): SkillEntry {
  return {
    name,
    version: '1.0.0',
    url: `https://example.com/catalog/skills/${name}/SKILL.md`,
    sha256,
    agents: ['claude-code'],
  };
}

describe('installSkills', () => {
  it('installs skills by downloading content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => SKILL_CONTENT,
    }));

    const result = await installSkills([makeSkill('nextjs')], tmpDir);

    expect(result.installed).toContain('nextjs');
    expect(result.failed).toBeUndefined();

    // Verify file was written
    await expect(access(join(tmpDir, 'nextjs', 'SKILL.md'))).resolves.toBeUndefined();
  });

  it('installs multiple skills', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => SKILL_CONTENT,
    }));

    const result = await installSkills(
      [makeSkill('nextjs'), makeSkill('prisma'), makeSkill('typescript')],
      tmpDir,
    );

    expect(result.installed).toHaveLength(3);
    expect(result.failed).toBeUndefined();
  });

  it('returns installed list for dry-run without touching disk', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await installSkills([makeSkill('nextjs'), makeSkill('prisma')], tmpDir, {
      dryRun: true,
    });

    expect(result.installed).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rolls back and reports failure on SHA-256 mismatch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => SKILL_CONTENT,
    }));

    const badHashSkill = makeSkill('nextjs', SKILL_CONTENT, 'a'.repeat(64));
    const result = await installSkills([badHashSkill], tmpDir);

    expect(result.failed).toContain('SHA-256 mismatch');
    expect(result.installed).toHaveLength(0);
  });

  it('rolls back previously installed skills if one fails', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
      }
      return { ok: true, status: 200, statusText: 'OK', text: async () => SKILL_CONTENT };
    }));

    const result = await installSkills(
      [makeSkill('typescript'), makeSkill('broken'), makeSkill('prisma')],
      tmpDir,
    );

    expect(result.failed).toBeDefined();
    expect(result.installed).toHaveLength(0);

    // The first skill (typescript) should have been rolled back
    await expect(
      access(join(tmpDir, 'typescript', 'SKILL.md')),
    ).rejects.toThrow();
  });

  it('skips SHA-256 verification for TBD placeholder hashes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => SKILL_CONTENT,
    }));

    const result = await installSkills([makeSkill('nextjs', SKILL_CONTENT, 'TBD')], tmpDir);

    expect(result.installed).toContain('nextjs');
    expect(result.failed).toBeUndefined();
  });

  it('calls onProgress callbacks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => SKILL_CONTENT,
    }));

    const events: string[] = [];
    await installSkills([makeSkill('nextjs')], tmpDir, {
      onProgress: (skill, status) => events.push(`${skill}:${status}`),
    });

    expect(events).toContain('nextjs:downloading');
    expect(events).toContain('nextjs:verifying');
    expect(events).toContain('nextjs:copying');
    expect(events).toContain('nextjs:done');
  });
});

describe('skillIsInstalled', () => {
  it('returns false when skill is not installed', async () => {
    expect(await skillIsInstalled(tmpDir, 'nextjs')).toBe(false);
  });

  it('returns true when skill SKILL.md exists', async () => {
    const skillDir = join(tmpDir, 'nextjs');
    await mkdir(skillDir, { recursive: true });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(skillDir, 'SKILL.md'), SKILL_CONTENT);

    expect(await skillIsInstalled(tmpDir, 'nextjs')).toBe(true);
  });
});

describe('computeSha256', () => {
  it('returns a 64-character hex string', () => {
    expect(computeSha256(SKILL_CONTENT)).toHaveLength(64);
    expect(computeSha256(SKILL_CONTENT)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for the same input', () => {
    expect(computeSha256(SKILL_CONTENT)).toBe(SKILL_HASH);
  });
});
