# Repo Structure

Verse is a pnpm monorepo. All workspace packages are defined in `pnpm-workspace.yaml`.

## Layout

```
verse/
├── pnpm-workspace.yaml        # workspace definition
├── package.json               # root scripts (dev, build, lint, typecheck)
├── .npmrc                     # engine-strict=true
├── .gitignore
├── AGENTS.md
│
├── apps/                      # deployable applications
│   └── web/                   # @verse/web — Vite + React + Tailwind v4
│       ├── index.html
│       ├── vite.config.ts     # React + Tailwind plugins
│       ├── tsconfig.json      # extends @verse/tsconfig/react.json
│       ├── eslint.config.js   # extends @verse/eslint-config/react
│       └── src/
│           ├── main.tsx       # entry point
│           ├── App.tsx        # root component
│           └── index.css      # Tailwind import
│
├── packages/                  # shared internal packages
│   ├── eslint-config/         # @verse/eslint-config
│   │   ├── base.js            # shared rules (TS strict, consistent imports)
│   │   ├── react.js           # extends base — for React apps
│   │   └── node.js            # extends base — for Node servers
│   ├── tsconfig/              # @verse/tsconfig
│   │   ├── base.json          # strict, ESNext, bundler resolution
│   │   ├── react.json         # extends base + JSX + DOM libs
│   │   └── node.json          # extends base + Node types
│   └── types/                 # @verse/types — shared TypeScript types
│       ├── tsconfig.json
│       └── src/index.ts
│
└── agents/                    # agent definitions
    └── repo-structure.md
```

## Workspace Packages

| Package | Name | Purpose |
|---|---|---|
| `apps/web` | `@verse/web` | Vite + React + Tailwind v4 webapp |
| `packages/eslint-config` | `@verse/eslint-config` | Shared ESLint configs (base, react, node) |
| `packages/tsconfig` | `@verse/tsconfig` | Shared TypeScript configs (base, react, node) |
| `packages/types` | `@verse/types` | Shared type definitions |

## How Packages Connect

- Apps depend on shared packages via `"workspace:*"` protocol
- ESLint configs are layered: apps extend a preset (`react` or `node`) and add app-specific rules
- TSConfig works the same way: apps extend a preset and override as needed
- `@verse/types` is consumed by any app or package that needs shared type definitions

## Root Scripts

| Script | Command | Behavior |
|---|---|---|
| `dev` | `pnpm run dev` | Runs `dev` in all apps in parallel |
| `build` | `pnpm run build` | Runs `build` recursively in dependency order |
| `lint` | `pnpm run lint` | Runs `lint` recursively |
| `typecheck` | `pnpm run typecheck` | Runs `typecheck` recursively |

## Key Conventions

- **Tailwind v4** — uses the Vite plugin and CSS-first config (`@import "tailwindcss"`)
- **ESLint v9** — flat config format (`eslint.config.js`)
- **TypeScript** — strict mode, bundler module resolution
- **Node >= 18** — enforced via `engines` in root `package.json`
