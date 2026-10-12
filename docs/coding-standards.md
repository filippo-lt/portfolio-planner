# Coding standards

Short rules. Tools enforce most of them; the rest are for humans and reviewers.

## Tools

| Tool | What it does | Command |
|---|---|---|
| ESLint (`eslint.config.mjs`) | Bugs and bad patterns (Next.js, React, TypeScript rules) | `npm run lint` / `npm run lint:fix` |
| Prettier (`.prettierrc.json`) | Formatting, Tailwind class order | `npm run format` / `npm run format:check` |
| TypeScript (`strict`) | Types, incl. Next route types (`next typegen`) | `npm run typecheck` |
| Vitest | Unit tests | `npm test` / `npm run test:watch` |
| Husky + lint-staged | On commit: ESLint fix + Prettier on staged files | runs automatically |
| GitHub Actions (`.github/workflows/ci.yml`) | lint, format, types, tests, build on every PR | runs automatically |

Before you push: `npm run check` (everything CI runs except the build).

```
commit ──► pre-commit hook (staged files: eslint --fix, prettier)
push / PR ──► CI: lint → format:check → typecheck → test → build
```

## Code

- **TypeScript only.** No `any` unless there is a comment saying why. Prefer `import type` / inline `type` imports.
- **Equality:** `===` always. `== null` is allowed to check `null` and `undefined` together.
- **No `console.log`** in committed code. `console.warn` / `console.error` are fine for real problems.
- **Unused things:** remove them. If a parameter must stay, prefix it with `_`.
- **Pure logic lives in `src/lib/`** with no React and no network, so it is easy to test. Network calls only through `src/lib/data/` and API routes.
- **Server first.** Add `'use client'` only when a component needs state, effects or browser APIs. Secrets never reach client code.
- **Missing data** is shown as `NA` ("Dato non disponibile"), never estimated (see `README.md` hard rules).

## Naming and files

| Thing | Style | Example |
|---|---|---|
| React component file | `PascalCase.tsx` | `ReportView.tsx` |
| Lib module | `camelCase.ts` | `profileFit.ts` |
| Test | `src/lib/__tests__/<module>.test.ts` | `metrics.test.ts` |
| Constants | `UPPER_SNAKE_CASE` | `NA` |
| Imports from `src` | `@/` alias | `import { fmtPct } from '@/lib/format'` |

UI text is Italian; code, comments, commits and docs are English.

## Tests

- Every new function in `src/lib/` gets tests. Bug fix → first a test that fails, then the fix.
- Tests must not call the network. Mock the provider.

## Git

- Branch per change: `feat/…`, `fix/…`, `perf/…`, `chore/…`, `docs/…`.
- Small PRs, one topic each. CI must be green before merge.
- Commit message: short summary line in imperative mood ("Add …", "Fix …").
