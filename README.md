# Desktop Assistant Monorepo

The desktop work-assistant powered by an AI agent system, persistent 2D pet on screen, local append-only SQLite action ledger, compensating-action undo, and application-layer approval gate.

This repository is structured as a **Spec-Driven Development (SDD)** monorepo using **pnpm workspaces** and **Turborepo**.

---

## 1. Repository Layout & Ownership

```text
desktop-assistant/
├── apps/
│   ├── desktop/              # Electron shell (main, preload, renderer-pet, renderer-app)
│   └── backend/              # Fastify + PostgreSQL peer backend service
├── packages/
│   └── contracts/            # Generated TypeScript types and schemas from spec corpus
├── connectors/               # Connectors-as-data workspace (reserved for F7+)
├── native/
│   ├── win32-window/         # Windows native window integration (Rust / napi-rs)
│   └── macos-window/         # macOS native window integration (Objective-C++ / node-gyp)
├── tooling/
│   ├── build-check/          # 4 non-vacuous build checks CLI (harness, sqlite, packaging, BOM)
│   └── native-target.mjs     # Cross-platform dispatcher for native targets
├── docs/                     # Specifications, raw idea, and roadmap
├── spikes/                   # Empirical spike reports (SP-0 through SP-21)
└── tooling/                  # Repository build and packaging checks
```

### Workspace Boundaries

- **`@desktop-assistant/contracts`**: Code-generated from `docs/spec/**/contracts/`. Never hand-copied.
- **`@desktop-assistant/desktop`**: Two-window Electron desktop application. Transparent, always-on-top pet window and React management window.
- **`@desktop-assistant/backend`**: Fastify service providing database health probes, rate limiting, and public endpoints.
- **`@desktop-assistant/win32-window` & `@desktop-assistant/macos-window`**: Target-only native capability skeletons conforming to `window-integration-module@1.0.0`. Do not compile during clean-machine builds.
- **`@desktop-assistant/build-check`**: Enforces critical constitutional invariants on harness pins, SQLite prebuilds, packaging asar unpack rules, and absence of UTF-8 BOM.

---

## 2. Getting Started & Commands

### Prerequisites

- **Node.js**: `24.21.0` (managed via `.nvmrc`)
- **pnpm**: `12.4.1` (managed via `package.json#packageManager`)
- **Docker & Docker Compose**: For local PostgreSQL instance

### Setup

```bash
# Install dependencies with frozen lockfile (clean machine proof: no C++ toolchain required)
pnpm install --frozen-lockfile
```

### Development

```bash
# Run desktop application (Vite servers for pet/app renderers + Electron)
pnpm dev

# Start development PostgreSQL container (port 54320)
pnpm db:up

# Run database migrations
pnpm db:migrate

# Start backend service with hot-reload (port 4000)
pnpm dev:backend

# Stop development PostgreSQL container
pnpm db:down
```

### Contracts Generation & Drift Check

```bash
# Regenerate TypeScript types and constants from docs/spec
pnpm contracts:generate

# Verify contracts are in sync with docs/spec (fails if drifted)
pnpm contracts:check
```

### Lint, Typecheck, Test, and Build

```bash
# Lint code and check for UTF-8 BOM
pnpm lint

# Typecheck all packages
pnpm typecheck

# Run test suites across monorepo
pnpm test

# Build all packages
pnpm build

# Run all 4 hard build checks
pnpm build:check
```

### Native Modules & Unsigned Packaging

```bash
# Compile target native addon (Windows or macOS; skips on Linux with exit code 0)
pnpm native:build

# Run target native addon tests
pnpm native:test

# Package unsigned desktop distribution and run artifact verification check
pnpm package:unsigned
```

---

## 3. Adding Features: The Additive Extension Seams

Future features (F1 through F24) are designed to be purely additive. New capabilities add a dedicated package in `packages/` or `connectors/`, and register with the composition roots in **one line only**:

### Desktop Main Process Composition Root (`apps/desktop/main/index.ts`)

```ts
await app.whenReady();
const context = new DesktopContext();

await registerLifecycleModule(context);
await registerLocaleModule(context);
await registerPetWindowModule(context);
await registerAppWindowModule(context);
await registerTrayModule(context);
await registerUpdaterSafetyModule(context);

// Future features add exactly one registration line here:
// await registerLedgerModule(context);    // F01
// await registerJobManagerModule(context); // F02
```

