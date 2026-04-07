/**
 * Computes SHA-256 hashes for all SKILL.md files in the catalog
 * and updates registry.yaml with the actual values.
 *
 * Run with: npm run update-hashes (from packages/catalog)
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogRoot = join(__dirname, '..');

async function computeSha256(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  // Normalize to LF so hashes match GitHub-served content regardless of OS
  const normalized = content.replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

async function main() {
  const registryPath = join(catalogRoot, 'registry.yaml');
  let registryRaw = await readFile(registryPath, 'utf-8');

  const skillsDir = join(catalogRoot, 'skills');
  const skillFolders = await readdir(skillsDir);

  for (const skillName of skillFolders) {
    const skillFile = join(skillsDir, skillName, 'SKILL.md');
    let hash: string;
    try {
      hash = await computeSha256(skillFile);
    } catch {
      console.warn(`  ⚠  No SKILL.md found for "${skillName}" — skipping`);
      continue;
    }

    // Replace "TBD" or existing hash on the line following `<skillName>:` block
    // Simple line-by-line replacement on the sha256 field for this skill
    const skillSection = new RegExp(
      `(${skillName}:[\\s\\S]*?sha256:\\s*")[^"]*(")`
    );
    if (skillSection.test(registryRaw)) {
      registryRaw = registryRaw.replace(skillSection, `$1${hash}$2`);
      console.log(`  ✓  ${skillName}: ${hash}`);
    } else {
      console.warn(`  ⚠  Could not find sha256 field for "${skillName}" in registry.yaml`);
    }
  }

  await writeFile(registryPath, registryRaw, 'utf-8');
  console.log('\nregistry.yaml updated with SHA-256 hashes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
