import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { DetectedStack } from './detector.js';

export interface SkillEntry {
  name: string;
  version: string;
  url: string;
  sha256: string;
  agents: string[];
}

export interface RegistrySkill {
  version: string;
  path: string;
  sha256: string;
  agents: string[];
  triggers: string[];
  quality_score: number;
  last_eval: string;
}

export interface Registry {
  skills: Record<string, RegistrySkill>;
}

export interface ComboRule {
  triggers: string[];
  skills: string[];
  order: string[];
  conflicts?: string[];
}

export interface CombosConfig {
  combos: Record<string, ComboRule>;
}

export interface ResolvedSkills {
  skills: SkillEntry[];
  conflicts: string[];
  appliedCombos: string[];
}

export const DEFAULT_CATALOG_URL =
  process.env['SKILLSENSE_CATALOG_URL'] ??
  'https://raw.githubusercontent.com/skillsense/skillsense/main/packages/catalog';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}: ${response.statusText}`);
  }
  return response.text();
}

async function readLocalOrFetch(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith('file://')) {
    // Convert file:// URL to a local file path (cross-platform)
    const { fileURLToPath } = await import('node:url');
    return readFile(fileURLToPath(pathOrUrl), 'utf-8');
  }
  if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
    return readFile(pathOrUrl, 'utf-8');
  }
  return fetchText(pathOrUrl);
}

export async function loadRegistry(baseUrl: string = DEFAULT_CATALOG_URL): Promise<Registry> {
  const registryUrl = `${baseUrl}/registry.yaml`;
  const raw = await readLocalOrFetch(registryUrl);
  return yaml.load(raw) as Registry;
}

export async function loadCombos(baseUrl: string = DEFAULT_CATALOG_URL): Promise<CombosConfig> {
  const combosUrl = `${baseUrl}/combos.yaml`;
  const raw = await readLocalOrFetch(combosUrl);
  return yaml.load(raw) as CombosConfig;
}

export function buildSkillUrl(skillPath: string, baseUrl: string): string {
  return `${baseUrl}/${skillPath}`;
}

export function resolveSkills(
  stack: DetectedStack,
  registry: Registry,
  combos: CombosConfig,
  baseUrl: string = DEFAULT_CATALOG_URL,
): ResolvedSkills {
  const detectedNames = new Set(stack.technologies.map((t) => t.name));
  const selectedSkills = new Map<string, SkillEntry>();
  const conflicts: string[] = [];
  const appliedCombos: string[] = [];

  // Check combos first — they take priority and install skills in defined order
  for (const [comboName, combo] of Object.entries(combos.combos)) {
    const triggersMatch = combo.triggers.every((t) => detectedNames.has(t));
    if (!triggersMatch) continue;

    // Check for conflicting detected technologies
    const conflictingTech = (combo.conflicts ?? []).find((c) => detectedNames.has(c));
    if (conflictingTech !== undefined) {
      conflicts.push(
        `Combo "${comboName}" skipped: conflicts with detected "${conflictingTech}"`,
      );
      continue;
    }

    appliedCombos.push(comboName);

    for (const skillName of combo.order) {
      if (!selectedSkills.has(skillName)) {
        const entry = registry.skills[skillName];
        if (entry !== undefined) {
          selectedSkills.set(skillName, {
            name: skillName,
            version: entry.version,
            url: buildSkillUrl(entry.path, baseUrl),
            sha256: entry.sha256,
            agents: entry.agents,
          });
        }
      }
    }
  }

  // Add individual skills not covered by any combo
  for (const tech of stack.technologies) {
    if (!selectedSkills.has(tech.name)) {
      const entry = registry.skills[tech.name];
      if (entry !== undefined) {
        selectedSkills.set(tech.name, {
          name: tech.name,
          version: entry.version,
          url: buildSkillUrl(entry.path, baseUrl),
          sha256: entry.sha256,
          agents: entry.agents,
        });
      }
    }
  }

  return {
    skills: Array.from(selectedSkills.values()),
    conflicts,
    appliedCombos,
  };
}
