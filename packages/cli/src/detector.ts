import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface DetectedTech {
  name: string;
  version: string;
  source: string;
}

export interface DetectedStack {
  technologies: DetectedTech[];
  manifests: string[];
}

// Maps npm package names to canonical skill names
const NPM_SKILL_MAP: Record<string, string> = {
  next: 'nextjs',
  react: 'react',
  'react-dom': 'react',
  vue: 'vue',
  nuxt: 'nuxt',
  '@nuxt/core': 'nuxt',
  svelte: 'svelte',
  '@sveltejs/kit': 'svelte',
  typescript: 'typescript',
  tailwindcss: 'tailwindcss',
  '@prisma/client': 'prisma',
  prisma: 'prisma',
  'drizzle-orm': 'drizzle',
  'drizzle-kit': 'drizzle',
  '@supabase/supabase-js': 'supabase',
  '@supabase/ssr': 'supabase',
  pg: 'postgresql',
  postgres: 'postgresql',
  '@neondatabase/serverless': 'postgresql',
  express: 'express',
  fastify: 'nodejs',
  vitest: 'vitest',
  '@vitest/ui': 'vitest',
  '@playwright/test': 'playwright',
  playwright: 'playwright',
  stripe: 'stripe',
  '@stripe/stripe-js': 'stripe',
  '@cloudflare/workers-types': 'cloudflare',
  wrangler: 'cloudflare',
  '@vercel/analytics': 'vercel',
  '@vercel/og': 'vercel',
};

// Maps Python package names to canonical skill names
const PYTHON_SKILL_MAP: Record<string, string> = {
  fastapi: 'fastapi',
  django: 'django',
  'django-rest-framework': 'django',
  djangorestframework: 'django',
  flask: 'python',
  sqlalchemy: 'postgresql',
  psycopg2: 'postgresql',
  'psycopg2-binary': 'postgresql',
  asyncpg: 'postgresql',
  uvicorn: 'fastapi',
  pydantic: 'fastapi',
  pytest: 'python',
  celery: 'python',
  stripe: 'stripe',
};

async function parsePackageJson(cwd: string): Promise<DetectedTech[]> {
  const path = join(cwd, 'package.json');
  if (!existsSync(path)) return [];

  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    engines?: Record<string, string>;
  };

  const allDeps = {
    ...parsed.peerDependencies,
    ...parsed.devDependencies,
    ...parsed.dependencies,
  };

  const seen = new Set<string>();
  const techs: DetectedTech[] = [];

  for (const [dep, version] of Object.entries(allDeps)) {
    const skill = NPM_SKILL_MAP[dep];
    if (skill !== undefined && !seen.has(skill)) {
      seen.add(skill);
      techs.push({
        name: skill,
        version: version.replace(/^[\^~>=<*]/, '').trim() || 'latest',
        source: 'package.json',
      });
    }
  }

  // Always add nodejs if any JS project detected
  if (!seen.has('nodejs') && Object.keys(allDeps).length > 0) {
    const nodeEngineVersion = parsed.engines?.['node'] ?? '>=22';
    techs.push({ name: 'nodejs', version: nodeEngineVersion, source: 'package.json' });
  }

  // Detect TypeScript if tsconfig.json is present but typescript pkg is not in deps
  if (!seen.has('typescript') && existsSync(join(cwd, 'tsconfig.json'))) {
    techs.push({ name: 'typescript', version: 'detected', source: 'tsconfig.json' });
  }

  return techs;
}

