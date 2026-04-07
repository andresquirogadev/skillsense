#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { checkbox } from '@inquirer/prompts';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { detectStack } from './detector.js';
import { loadRegistry, loadCombos, resolveSkills, DEFAULT_CATALOG_URL } from './resolver.js';
import { installSkills, skillIsInstalled } from './installer.js';
import { getAgentInfo } from './agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

program
  .name('skillsense')
  .description('Install the right AI skills for your project stack')
  .version(pkg.version)
  .option('-y, --yes', 'Skip interactive confirmation', false)
  .option('--dry-run', 'Show detected stack and skills without installing', false)
  .option('--global', 'Install skills globally (~/.claude/skills/)', false)
  .option('--agent <name>', 'Force target agent (claude-code, opencode, copilot, vs-code)')
  .option('--catalog-url <url>', 'Override the catalog base URL')
  .action(async (options: {
    yes: boolean;
    dryRun: boolean;
    global: boolean;
    agent?: string;
    catalogUrl?: string;
  }) => {
    const cwd = process.cwd();
    const catalogUrl = options.catalogUrl ?? DEFAULT_CATALOG_URL;

    console.log(chalk.bold.cyan('\n✦ skillsense\n'));

    // ── 1. Detect stack ──────────────────────────────────────────────────────
    const detectSpinner = ora('Detecting project stack…').start();
    let stack;
    try {
      stack = await detectStack(cwd);
      detectSpinner.succeed(
        `Detected stack from ${chalk.dim(stack.manifests.join(', '))}`,
      );
    } catch (err) {
      detectSpinner.fail(chalk.red(`Failed to detect stack: ${(err as Error).message}`));
      process.exit(1);
    }

    if (stack.technologies.length === 0) {
      console.log(chalk.yellow('No supported technologies detected in this project.'));
      process.exit(0);
    }

    console.log(chalk.dim('\nDetected technologies:'));
    for (const tech of stack.technologies) {
      console.log(
        chalk.dim(`  • ${tech.name} ${chalk.italic(tech.version)}`) +
          chalk.dim(` (${tech.source})`),
      );
    }

    if (options.dryRun) {
      console.log(chalk.cyan('\n[dry-run] Dependency graph built. No changes will be made.\n'));
    }

    // ── 2. Resolve skills ────────────────────────────────────────────────────
    const resolveSpinner = ora('Resolving skills from catalog…').start();
    let resolved;
    try {
      const [registry, combos] = await Promise.all([
        loadRegistry(catalogUrl),
        loadCombos(catalogUrl),
      ]);
      resolved = resolveSkills(stack, registry, combos, catalogUrl);
      resolveSpinner.succeed(`Found ${resolved.skills.length} skill(s)`);
    } catch (err) {
      resolveSpinner.fail(chalk.red(`Failed to load catalog: ${(err as Error).message}`));
      process.exit(1);
    }

    if (resolved.conflicts.length > 0) {
      console.log(chalk.yellow('\nConflicts detected:'));
      for (const c of resolved.conflicts) {
        console.log(chalk.yellow(`  ⚠  ${c}`));
      }
    }

    if (resolved.appliedCombos.length > 0) {
      console.log(
        chalk.blue(`\nApplied combos: ${resolved.appliedCombos.join(', ')}`),
      );
    }

    if (resolved.skills.length === 0) {
      console.log(chalk.yellow('\nNo matching skills found in catalog for this project.'));
      process.exit(0);
    }

    // ── 3. Determine destination ─────────────────────────────────────────────
    const agentInfo = getAgentInfo(cwd, {
      ...(options.agent !== undefined && { agent: options.agent }),
      global: options.global,
    });
    console.log(
      chalk.dim(`\nTarget: ${agentInfo.displayName}  →  ${agentInfo.skillsDir}`),
    );

    if (options.dryRun) {
      console.log(chalk.cyan('\nSkills to install:'));
      for (const skill of resolved.skills) {
        console.log(chalk.cyan(`  • ${skill.name}@${skill.version}`));
      }
      console.log(chalk.cyan('\n[dry-run] No changes made.\n'));
      process.exit(0);
    }

    // ── 4. Interactive selection ──────────────────────────────────────────────
    let selectedSkills = resolved.skills;

    if (!options.yes) {
      const alreadyInstalled = await Promise.all(
        resolved.skills.map(async (s) => ({
          name: s.name,
          installed: await skillIsInstalled(agentInfo.skillsDir, s.name),
        })),
      );
      const installedSet = new Set(
        alreadyInstalled.filter((x) => x.installed).map((x) => x.name),
      );

      try {
        const choices = resolved.skills.map((skill) => ({
          name: `${skill.name}@${skill.version}${installedSet.has(skill.name) ? chalk.dim(' (already installed)') : ''}`,
          value: skill.name,
          checked: true,
        }));

        const selected = await checkbox({
          message: 'Select skills to install:',
          choices,
        });

        selectedSkills = resolved.skills.filter((s) => selected.includes(s.name));
      } catch {
        console.log(chalk.yellow('\nInstallation cancelled.'));
        process.exit(0);
      }
    }

    if (selectedSkills.length === 0) {
      console.log(chalk.yellow('\nNo skills selected. Exiting.'));
      process.exit(0);
    }

    // ── 5. Install ────────────────────────────────────────────────────────────
    console.log('');
    const installSpinner = ora(`Installing ${selectedSkills.length} skill(s)…`).start();

    const result = await installSkills(selectedSkills, agentInfo.skillsDir, {
      onProgress(skill, status) {
        if (status === 'done') {
          installSpinner.text = `Installing… ${chalk.green(`✓ ${skill}`)}`;
        } else if (status === 'error') {
          installSpinner.text = `Installing… ${chalk.red(`✗ ${skill}`)}`;
        }
      },
    });

    if (result.failed) {
      installSpinner.fail(chalk.red(`Installation failed: ${result.failed}`));
      console.log(chalk.yellow('Rollback complete — project state is unchanged.'));
      process.exit(1);
    }

    installSpinner.succeed(`Installed ${result.installed.length} skill(s)`);
    console.log(chalk.green('\nInstalled skills:'));
    for (const name of result.installed) {
      console.log(chalk.green(`  ✓ ${name}`));
    }
    console.log('');
  });

program.parse();
