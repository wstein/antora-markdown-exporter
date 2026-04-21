# Agentic instructions

Use Bun as the primary repository command runner.

- Use `bun install` for dependency installation.
- Use `bun run <script>` or `make <target>` for build, test, lint, format, and release workflows.
- Keep npm as an explicit alternate path when a task specifically requires it, such as `npm publish`.
- Run Vitest through the declared package scripts instead of Bun-specific `bun test` APIs.
- Treat the inspection helpers and `scripts/inspection-report.ts` as supported validation surfaces for CI and release checks.
- Keep raw HTML fallback decisions centralized in `src/markdown/fallback.ts` rather than reintroducing renderer-local HTML policy.

## Runtime expectations

- The published CLI runs on Node via [`bin/antora-markdown-exporter.js`](/Users/werner/github.com/wstein/antora-markdown-exporter/bin/antora-markdown-exporter.js).
- Do not introduce Bun-only runtime APIs into published source unless the repository deliberately changes toolchain policy.
- Keep documentation, scripts, workflows, and referenced files aligned whenever a command surface changes.
- Treat [`src/extension/index.ts`](/Users/werner/github.com/wstein/antora-markdown-exporter/src/extension/index.ts) as a scaffolded extension entrypoint, not full Antora registration.