async function parsePyprojectToml(cwd: string): Promise<DetectedTech[]> {
  const path = join(cwd, 'pyproject.toml');
  if (!existsSync(path)) return [];

  const raw = await readFile(path, 'utf-8');
  const seen = new Set<string>();
  const techs: DetectedTech[] = [];

  // Simple regex-based extraction — no TOML parser needed for MVP
  const depLine = /^([a-zA-Z0-9_-]+)\s*[=<>^~!*[{"']/m;
  for (const line of raw.split('\n')) {
    const match = line.match(depLine);
    if (!match) continue;
    const dep = match[1]!.toLowerCase().replace(/_/g, '-');
    const skill = PYTHON_SKILL_MAP[dep];
    if (skill !== undefined && !seen.has(skill)) {
      seen.add(skill);
      techs.push({ name: skill, version: 'detected', source: 'pyproject.toml' });
    }
  }

  if (techs.length > 0 && !seen.has('python')) {
    techs.push({ name: 'python', version: 'detected', source: 'pyproject.toml' });
  }

  return techs;
}

async function parseRequirementsTxt(cwd: string): Promise<DetectedTech[]> {
  const path = join(cwd, 'requirements.txt');
  if (!existsSync(path)) return [];

  const raw = await readFile(path, 'utf-8');
  const seen = new Set<string>();
  const techs: DetectedTech[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const pkgName = trimmed.split(/[=<>![\s]/)[0]!.toLowerCase().replace(/_/g, '-');
    const skill = PYTHON_SKILL_MAP[pkgName];
    if (skill !== undefined && !seen.has(skill)) {
      seen.add(skill);
      techs.push({ name: skill, version: 'detected', source: 'requirements.txt' });
    }
  }

  if (techs.length > 0 && !seen.has('python')) {
    techs.push({ name: 'python', version: 'detected', source: 'requirements.txt' });
  }

  return techs;
}

async function parseGoMod(cwd: string): Promise<DetectedTech[]> {
  const path = join(cwd, 'go.mod');
  if (!existsSync(path)) return [];

  const raw = await readFile(path, 'utf-8');
  const goVersionMatch = raw.match(/^go\s+([\d.]+)/m);
  const version = goVersionMatch?.[1] ?? 'detected';

  return [{ name: 'go', version, source: 'go.mod' }];
}

async function parseCargoToml(cwd: string): Promise<DetectedTech[]> {
  const path = join(cwd, 'Cargo.toml');
  if (!existsSync(path)) return [];

  const raw = await readFile(path, 'utf-8');
  const editionMatch = raw.match(/edition\s*=\s*"(\d+)"/);
  const version = editionMatch?.[1] ?? 'detected';

  return [{ name: 'rust', version, source: 'Cargo.toml' }];
}

// Maps Ruby gem names to canonical skill names
const GEMFILE_SKILL_MAP: Record<string, string> = {
  rails: 'rails',
  sinatra: 'ruby',
  rspec: 'ruby',
  'rspec-rails': 'rails',
  pg: 'postgresql',
  activerecord: 'rails',
  puma: 'rails',
  sidekiq: 'ruby',
  devise: 'rails',
  stripe: 'stripe',
};

async function parseGemfile(cwd: string): Promise<DetectedTech[]> {
  const path = join(cwd, 'Gemfile');
  if (!existsSync(path)) return [];

  const raw = await readFile(path, 'utf-8');
  const seen = new Set<string>();
  const techs: DetectedTech[] = [];

  // Match: gem 'rails', '~> 7.2' or gem "rails"
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*gem\s+['"]([^'"]+)['"]/);
    if (!match) continue;
    const gemName = match[1]!.toLowerCase();
    const versionMatch = line.match(/,\s*['"]~?>?\s*([\d.]+)/);
    const version = versionMatch?.[1] ?? 'detected';
    const skill = GEMFILE_SKILL_MAP[gemName];
    if (skill !== undefined && !seen.has(skill)) {
      seen.add(skill);
      techs.push({ name: skill, version, source: 'Gemfile' });
    }
  }

  if (techs.length > 0 && !seen.has('ruby')) {
    // Check for ruby version in .ruby-version or Gemfile
    const rubyVersionMatch = raw.match(/ruby\s+['"]?([\d.]+)/);
    const rubyVersion = rubyVersionMatch?.[1] ?? 'detected';
    techs.push({ name: 'ruby', version: rubyVersion, source: 'Gemfile' });
  }

  return techs;
}

export async function detectStack(cwd: string): Promise<DetectedStack> {
  const manifests: string[] = [];
  const allTechs: DetectedTech[] = [];
  const seen = new Set<string>();

  const parsers = [
    { file: 'package.json', fn: parsePackageJson },
    { file: 'pyproject.toml', fn: parsePyprojectToml },
    { file: 'requirements.txt', fn: parseRequirementsTxt },
    { file: 'go.mod', fn: parseGoMod },
    { file: 'Cargo.toml', fn: parseCargoToml },
    { file: 'Gemfile', fn: parseGemfile },
  ];

  for (const { file, fn } of parsers) {
    if (existsSync(join(cwd, file))) {
      manifests.push(file);
      const techs = await fn(cwd);
      for (const tech of techs) {
        if (!seen.has(tech.name)) {
          seen.add(tech.name);
          allTechs.push(tech);
        }
      }
    }
  }

  return { technologies: allTechs, manifests };
}
