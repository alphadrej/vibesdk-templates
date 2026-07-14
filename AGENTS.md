# AGENTS.md - VibeSDK Template Catalog

## Build Commands
```bash
python3 tools/generate_templates.py --clean              # Generate all templates
python3 tools/generate_templates.py --clean --sync-lockfiles  # Regenerate bun.lock into definitions/
python3 tools/generate_templates.py -t <name> --verify --diffs --no-bun  # Single template
cd build/<template> && bun install && bun run dev        # Dev server (port 3000)
bun run build && bun run lint                            # Build and lint
```

## Code Style
- **TypeScript**: No `any` types, use proper interfaces. Path aliases: `@/*` -> `./src/*`, `@shared/*` -> `./shared/*`
- **Imports**: Static only (no dynamic). Group: external libs, then `@/` paths, then relative
- **Naming**: Components `PascalCase.tsx`, hooks `use-kebab-case.ts`, utils `camelCase.ts`
- **React**: Functional components, hooks at top, use existing shadcn/ui from `@/components/ui/*`
- **Workers**: Hono routes, use `ok()`/`bad()`/`notFound()` helpers from `core-utils.ts`
- **Errors**: Multi-layer boundaries (React ErrorBoundary, RouteErrorBoundary, Worker onError)

## Package Management
- **Single source**: `reference/vite-reference/package.json` has all shared dependencies
- **Customization**: Use `package_patches` in YAML to add/remove/override packages
- **Minimal templates**: Use `inherit_dependencies: false` to start with empty deps
- **Never create** `definitions/<template>/package.json` - use YAML patches instead

## Critical Rules
- **NEVER edit** `build/` directly - changes lost on regeneration. Edit `reference/` or `definitions/`
- **NEVER modify** `worker/core-utils.ts` - marked DO NOT TOUCH, breaks DO functionality
- **Always verify** after changes: `--verify --diffs` to catch unintended changes
- Active catalog templates include Vite, Next.js, Minimal JavaScript, and Reveal Pro. `minimal-vite`, `reveal-presentation-dev`, and other definitions marked `disabled: true` are excluded from new selection but may still be generated for compatibility.
