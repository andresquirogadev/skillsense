import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { detectStack } from '../src/detector.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = join(tmpdir(), `skillsense-test-${randomUUID()}`);
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('detectStack – package.json', () => {
  it('detects nextjs and react from a Next.js project', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' },
      }),
    );

    const stack = await detectStack(tmpDir);
    const names = stack.technologies.map((t) => t.name);

    expect(names).toContain('nextjs');
    expect(names).toContain('react');
    expect(names).toContain('nodejs');
    expect(stack.manifests).toContain('package.json');
  });

  it('detects prisma from @prisma/client', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@prisma/client': '^5.0.0' },
        devDependencies: { prisma: '^5.0.0' },
      }),
    );

    const stack = await detectStack(tmpDir);
    const names = stack.technologies.map((t) => t.name);

    expect(names).toContain('prisma');
    // Should not appear twice
    expect(names.filter((n) => n === 'prisma')).toHaveLength(1);
  });

  it('detects supabase and playwright', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@supabase/supabase-js': '^2.0.0' },
        devDependencies: { '@playwright/test': '^1.0.0' },
      }),
    );

    const stack = await detectStack(tmpDir);
    const names = stack.technologies.map((t) => t.name);

    expect(names).toContain('supabase');
    expect(names).toContain('playwright');
  });

  it('detects typescript when tsconfig.json is present', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { express: '^4.0.0' } }),
    );
    await writeFile(join(tmpDir, 'tsconfig.json'), '{}');

    const stack = await detectStack(tmpDir);
    const names = stack.technologies.map((t) => t.name);

    expect(names).toContain('typescript');
  });

  it('strips semver range prefix from version', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { next: '^15.1.0' } }),
    );

    const stack = await detectStack(tmpDir);
    const nextTech = stack.technologies.find((t) => t.name === 'nextjs');
    expect(nextTech?.version).toBe('15.1.0');
  });
});

describe('detectStack – pyproject.toml', () => {
  it('detects fastapi from pyproject.toml', async () => {
    await writeFile(
      join(tmpDir, 'pyproject.toml'),
      `[tool.poetry.dependencies]\nfastapi = "^0.110.0"\nuvicorn = "^0.29.0"\n`,
    );

    const stack = await detectStack(tmpDir);
    const names = stack.technologies.map((t) => t.name);

    expect(names).toContain('fastapi');
    expect(names).toContain('python');
    expect(stack.manifests).toContain('pyproject.toml');
  });

  it('detects django from pyproject.toml', async () => {
    await writeFile(
      join(tmpDir, 'pyproject.toml'),
      `[tool.poetry.dependencies]\ndjango = "^5.0.0"\npsycopg2-binary = "^2.9.0"\n`,
    );

    const stack = await detectStack(tmpDir);
    const names = stack.technologies.map((t) => t.name);

    expect(names).toContain('django');
    expect(names).toContain('postgresql');
  });
});

describe('detectStack – go.mod', () => {
  it('detects go version from go.mod', async () => {
    await writeFile(join(tmpDir, 'go.mod'), `module example.com/app\n\ngo 1.23\n`);

    const stack = await detectStack(tmpDir);
    const goTech = stack.technologies.find((t) => t.name === 'go');

    expect(goTech).toBeDefined();
    expect(goTech?.version).toBe('1.23');
    expect(stack.manifests).toContain('go.mod');
  });
});

describe('detectStack – Cargo.toml', () => {
  it('detects rust from Cargo.toml', async () => {
    await writeFile(
      join(tmpDir, 'Cargo.toml'),
      `[package]\nname = "myapp"\nedition = "2021"\n`,
    );

    const stack = await detectStack(tmpDir);
    const rustTech = stack.technologies.find((t) => t.name === 'rust');

    expect(rustTech).toBeDefined();
    expect(rustTech?.version).toBe('2021');
    expect(stack.manifests).toContain('Cargo.toml');
  });
});

describe('detectStack – empty project', () => {
  it('returns empty stack when no manifests are present', async () => {
    const stack = await detectStack(tmpDir);

    expect(stack.technologies).toHaveLength(0);
    expect(stack.manifests).toHaveLength(0);
  });
});
