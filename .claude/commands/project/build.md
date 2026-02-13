# Build All Packages

Run a full production build across all packages and report results clearly.

## Steps

### 1. Type check

Run type checking first — it catches errors faster than a full build:
```bash
pnpm -r type-check
```

If there are type errors, list them grouped by package and stop. Don't proceed to build with type errors.

### 2. Build

Run the full build:
```bash
pnpm -r build
```

### 3. Report

On success, print:
```
Build successful.

  packages/shared    ✓
  apps/api           ✓
  apps/web           ✓
```

On failure, show the first error clearly with file path and line number, and suggest a fix if obvious.
