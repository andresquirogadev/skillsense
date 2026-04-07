# skillsense

## Stack
Runtime	Node.js ≥ 22	ES modules nativos, mismo requisito que autoskills
Lenguaje	TypeScript 5.x	Type safety en parser de manifiestos, mejor DX para contribuidores
CLI framework	Commander.js	Mínimo, sin magia. Alternativa: yargs si se necesita autocompletion
Multi-select	@inquirer/prompts	Checkbox interactivo bien mantenido. Evitar inquirer v8 (ESM issues)
Output	chalk + ora	Colors + spinner. Solo chalk si se quiere minimal como autoskills
Tests	Vitest	Nativo ESM, más rápido que Jest, mejor DX
Catálogo	YAML + GitHub raw	Sin backend propio en MVP. El catálogo vive en el repo
Publicación	npm + npx	npx skillsense = cero instalación previa. Fricción mínima
CI/CD	GitHub Actions	Tests en matrix OS (ubuntu, windows, macos) antes de publicar
Evals CI	GitHub Actions + custom	Script que valida la spec de SKILL.md y ejecuta smoke tests


## Description
skillsense es una CLI open-source que en un solo comando instala las skills correctas para el agente IA según el stack detectado automáticamente del proyecto. Cero configuración, soporte multi-lenguaje y multi-agente, con catálogo verificado y rollback automático.

En diciembre de 2025, Anthropic publicó la especificación de Agent Skills como estándar abierto. OpenAI adoptó el mismo formato para Codex CLI y ChatGPT. Hoy, las skills son el mecanismo estándar para especializar agentes IA: un directorio con un archivo SKILL.md que contiene instrucciones, scripts y recursos que el agente descarga y activa dinámicamente según el contexto del proyecto.

El problema concreto: configurar las skills correctas para un proyecto nuevo puede tomar entre 20 y 40 minutos si se hace manualmente. Hay que identificar qué tecnologías usa el proyecto, buscar las skills relevantes en repositorios dispersos, descargarlas en el lugar correcto y verificar que no hay conflictos. Esto es tiempo de fricción pura para el desarrollador.


npx skillsense

# Con flags opcionales:
npx skillsense --dry-run      # ver qué se instalaría sin instalar
npx skillsense --yes          # sin confirmación interactiva
npx skillsense --global       # instala en ~/.claude/skills/ en lugar del proyecto
npx skillsense --agent opencode  # fuerza el agente destino


## Estructura Principal

```
.
skillsense/
├── packages/
│   ├── cli/                    # CLI principal → npm: skillsense
│   │   ├── src/
│   │   │   ├── detector.ts     # parsea manifiestos, construye grafo de stack
│   │   │   ├── resolver.ts     # grafo → lista de skills + combos + conflictos
│   │   │   ├── installer.ts    # descarga, verifica hash, copia, rollback
│   │   │   ├── agents.ts       # detección de agente activo y rutas de destino
│   │   │   └── index.ts        # entry point: commander.js CLI
│   │   └── package.json
│   └── catalog/
│       ├── skills/             # una carpeta por skill
│       │   ├── nextjs/SKILL.md
│       │   ├── prisma/SKILL.md
│       │   └── ...             # 25+ skills en v1.0
│       ├── registry.yaml       # índice con hashes y metadatos
│       └── combos.yaml         # reglas de combos y conflictos
├── .github/
│   └── workflows/
│       ├── test.yml            # tests en matrix OS (ubuntu/windows/macos)
│       └── eval-skills.yml     # pipeline de evals para PRs de nuevas skills
├── docs/
└── README.md                   # con GIF de demo (crítico para distribución)

```

## Convenciones
3.1 Detector de stack
Lee los manifiestos del proyecto sin ejecutar nada ni hacer llamadas a red. Construye un grafo de dependencias con versiones y detecta patrones de stack (frameworks, ORMs, auth, testing, CI).

// Manifiestos que lee el detector
package.json         → React, Next.js, Vue, Nuxt, Svelte, Express, Prisma, Drizzle...
pyproject.toml       → Django, FastAPI, SQLAlchemy, pytest, Celery...
go.mod               → Gin, Echo, GORM, Fiber...
Cargo.toml           → Actix, Axum, Tokio, Diesel...
Gemfile              → Rails, Sinatra, RSpec...
.github/workflows/   → CI patterns (Actions, CircleCI, GitLab CI)

3.2 Motor de resolución
Mapea el grafo de stack a un catálogo de skills. Maneja tres casos: skills individuales (Next.js → skill-nextjs), combos predefinidos (Next.js + Prisma + Supabase instala las tres en orden con dependencias resueltas), y conflictos detectados (dos skills incompatibles generan advertencia antes de instalar).

