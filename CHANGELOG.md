# Changelog

All notable changes to skillsense are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-04-06

### Added

- **Stack detection** — reads `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, and `Gemfile` without executing code
- **27 curated skills** — JavaScript/TypeScript (Next.js, React, Vue, Nuxt, Svelte, TypeScript, Tailwind CSS, Prisma, Drizzle, Supabase, PostgreSQL, Express, Node.js, Vitest, Playwright, Stripe, Vercel, Cloudflare), Python (FastAPI, Django), Go, Rust, Ruby (Ruby, Rails), Docker
- **13 combo rules** — detects common stacks (e.g. Next.js + Prisma + Supabase) and installs skills in the correct dependency order
- **Multi-agent support** — skills installed to the correct directory for Claude Code, OpenCode, GitHub Copilot, and VS Code
- **SHA-256 integrity verification** — every downloaded skill is verified against the catalog hash
- **Atomic rollback** — any failed install rolls back the entire operation cleanly
- **Interactive multi-select** — optional skills presented as a checkbox list before install
- **CLI flags** — `--yes`, `--dry-run`, `--global`, `--agent <name>`, `--catalog-url <url>`
- **CI/CD** — test matrix on Ubuntu/Windows/macOS, eval pipeline for skill PRs, weekly staleness check
