# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains the Cloudflare VibeSDK template catalog - a dynamic template generation system for AI-assisted application development. Templates are not stored as complete projects but are dynamically generated from base references and overlay configurations.

### Key Concepts

**Dynamic Generation Architecture**: Templates are generated through a three-tier system:
1. **Base References** (`reference/`) - Clean starter templates (vite-reference, next-reference, minimal-js-reference)
2. **Template Definitions** (`definitions/`) - YAML configs + overlay files that customize base references
3. **Generated Output** (`build/`) - Final templates created by applying overlays to base references

**Verification System**: The `originals/` directory contains ground-truth templates for parity validation. Use `tools/generate_templates.py --verify` to ensure generated templates match known-good originals.

## Directory Structure

```
reference/              # Base reference templates
├── vite-reference/     # Base Vite/React template with full component library
├── next-reference/     # Base Next.js template
└── minimal-js-reference/  # Minimal JavaScript starter

definitions/            # Template definitions and overlays
├── *.yaml              # Template configuration files
└── <template-name>/    # Overlay files that customize the base reference
    ├── src/            # Source code overrides
    ├── worker/         # Cloudflare Worker code
    ├── prompts/        # AI selection and usage docs (required)
    ├── wrangler.jsonc  # Worker configuration
    └── package.json    # Dependency overrides (optional)

build/                  # Generated templates (gitignored, regenerate as needed)
originals/              # Ground truth templates for verification
tools/                  # Build and verification scripts
zips/                   # Packaged templates for distribution
```

## Template Types

The repository supports multiple template variations, all generated from shared base references:

**Vite-based Templates** (use `vite-reference`):
- **vite-cfagents-runner** - Cloudflare Agents SDK with MCP tool support
- **vite-cf-DO-runner** - Durable Objects for stateful applications
- **vite-cf-DO-KV-runner** - Durable Objects + KV storage
- **vite-cf-DO-v2-runner** - Enhanced DO with versioned storage
- **c-code-react-runner** - General React/Vite with Workers integration
- **minimal-vite** - Minimal Vite starter

**Next.js Templates** (use `next-reference`):
- **c-code-next-runner** - OpenNext for Cloudflare deployment (currently disabled)

**Minimal Templates** (use `minimal-js-reference`):
- **minimal-js** - Bare-bones JavaScript starter
- **reveal-presentation-dev** - Reveal.js presentation framework

All templates share common patterns:
- Cloudflare Workers runtime via `wrangler.jsonc`
- TypeScript with strict typing
- shadcn/ui + Radix UI component libraries (full templates)
- Tailwind CSS for styling
- Comprehensive error boundaries
- Bring-your-own-key AI integration patterns

## Development Workflows

### Template Generation (Most Common)

```bash
# Generate all templates from definitions
python3 tools/generate_templates.py --clean

# Generate a specific template
python3 tools/generate_templates.py -t vite-cfagents-runner

# Generate and verify against originals with diffs
python3 tools/generate_templates.py --verify --diffs

# Generate specific template and verify (skip Bun checks)
python3 tools/generate_templates.py -t vite-cf-DO-v2-runner --verify --diffs --no-bun

# Verify all templates with Bun viability checks (install/lint/build)
python3 tools/generate_templates.py --verify
```

### Template Catalog and Deployment

```bash
# Generate template catalog from build/ directory
python3 generate_template_catalog.py --output template_catalog.json --pretty

# Package a single template
python3 create_zip.py build/vite-cfagents-runner zips/vite-cfagents-runner.zip

# Full deployment pipeline (generate, catalog, zip, upload to R2)
bash deploy_templates.sh

# Deploy to local R2 (development)
LOCAL_R2=true bash deploy_templates.sh
```

### Working Within Generated Templates

Once templates are generated in `build/`, navigate to a template directory:

```bash
cd build/vite-cfagents-runner

# Vite templates
bun install
bun run dev        # Development server on port 3000
bun run build      # TypeScript check + Vite build
bun run lint       # ESLint with caching
bun run preview    # Build and preview on port 4173
bun run deploy     # Build and deploy to Cloudflare
bun run cf-typegen # Generate Worker type definitions

# Next.js templates
npm run dev        # Development server
npm run build      # Production build
npm run deploy     # Build and deploy
npm run cf-typegen # Generate types
```