# combos.yaml — ejemplo de regla de combo
combos:
  nextjs-fullstack:
    triggers: [next, prisma, supabase]
    skills: [nextjs, prisma, supabase, typescript]
    order: [typescript, prisma, supabase, nextjs]
    conflicts: [drizzle]  # no instalar si drizzle ya está presente

3.3 Instalador
Descarga las SKILL.md desde el catálogo, verifica integridad con SHA-256, y hace rollback completo si alguna instalación falla. Detecta el agente activo para colocar las skills en la ruta correcta.

// Rutas de destino por agente
Claude Code   →  .claude/skills/<skill-name>/SKILL.md
OpenCode      →  .opencode/skills/<skill-name>/SKILL.md
GitHub Copilot→  .github/skills/<skill-name>/SKILL.md
Global        →  ~/.claude/skills/  (o equivalente del agente)

3.4 Catálogo con evals
El catálogo es un archivo YAML versionado en el repositorio. Cada skill incluye: ruta al SKILL.md, hash SHA-256, versión semántica, fecha de última verificación, agentes compatibles y puntuación de calidad generada por el pipeline de CI.

# registry.yaml — entrada de ejemplo
skills:
  nextjs:
    version: "2.1.0"
    path: skills/nextjs/SKILL.md
    sha256: "a3f8c2..."
    agents: [claude-code, opencode, copilot, vs-code]
    triggers: [next, nextjs, "@next/core"]
    quality_score: 94
    last_eval: 2026-03-28


## Plan MVP — 2 semanas
Semana 1: núcleo funcional
Días 1–2	→  CLI básica: npx skillsense con banderas --yes, --dry-run, --global, --agent
→  Parser de manifiestos: package.json, pyproject.toml, go.mod, Cargo.toml, Gemfile
→  Detección de 15 tecnologías core (React, Next.js, Vue, Django, FastAPI, Rails, Go, Rust...)
Días 3–4	→  Catálogo inicial: 25 skills curadas manualmente en YAML versionado
→  Motor de resolución: mapeo stack → skills + sistema de combos + detección de conflictos
→  Instalador con copia atómica, verificación SHA-256 y rollback
Día 5	→  Tests de integración en proyectos reales: monorepo Next.js, proyecto FastAPI, API en Go
→  README con demo en GIF animado — crítico para tracción en redes
→  Validación en Windows via cross-spawn

Semana 2: calidad y lanzamiento
Días 6–7	→  Detección de agente activo (lee archivos de lock y configuración para inferir el agente en uso)
→  Soporte multi-agente: rutas de destino específicas por agente
→  Pipeline de evals en CI para PRs de nuevas skills (valida spec + smoke test)
Días 8–9	→  Multi-select interactivo para skills opcionales
→  Modo --update para actualizar skills ya instaladas a la última versión
→  Output coloreado con progress indicators y resumen final
Día 10	→  Publicar en npm como skillsense
→  Show HN: "Show HN: skillsense – one command installs the right AI skills for your project"
→  Hilo en X/Twitter con GIF de demo + PR abierto en github/awesome-copilot


## Estrategia de distribución
La distribución de herramientas CLI developer-focused sigue un patrón predecible: el GIF de demo es el activo de distribución más importante. Si el GIF no muestra el valor en 15 segundos, el proyecto no despega. Todos los canales listados dependen de ese GIF.

Semana del lanzamiento (días 10–12)
1.	GIF de demo en README: flujo completo en 15 segundos (cd proyecto → npx skillsense → detección → confirmación → skills instaladas). Grabado con Terminalizer o asciinema convertido a GIF.
2.	Show HN en Hacker News: publicar lunes o martes a las 9–10 AM ET. El título debe mencionar el problema y el comando exacto.
3.	Hilo técnico en X/Twitter: problema → solución → GIF → lista de stacks soportados. Tagear a @midudev, @leeerob, creadores de las tecnologías soportadas.
4.	Post en r/ClaudeAI y r/devtools: comunidad con alta receptividad a herramientas de productividad para agentes IA.

Semanas 3–4
5.	Product Hunt launch: preparar con 2 semanas de antelación. Hunter conocido, imágenes de calidad, tagline claro.
6.	PR en github/awesome-copilot: proponer skillsense como herramienta de instalación. Genera backlinks permanentes y descubrimiento orgánico.
7.	Mencionar compatibilidad con autoskills: posicionarse como complementario, no competidor. Abrir issue en midudev/autoskills ofreciendo colaboración en el catálogo.
