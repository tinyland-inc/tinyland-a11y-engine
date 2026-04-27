# @tummycrypt/tinyland-a11y-engine

Accessibility evaluation engine and validators for Tinyland applications.

This package provides reusable contrast, ARIA, keyboard navigation, reporting, streaming, and orchestration utilities intended to be consumed as a standalone building block.

## Build

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm check:package
```

## Bazel

```bash
bazel build //:pkg //:test
bazel test //:test
```
