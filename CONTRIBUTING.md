# Contributing to skillsense

Thank you for helping keep the catalog accurate. This document explains the complete lifecycle of a skill — from proposing it to keeping it fresh over time.

## What is a skill?

A skill is a `SKILL.md` file containing concise, actionable guidance for an AI agent working with a specific technology. A good skill answers: _"what does an expert developer do (and avoid) when working with this library?"_

---

## Skill quality bar

Before opening a PR, verify your skill meets every requirement below. The CI pipeline (`eval-skills.yml`) enforces these automatically:

| Requirement | Detail |
|---|---|
| Level-1 heading | File must start with `# Technology Name` |
| ≥ 3 sections | At least 3 `## Heading` sub-sections covering distinct topics |
| ≥ 150 words | Ensures real content, not stubs |
| ≥ 1 code block | At least one ` ``` ` fenced example |
| No placeholders | Must not contain `TBD`, `TODO:`, or `placeholder` |
| registry.yaml entry | Must have a corresponding entry with all required fields |

---

## Adding a new skill

### 1. Create the SKILL.md

```
packages/catalog/skills/<skill-name>/SKILL.md
```

Structure your skill file with:

```markdown
# SkillName

One-sentence description of when this skill applies.

## Core Concept or Setup

...guidance + code example...

## Common Patterns

...guidance + code example...

## What to Avoid

...anti-patterns and why...

## Additional Section (if applicable)

...
```

### 2. Add an entry to `registry.yaml`

```yaml
skills:
  # ... existing entries ...

  your-skill:
    version: "1.0.0"
    path: "skills/your-skill/SKILL.md"
    sha256: "TBD"                         # filled by maintainer before release
    agents: [claude-code, opencode, copilot, vs-code]
    triggers: [package-name, "scoped/package"]   # package/gem/module names that trigger this skill
    quality_score: 90                     # initial estimate; updated by eval pipeline
    last_eval: "YYYY-MM-DD"              # today's date
```

`triggers` are the exact package names (from `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, or `Gemfile`) that cause the skill to be included. Use the lowest common denominator — the core package, not build-tooling aliases.

### 3. Open a pull request

The PR will run two CI jobs:
- **validate-registry** — checks all required fields in `registry.yaml` and that SKILL.md files exist
- **smoke-test-skills** — runs the quality checks in the table above against every changed `SKILL.md`

Both must pass before merge.

---

## Updating an existing skill

When a library ships a breaking change, a new best practice emerges, or you spot outdated guidance:

1. Edit the relevant `SKILL.md`
2. Update `registry.yaml` for that skill:
   - Increment `version` (e.g. `"1.2.0"` → `"1.3.0"`) if guidance changed
   - Update `last_eval` to today's date
   - Adjust `quality_score` if the skill improved significantly
3. Open a PR — same CI gates apply

---

## The staleness pipeline

A GitHub Action (`staleness-check.yml`) runs every Monday. It reads `last_eval` from `registry.yaml` and opens an issue listing every skill that hasn't been reviewed in **90+ days**.

If you see that issue, the expected response is:
1. Claim one or more skills by commenting on the issue
2. Review the upstream changelog since `last_eval`
3. Update the skill file if anything changed
4. Update `last_eval` (and `version` if content changed)
5. Open a PR

If a skill is reviewed and nothing needs changing, just update `last_eval` so the clock resets.

---

## Multi-agent compatibility

skills in this catalog target all four supported agents:

| Agent | Skills directory | Detection trigger |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `.claude/` directory exists |
| OpenCode | `.opencode/skills/<name>/SKILL.md` | `.opencode/` directory exists |
| GitHub Copilot | `.github/skills/<name>/SKILL.md` | `.github/copilot-instructions.md` exists |
| VS Code | `.vscode/skills/<name>/SKILL.md` | `.vscode/` directory exists |

If your skill relies on agent-specific features, note it clearly in the SKILL.md and restrict `agents` in `registry.yaml`.

---

## Multi-language triggers

The detector reads these manifests to identify your skill's triggers:

| Manifest | Language/Ecosystem |
|---|---|
| `package.json` | Node.js, JavaScript, TypeScript |
| `pyproject.toml` / `requirements.txt` | Python |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `Gemfile` | Ruby |

If your technology appears in multiple ecosystems (e.g. a database client exists for many languages), create separate skills per ecosystem with a shared naming convention (`postgresql-python`, `postgresql-rails`) and list them all in `combos.yaml` if they are commonly used together.

---

## Repo structure reference

```
packages/
  catalog/
    skills/           # one directory per skill
      nextjs/
        SKILL.md
      rails/
        SKILL.md
      ...
    registry.yaml     # index: hashes, triggers, quality scores, last_eval dates
    combos.yaml       # multi-skill bundles and conflict rules
  cli/
    src/
      detector.ts     # reads manifests → DetectedTech[]
      resolver.ts     # DetectedTech[] → SkillEntry[] (uses registry + combos)
      installer.ts    # downloads SKILL.md files, verifies SHA-256, rollback
      agents.ts       # detects active agent → target directory
```

Adding a new language ecosystem requires:
1. A new parser function in `detector.ts` (and a corresponding `LANGUAGE_SKILL_MAP`)
2. Add `{ file: 'ManifestFile', fn: parseXxx }` to the parsers array in `detectStack()`
3. A matching test in `packages/cli/tests/detector.test.ts`
