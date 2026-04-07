# skillsense

[![npm version](https://img.shields.io/npm/v/skillsense)](https://www.npmjs.com/package/skillsense)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js ≥22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

> Install the right AI skills for your project stack in one command.

```
npx skillsense
```

skillsense detects your project's tech stack from manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`) and installs the matching AI agent skills into your project — no configuration, no manual search.

## Demo

```
$ npx skillsense

✦ skillsense

✔ Detected stack from package.json
  • nextjs 15.1.0 (package.json)
  • prisma 5.22.0 (package.json)
  • typescript detected (tsconfig.json)
  • nodejs >=22 (package.json)

✔ Found 3 skills
  Applied combos: nextjs-prisma

  Target: Claude Code  →  .claude/skills

? Select skills to install: (Press <space> to select, <a> to toggle, <i> to invert selection)
❯◉ typescript@1.0.0
 ◉ prisma@1.0.0
 ◉ nextjs@1.0.0

✔ Installed 3 skills

Installed skills:
  ✓ typescript
  ✓ prisma
  ✓ nextjs
```

## Flags

| Flag | Description |
|---|---|
| `--yes` / `-y` | Skip interactive confirmation, install all resolved skills |
| `--dry-run` | Show detected stack and skills to install, make no changes |
| `--global` | Install skills globally (`~/.claude/skills/`) instead of the project |
| `--agent <name>` | Force target agent: `claude-code`, `opencode`, `copilot`, `vs-code` |
| `--catalog-url <url>` | Override the catalog base URL (useful for forks or air-gapped environments) |

## Supported Stacks

| Category | Skills |
|---|---|
| **JavaScript / TypeScript** | nextjs, react, vue, nuxt, svelte, typescript, tailwindcss, express, nodejs |
| **Databases & ORMs** | prisma, drizzle, supabase, postgresql |
| **Python** | fastapi, django, python |
| **Ruby** | ruby, rails |
| **Testing** | vitest, playwright |
| **Payments** | stripe |
| **Infrastructure** | vercel, cloudflare, docker |
| **Other Languages** | go, rust |

## Supported Agents

| Agent | Skills installed to |
|---|---|
| Claude Code | `.claude/skills/<skill>/SKILL.md` |
| OpenCode | `.opencode/skills/<skill>/SKILL.md` |
| GitHub Copilot | `.github/skills/<skill>/SKILL.md` |
| VS Code | `.github/skills/<skill>/SKILL.md` |
| Global (`--global`) | `~/.claude/skills/<skill>/SKILL.md` |

Agent is detected automatically from project files (`.claude/`, `.opencode/`, `.github/copilot-instructions.md`, `.vscode/`). When no agent is detected, Claude Code is used as default.

## How it works

1. **Detect** — reads manifest files without executing code or making network requests
2. **Resolve** — maps detected technologies to skills using `registry.yaml`, applies combo rules from `combos.yaml`
3. **Confirm** — shows an interactive multi-select (skipped with `--yes`)
4. **Install** — downloads each `SKILL.md` from the catalog, verifies SHA-256, writes to the agent's skills directory
5. **Rollback** — if any step fails, all partially-written files are removed and the project state is unchanged

## Contributing a skill

1. Fork the repo
2. Create `packages/catalog/skills/<name>/SKILL.md`
3. Add the entry to `packages/catalog/registry.yaml`
4. Run `npm run update-hashes --workspace=packages/catalog` to compute the SHA-256 hash
5. Open a PR — the `eval-skills` CI pipeline validates the format and registry integrity

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

## License

MIT
