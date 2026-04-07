import { describe, it, expect } from 'vitest';
import { resolveSkills } from '../src/resolver.js';
import type { Registry, CombosConfig } from '../src/resolver.js';
import type { DetectedStack } from '../src/detector.js';

const TEST_BASE_URL = 'https://example.com/catalog';

const registry: Registry = {
  skills: {
    nextjs: {
      version: '1.0.0',
      path: 'skills/nextjs/SKILL.md',
      sha256: 'TBD',
      agents: ['claude-code', 'opencode', 'copilot'],
      triggers: ['next'],
      quality_score: 95,
      last_eval: '2026-04-06',
    },
    react: {
      version: '1.0.0',
      path: 'skills/react/SKILL.md',
      sha256: 'TBD',
      agents: ['claude-code', 'opencode', 'copilot'],
      triggers: ['react'],
      quality_score: 95,
      last_eval: '2026-04-06',
    },
    typescript: {
      version: '1.0.0',
      path: 'skills/typescript/SKILL.md',
      sha256: 'TBD',
      agents: ['claude-code', 'opencode', 'copilot'],
      triggers: ['typescript'],
      quality_score: 96,
      last_eval: '2026-04-06',
    },
    prisma: {
      version: '1.0.0',
      path: 'skills/prisma/SKILL.md',
      sha256: 'TBD',
      agents: ['claude-code', 'opencode', 'copilot'],
      triggers: ['prisma'],
      quality_score: 93,
      last_eval: '2026-04-06',
    },
    drizzle: {
      version: '1.0.0',
      path: 'skills/drizzle/SKILL.md',
      sha256: 'TBD',
      agents: ['claude-code', 'opencode', 'copilot'],
      triggers: ['drizzle-orm'],
      quality_score: 91,
      last_eval: '2026-04-06',
    },
    nodejs: {
      version: '1.0.0',
      path: 'skills/nodejs/SKILL.md',
      sha256: 'TBD',
      agents: ['claude-code', 'opencode', 'copilot'],
      triggers: ['node'],
      quality_score: 90,
      last_eval: '2026-04-06',
    },
  },
};

const combos: CombosConfig = {
  combos: {
    'nextjs-prisma': {
      triggers: ['nextjs', 'prisma'],
      skills: ['nextjs', 'prisma', 'typescript'],
      order: ['typescript', 'prisma', 'nextjs'],
    },
    'nextjs-drizzle-conflict-test': {
      triggers: ['nextjs', 'drizzle'],
      skills: ['nextjs', 'drizzle', 'typescript'],
      order: ['typescript', 'drizzle', 'nextjs'],
      conflicts: ['prisma'],
    },
  },
};

function makeStack(techNames: string[]): DetectedStack {
  return {
    technologies: techNames.map((name) => ({ name, version: '1.0.0', source: 'test' })),
    manifests: ['package.json'],
  };
}

describe('resolveSkills', () => {
  it('resolves individual skills for a simple stack', () => {
    const stack = makeStack(['react', 'typescript', 'nodejs']);
    const result = resolveSkills(stack, registry, combos, TEST_BASE_URL);

    const names = result.skills.map((s) => s.name);
    expect(names).toContain('react');
    expect(names).toContain('typescript');
    expect(names).toContain('nodejs');
    expect(result.appliedCombos).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('applies nextjs-prisma combo and installs in defined order', () => {
    const stack = makeStack(['nextjs', 'prisma', 'typescript', 'nodejs']);
    const result = resolveSkills(stack, registry, combos, TEST_BASE_URL);

    const names = result.skills.map((s) => s.name);
    expect(names).toContain('nextjs');
    expect(names).toContain('prisma');
    expect(names).toContain('typescript');
    expect(result.appliedCombos).toContain('nextjs-prisma');

    // Order from combo: typescript → prisma → nextjs
    const tsIdx = names.indexOf('typescript');
    const prismaIdx = names.indexOf('prisma');
    const nextIdx = names.indexOf('nextjs');
    expect(tsIdx).toBeLessThan(prismaIdx);
    expect(prismaIdx).toBeLessThan(nextIdx);
  });

  it('does not duplicate skills already added by a combo', () => {
    const stack = makeStack(['nextjs', 'prisma', 'typescript', 'nodejs']);
    const result = resolveSkills(stack, registry, combos, TEST_BASE_URL);

    const names = result.skills.map((s) => s.name);
    expect(names.filter((n) => n === 'typescript')).toHaveLength(1);
    expect(names.filter((n) => n === 'nextjs')).toHaveLength(1);
  });

  it('records conflict when a combo trigger conflicts with detected tech', () => {
    // nextjs + drizzle triggers the combo, but prisma is also detected → conflict
    const stack = makeStack(['nextjs', 'drizzle', 'prisma', 'nodejs']);
    const result = resolveSkills(stack, registry, combos, TEST_BASE_URL);

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0]).toContain('prisma');
  });

  it('skips unknown technologies gracefully', () => {
    const stack = makeStack(['unknown-tech-xyz']);
    const result = resolveSkills(stack, registry, combos, TEST_BASE_URL);

    expect(result.skills).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('builds correct URL for each skill', () => {
    const stack = makeStack(['react']);
    const result = resolveSkills(stack, registry, combos, TEST_BASE_URL);

    const reactSkill = result.skills.find((s) => s.name === 'react');
    expect(reactSkill?.url).toBe(`${TEST_BASE_URL}/skills/react/SKILL.md`);
  });
});
