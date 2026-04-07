# skillsense

> Install the right AI skills for your project stack in one command.

```
npx skillsense
```

skillsense detects your project's tech stack from manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`) and installs the matching AI agent skills into your project — no configuration, no manual search.

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

## Recording the demo GIF

The demo GIF is the most important distribution asset. Record it with [Terminalizer](https://terminalizer.com/):

```bash
# Install Terminalizer globally
npm install -g terminalizer

# Start recording
terminalizer record demo --config terminalizer.config.yml

# In the recorded session, run:
cd /path/to/a-nextjs-prisma-project
npx skillsense

# Stop recording
# (Ctrl+D or type 'exit')

# Render to GIF
terminalizer render demo -o demo.gif

# Optimize (optional, requires gifsicle)
gifsicle --optimize=3 --colors 64 demo.gif -o demo-optimized.gif
```

Aim for a 15-second recording. The key moments to show:
1. The `npx skillsense` command
2. Stack detection output
3. The multi-select prompt
4. The green "Installed skills" summary

Recommended Terminalizer settings:
```yaml
# terminalizer.config.yml
cols: 100
rows: 26
frameDelay: auto
maxIdleTime: 2000
quality: 100
theme:
  background: '#1e1e2e'
  foreground: '#cdd6f4'
```

## License

MIT
