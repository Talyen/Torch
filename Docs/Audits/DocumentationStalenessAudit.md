# Documentation Staleness Audit

**Goal:** Fix misleading Torch documentation: stale paths, broken links, wrong versions, outdated architecture claims, and commands that no longer exist.

## Intent

Find contradictions between live docs and the repository's executable sources of truth. Discover Markdown mechanically rather than trusting a hardcoded count, but use capped probes and open only candidate files plus nearby source lines. A pass with no contradiction is valid. If Critical/Moderate drift is large, phase the cleanup.

## Hard stops

- Do not turn this into a style rewrite or restate the entire product vision. Change only claims that are wrong, broken, or materially ambiguous.
- Do not treat dated “Last execution”, run logs, Done tables, or audit tracker sections as sources of truth; remove tracker residue from an audit guide instead of maintaining it.
- Do not hand-edit generated asset output under `public/assets/`; update `Raw Assets/` or `scripts/assets.config.mjs` and run `npm run assets:build` when the documented source/pipeline changes.
- Historical text can mention an old decision when it is clearly labeled historical. Fix live links and current instructions only.

## Severity

| Level    | Criteria                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Critical | Wrong API/path, broken internal link, stale architecture boundary, wrong framework/tool version, or command that cannot run |
| Moderate | Wrong current-status claim, test/path count, terminology, or milestone state                                                |
| Minor    | Typo, formatting, or missing code-fence language that does not change meaning                                               |

## Domain rules

**Sources of truth:**

- `package.json` and `package-lock.json` for scripts, dependency versions, and package identity.
- `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DEVELOPMENT.md`, `DETERMINISM.md`, and `AGENTS.md` for product direction, runtime boundaries, milestone state, workflows, replay rules, and agent guardrails.
- `DESIGN_SYSTEM.md` for React overlay tokens and layout contracts.
- `index.html`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, and `playwright.config.ts` for entry points, compiler/runtime settings, test directories, ports, and browser-server behavior.
- `src/**`, `tests/**`, `scripts/**`, and `Raw Assets/**` for on-disk ownership and current implementation names. `public/assets/**` and `dist/**` are generated outputs, not source-of-truth docs.

**Link rules:** internal Markdown links resolve relative to the file containing
them. Recheck the target path and, when a fragment is present, optionally verify
the heading anchor. A guide in `Docs/Audits/` reaches root project docs with
`../../`, while links to the audit pack use the local `README.md`.

**Current Torch facts to protect:** Phaser 4 + TypeScript 6 + React 19 overlay + Vite + Vitest + Playwright; browser-first development; `src/sim/**` is renderer-independent and deterministic; `src/game/**` owns session/input/Phaser presentation; `src/ui/**` owns the React overlay; Phase 1 save/reload/respawn and command-transcript coverage are implemented and tested; the current Phase 2 slice includes local versioned save envelopes, while recovery, migration, chunk materialization, and provider hardening remain future work.

## Known signals

Optional discovery aids — choose probes that fit the candidate.

- **Markdown inventory:** `find . -type f -name '*.md' -not -path './node_modules/*' -not -path './dist/*' | sort`.
- **Path/framework drift:** `rg -n "npm run|src/|tests/|scripts/|public/|Phaser|TypeScript|React|Vite|Vitest|Playwright|version|Phase [0-9]" --glob '*.md' .` then inspect the cited source.
- **Stale commands:** compare every documented `npm run ...` command with the scripts in `package.json`; current scripts include `assets:build`, `dev`, `build`, `preview`, `typecheck`, `typecheck:sim`, `test`, `test:coverage`, `test:watch`, `test:e2e`, `test:e2e:prod`, `format`, `format:check`, `lint`, `lint:fix`, `prepare`, `check:theme`, `check:ui-system`, `check:content`, `check:size`, and `verify`.
- **Directory/owner mismatch:** compare claims about simulation, game, UI, content, tests, and generated assets with `find src tests scripts -maxdepth ... -type f`.
- **Version drift:** compare framework/tool versions named in docs with `package.json`; do not infer versions from lockfile transitive entries.
- **Broken links/anchors:** inspect Markdown link targets and headings from each changed file; pay special attention to paths under `Docs/Audits/`.
- **Status drift:** compare `README.md` current status and `ROADMAP.md` checkboxes with actual source/tests. Keep recovery/migration, chunk materialization, cloud/platform packaging, and other unreached release work marked as future; do not re-label implemented save, replay, crafting, or loadout behavior as roadmap-only.
- **Generated-artifact claims:** ensure docs describe `scripts/process-assets.mjs` as the owner that writes `public/assets/manifest.json` and generated variants.
- **Audit hygiene:** remove embedded run output or dated tracker residue from audit guides; outcomes belong in the handoff or `Docs/Audits/decisions.md` when a proposal is deliberately kept/deferred.

## Matching verification

For documentation-only edits, recheck links and commands directly. Run the runtime gate only when the documentation changes a command, path, or workflow:

```bash
npm run typecheck
npm test
npm run test:e2e -- --reporter=line
npm run verify
```

Report each corrected source-of-truth mismatch and any unresolved product/documentation decision. Do not claim a command passed unless it exists in `package.json` and was run.