## Creating or Modifying Templates

### Template Definition Structure

Each template requires:
1. **YAML Definition** in `definitions/<template-name>.yaml`
2. **Overlay Directory** at `definitions/<template-name>/` with customizations
3. **Required Files** in overlay:
   - `prompts/selection.md` - AI selection description
   - `prompts/usage.md` - Usage instructions
   - `wrangler.jsonc` or `wrangler.toml` - Worker config
   - Additional overrides as needed

### YAML Configuration Schema

```yaml
name: "template-name"
description: "Short description for catalog"
base_reference: "vite-reference"  # or "next-reference" or "minimal-js-reference"
projectType: app  # or "presentation"
disabled: false   # Set true to exclude from catalog

# Deep merge patches applied to package.json (optional)
package_patches:
  name: "template-name"
  dependencies:
    "new-package": "^1.0.0"

# Glob patterns to exclude from final template (optional)
excludes:
  - "src/pages/reference-only/**"
  - "src/hooks/unused-*.ts"

# Only copy specific overlay files - omit to copy all (rare, optional)
template_specific_files:
  - "src/App.tsx"
  - "wrangler.jsonc"
```

### Generation Process Flow

1. Copy base reference (e.g., `vite-reference/`) to `build/<template-name>/`
2. Apply overlay files from `definitions/<template-name>/` (overwriting base files)
3. Apply `package_patches` if specified (deep merge into package.json)
4. Remove files matching `excludes` patterns
5. Verify against `originals/<template-name>/` if it exists

### Modifying Existing Templates

**Option 1: Modify Base Reference** (affects all templates using that base)
- Edit files in `reference/vite-reference/` or `reference/next-reference/`
- Regenerate all templates: `python3 tools/generate_templates.py --clean`

**Option 2: Modify Template Overlay** (affects single template)
- Edit files in `definitions/<template-name>/`
- Regenerate: `python3 tools/generate_templates.py -t <template-name>`
- Verify: Add `--verify --diffs` to see changes

**Option 3: Modify YAML Config** (for metadata, excludes, patches)
- Edit `definitions/<template-name>.yaml`
- Regenerate and verify

### Important Files in Templates

**Worker Configuration**:
- `wrangler.jsonc` - Worker runtime, bindings, environment variables
- `worker/index.ts` - Worker entry point (Hono server)
- `worker/core-utils.ts` - DO utilities (DO templates only, DO NOT MODIFY)

**Build Configuration**:
- `vite.config.ts` - Vite build with Cloudflare plugin
- `tsconfig.json` - TypeScript compiler options
- `tsconfig.worker.json` - Worker-specific TS config
- `eslint.config.js` - ESLint v9 flat config

**UI Configuration**:
- `components.json` - shadcn/ui settings
- `tailwind.config.js` - Design tokens and plugins

**Metadata Files** (AI hints):
- `.important_files.json` - Critical files AI should preserve
- `.donttouch_files.json` - Files AI should never modify
- `.redacted_files.json` - Files hidden from AI context

## AI Integration Patterns

Templates integrate with AI services through:
- **User-provided credentials** - `OPENAI_API_KEY` and optional `OPENAI_BASE_URL` are supplied through secret bindings
- **OpenAI SDK** - OpenAI or OpenAI-compatible LLM interactions with proper no-key handling
- **Cloudflare Agents SDK** - Stateful AI agents with persistent conversations (vite-cfagents-runner)
- **MCP (Model Context Protocol)** - Tool integration for AI agents (vite-cfagents-runner)

## Deployment and Distribution

### Local Development Deployment

```bash
# Deploy to local R2 (requires Wrangler and local R2 setup)
LOCAL_R2=true R2_BUCKET_NAME=your-bucket bash deploy_templates.sh
```

### Production Deployment

The `deploy_templates.sh` script handles end-to-end deployment:
1. Generates all templates into `build/`
2. Creates `template_catalog.json` with metadata
3. Packages each template as an optimized ZIP (excludes node_modules, .wrangler, dist, etc.)
4. Uploads catalog JSON and all ZIPs to Cloudflare R2 in parallel

