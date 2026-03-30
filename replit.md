# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (Node.js)
│   ├── food-classifier/    # React+Vite frontend
│   └── ml-service/         # Python FastAPI ML service (ViT model)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## App: Food Vision Classifier

A web app that allows users to upload food images and classifies them as pizza, steak, or sushi using a Vision Transformer (ViT) model.

### Architecture

- **Frontend** (`artifacts/food-classifier`): React+Vite app at `/` — drag-and-drop upload, confidence bars, stats, and history
- **API Server** (`artifacts/api-server`): Express 5 Node.js server at `/api` — proxies classify requests to the Python ML service, stores results in PostgreSQL
- **ML Service** (`artifacts/ml-service`): Python FastAPI server at port 8001 — runs `torchvision.models.vit_b_16` with fine-tuned classification head (pizza/steak/sushi)

### ML Service Notes

- Uses `vit_b_16` from torchvision with ImageNet pretrained weights
- Final linear head replaced with 3-class head (pizza, steak, sushi)
- To use your own trained weights, load them in `artifacts/ml-service/main.py` after model definition
- ML service runs on port 8001, accessed internally by the API server via `ML_SERVICE_URL` env var

### Workflows

- `ML Service` — runs Python uvicorn server (port 8001)
- `artifacts/api-server: API Server` — runs Node.js Express server (port 8080)
- `artifacts/food-classifier: web` — runs Vite dev server (port 22012)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Database

### `lib/db` (`@workspace/db`)

- `src/schema/classifications.ts` — stores each classification result (predicted_class, confidence, created_at)

## API Endpoints

- `POST /api/classify` — upload image (multipart/form-data with key `image`), returns ClassificationResult
- `GET /api/classify/history` — returns last 20 classifications
- `GET /api/classify/stats` — returns aggregated counts and avg confidence