### Backend Composition Root (`apps/backend/src/app.ts`)

```ts
await app.register(databasePlugin, { databaseUrl: config.databaseUrl });
await app.register(rateLimitPlugin, { rateLimit: config.rateLimit });
await app.register(publicRoutes);

// Future features add exactly one registration line here:
// await app.register(authRoutes);         // F10
// await app.register(syncRoutes);         // F22
```

---

## 4. Software Rendering & Opt-in Native Compilation

### Software Rendering Override (RISK-035)

In VM, RDP, headless, or remote desktop environments, hardware acceleration can cause transparency artifacts or black window frames. The desktop shell automatically detects these environments:

- Explicit override: Set `DESKTOP_ASSISTANT_SOFTWARE_RENDERING=1`
- CI runs: Detected via `CI=true` or `GITHUB_ACTIONS=true`
- Headless Linux: Detected via absence of `DISPLAY` and `WAYLAND_DISPLAY`
- Windows Remote Desktop: Detected via `SESSIONNAME` starting with `RDP-`/`ICA-` or presence of `CLIENTNAME`

When detected, `app.disableHardwareAcceleration()` is invoked before `app.whenReady()`.

### Native Compilation Is Opt-In

Normal `pnpm install`, `pnpm build`, and `pnpm test` **never invoke C++ or Rust compilers**. `better-sqlite3@13.0.3` uses bundled Node-API prebuilds and has build scripts disabled in `pnpm-workspace.yaml`. Native module compilation is only invoked via explicit `pnpm native:build` on supported platforms (Windows with MSVC/Rust, macOS with Xcode/node-gyp).

---

## 5. Specification to Implementation Mapping

| Specification / Concern | Spec Contract / File | Implementation Target |
|---|---|---|
| Monorepo & Toolchain | ADR-001..009, prd-mvp §14.2 | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` |
| Contract Discovery & Types | All `docs/spec/**/contracts/*.md` | `packages/contracts/scripts/discover-contracts.ts`, `generate.ts`, `check.ts` |
| Application Shell & Lifecycle | `capabilities/platform/spec.md`, req-008 | `apps/desktop/main/index.ts`, `apps/desktop/main/lifecycle/` |
| Pet Window (Transparent, Topmost) | `capabilities/pet/spec.md`, req-005, SP-7 | `apps/desktop/main/pet-window/`, `apps/desktop/renderer-pet/` |
| Management Window (Dock Presence) | `capabilities/app/spec.md`, req-023, SP-7 | `apps/desktop/main/app-window/`, `apps/desktop/renderer-app/` |
| Tray Integration & Close-to-Tray | `capabilities/app/spec.md`, req-008 | `apps/desktop/main/tray/register-tray-module.ts` |
| Localization Layer (vi / en) | `capabilities/uix/spec.md`, req-001 | `apps/desktop/i18n/resources.ts`, `apps/desktop/main/locale/` |
| Pi Agent SDK Exact Pins | `capabilities/agent/spec.md`, req-007, SP-6 | `@earendil-works/pi-agent-core@0.85.1`, `@earendil-works/pi-ai@0.85.1` |
| SQLite Prebuilt Binding | `capabilities/platform/spec.md`, req-013, SP-12 | `better-sqlite3@13.0.3` with Node-API prebuilds |
| Backend Health & Version API | req-020, `public-service-endpoints@0.1.0` | `apps/backend/src/routes/public.ts`, `apps/backend/src/plugins/` |
| Native Window Integration | req-008, req-023, `window-integration-module@1.0.0` | `native/win32-window/`, `native/macos-window/`, `tooling/native-target.mjs` |
| Invariant Hard Build Checks | RISK-035, 046, 047, 048, 078 | `tooling/build-check/src/checks/` (harness, sqlite, packaging, bom) |
| CI & Unsigned Packaging Proof | req-016, SP-16 | `.github/workflows/ci.yml`, `apps/desktop/scripts/package-unsigned.mjs` |

## License

All rights reserved. This source is published to be read, not to be used; see [LICENSE](LICENSE).