```bash
# Production deployment (requires Wrangler authentication)
R2_BUCKET_NAME=your-production-bucket bash deploy_templates.sh
```

### GitHub Actions CI/CD

Automated deployment is configured via GitHub Actions:
- Triggered on push to main branch
- Runs verification checks (diff + Bun viability)
- Uploads to R2 if checks pass
- See `DEPLOYMENT_SETUP.md` for secrets configuration

## Architecture Patterns

### Base Reference Components

The `vite-reference` template includes a comprehensive component library:
- **Radix UI** primitives - Accessible, unstyled components
- **shadcn/ui** - Pre-built styled implementations
- **Tailwind CSS** - Utility-first styling with design tokens
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Consistent icon library

Components live in `src/components/ui/` and cover forms, navigation, data display, overlays, and layouts. All generated templates inherit these unless overridden.

### Worker Architecture (Hono-based)

Templates use Hono for Worker request handling:
- **Entry Point**: `worker/index.ts` exports Hono app
- **API Routes**: Defined via Hono routing (e.g., `/api/*`)
- **Static Assets**: Vite build output served via `serveStatic`
- **Environment Bindings**: Access via `c.env` in route handlers

### Durable Objects Pattern

DO templates (`vite-cf-DO-*`) use a shared global DO class:
- **Class Definition**: `GlobalDurableObject` in `worker/core-utils.ts`
- **Multi-Entity Storage**: Single DO class used as KV-like storage by multiple entities
- **Versioned Storage**: `vite-cf-DO-v2-runner` includes compare-and-swap operations
- **Important**: NEVER modify `worker/core-utils.ts` - marked as "DO NOT TOUCH"

## Error Handling and Logging

### Standard Error Handling

All templates implement multi-layer error handling:
- **React Error Boundaries** - Component-level error catching
- **Route Error Boundaries** - Page-level error isolation (Vite templates)
- **Worker Error Handling** - Server-side error responses
- **Client Error Reporting** - `/api/client-errors` endpoint for frontend errors

### Runtime Error Logging (DO v2 Templates)

The `vite-cf-DO-v2-runner` template includes automatic JSON error logging:

**Error Format**: Structured JSON with timestamp, message, stack, source, filePath, lineNumber, columnNumber, severity ('warning'|'error'|'fatal'), rawOutput

**Automatic Capture**:
- `console.error()` → JSON error logs
- `console.warn()` → JSON warning logs
- `console.log()` with error keywords → JSON error logs
- Unhandled exceptions → JSON error logs
- Unhandled promise rejections → JSON error logs

**Implementation**: Core logic in `worker/core-utils.ts` (DO NOT MODIFY), client initialization in `src/lib/clientErrorLogger.ts`, auto-imported in `src/main.tsx`. Transparent - requires no application code changes.

## Template Generation Best Practices

### DRY Principle for Templates

- **Shared code belongs in base references** - If multiple templates need the same component/utility, add it to the base reference
- **Overlays only for differences** - Only include files in `definitions/<template>/` that differ from the base
- **Use excludes for removal** - Don't duplicate entire directories just to remove a few files; use `excludes` in YAML

### Verification Workflow

Always verify after changes:
```bash
# Quick verification (shows what changed)
python3 tools/generate_templates.py -t <template> --verify --diffs

# Full verification (includes Bun install/lint/build)
python3 tools/generate_templates.py -t <template> --verify
```

### Common Pitfalls

1. **Editing build/ directly** - Changes are lost on regeneration. Edit `reference/` or `definitions/` instead
2. **Forgetting to regenerate** - After modifying base references or overlays, always regenerate affected templates
3. **Skipping verification** - Use `--verify --diffs` to catch unintended changes before committing
4. **Modifying core-utils.ts** - This file is marked DO NOT MODIFY and will break DO functionality

## Code Quality Standards

When working on templates or generation scripts:
- **No `any` types** - Always use proper TypeScript types. If none exists, create one
- **No dynamic imports** - Use static imports for better tree-shaking and type safety
- **Strict DRY** - Extract shared code, don't duplicate
- **Professional comments only** - Comments should explain code purpose, not document changes
- **Implement correctly, not quickly** - Prefer robust solutions over quick hacks
