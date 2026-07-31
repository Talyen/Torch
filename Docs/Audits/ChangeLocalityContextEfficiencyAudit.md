# Change Locality & Context Efficiency Audit

**Goal:** Reduce maintenance and agent-context cost by finding recurring changes that require more authored edits, unrelated context, verification, or output than the behavior warrants.

## Intent

Identify repeated high-friction clusters and simplify them through existing sources of truth or owners. A successful fix reduces at least one stable proxy: authored touchpoints, required preread surface, duplicated declarations or policy, routed verification tiers, or routine command output. Do not use tokenizer-specific token counts. Before shipping, confirm recurrence (or demonstrated drift), causality beyond co-change alone, excess avoidable surface, an existing home for the remedy, and a measurable before/after proxy with unchanged correctness coverage. If the scope is large, phase the plan.

## What counts as locality or context friction

This audit owns two distinct concerns; a run may scope to either.

### Change amplification (authored edits)

| Tell | Why it is a finding candidate |
| --- | --- |
| Comparable changes repeatedly co-touch unrelated authored owners | The behavior may lack one source of truth |
| A frequently changed owner requires unrelated code to understand one concern | The semantic change is not locally reviewable |
| The same behavior repeatedly touches many authored files | A missing seam or owner may force parallel edits |

### Context & tool-output cost (agent working set)

| Tell | Why it is a finding candidate |
| --- | --- |
| One policy or command is maintained in several authored sources | Every change risks drift and consumes repeated context |
| A local path forces unrelated docs, asset sources, or generated output into the working set | Routine work pays avoidable reading cost |
| Successful commands emit repetitive output, or failures require opening raw logs | Useful signal is buried in avoidable tool output |

**Not this audit:** wrong simulation/UI ownership → `StateGravityOwnershipAudit.md`; local ceremony or file/folder mass without recurring co-touch → `InelegantSlopAudit.md`; duplicate UI → `DuplicateFeatureSurfaceAudit.md`; shared CSS/token drift → `DesignSystemConsistencyAudit.md`; stale or duplicated documentation policy → `DocumentationStalenessAudit.md`; unit/E2E portfolio → `UnitTestAudit.md` / `E2ETestQualityAudit.md`; reachable dual paths/shims → `DualPathRetentionAudit.md`; single-use export cleanup without fan-out evidence → `DeadCodeAudit.md`.

## Hard stops

- Do not weaken, skip, or suppress TypeScript, Vitest, Playwright, theme, build, deterministic, or generated-output checks.
- Do not count intentional source/test, authored/generated-output, raw-art/optimized-art, manifest/catalog, or simulation/renderer/UI companionship as excess fan-out.
- A broad feature change or large file is not itself a finding. Confirm recurring co-touch or avoidable context.
- Do not mechanically split files, merge unrelated owners, or centralize distinct policies merely to improve a count.
- Do not add routing metadata, a configuration framework, or an abstraction for an isolated task. CSS selectors/tokens and checked-in configuration are authored owners, not free context to duplicate or centralize casually.
- Treat `src/main.ts` and the React/Phaser composition boundary as expected fan-out; they are composition roots, not seam targets by default.

## Remedy preference

Prefer delete duplicated policy or commands and link consumers to the existing source of truth. Narrow verification routing or docs preread using evidence from representative Torch paths. Restore repeated configuration or behavior to its semantic owner and remove old copies. Move or split only when it makes the selected concern independently reviewable; significant moves remain proposals per [README.md](README.md). Parameterize or add a seam only for confirmed repetition with at least three current uses, or propose the seam when non-obvious.

## Domain rules

Executable scripts, checked-in configuration, and shared CSS own tool/style behavior: `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `scripts/`, `src/styles.css`, and `src/index.css`. Architecture and runtime invariants live in [ARCHITECTURE.md](../../ARCHITECTURE.md); workflow and verification policy lives in [DEVELOPMENT.md](../../DEVELOPMENT.md); replay and seed rules live in [DETERMINISM.md](../../DETERMINISM.md); repository guardrails live in [AGENTS.md](../../AGENTS.md). Prefer links over copied policy. If a proposed locality fix is really CSS/token or documentation drift, hand it to the owning audit instead of creating a second policy.

Mine history only as a capped discovery tool, then confirm the strongest candidates in their diffs. Count authored inputs separately from generated outputs and raw assets. For amplification hotspots, prefer the existing owner (`src/sim/`, `src/game/`, `src/ui/`, `src/components/ui/`, `src/content/`, or an existing test file) over a new framework.

Every shipped finding must report its before/after proxy and the unchanged correctness signal (the same focused Vitest assertion, Playwright journey, `npm run check:theme`, `npm run typecheck`, or `npm run verify` path).

## Measurement recipe

Use the same representative change or command before and after the remedy. Record the unique authored paths in `git diff --name-only` (excluding generated output and raw assets) for touch cost; list the unique files actually read before editing for preread cost; and record bounded output lines or bytes from the same focused command. Use Vitest's configured/default reporter or `--reporter=dot`; Playwright supports `--reporter=line`. Report the sample, exclusions, command, and unchanged semantic check. These are comparison proxies, not correctness metrics.

### Import and dependency locality

Torch has no checked-in import-graph or cycle-audit command. Do not cite an absent tool as evidence. If a change suggests a dependency cycle or a boundary leak, inventory the changed paths with `rg "^(import|export)" src tests`, then confirm with `npm run typecheck` and `npm run build`. Fix the owner or import edge; do not widen the simulation boundary in [ARCHITECTURE.md](../../ARCHITECTURE.md) to make a cycle compile.

## Known signals

Optional discovery aids — choose your own probes and keep output bounded.

- **Change amplification:** `git log --max-count=50 --since="3 months ago" --format= --name-only -- src tests scripts` followed by focused `git show`/`git diff` on the highest-churn clusters. On repeat runs, use the last dispositioned audit ref and skip candidates already in [decisions.md](decisions.md).
- **Authored co-change clusters:** capped history samples excluding `dist/`, `public/assets/`, `Raw Assets/`, and other generated output; confirm in diffs rather than treating co-change as causality.
- **Repeated policy and commands:** search `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `DETERMINISM.md`, `ROADMAP.md`, `package.json`, configs, and `scripts/` for duplicated command sequences, ports, test scopes, generation versions, and ownership statements.
- **Non-local review surface:** files in `src/sim/`, `src/game/`, `src/ui/`, `src/components/`, and `src/content/` whose diffs repeatedly require unrelated layers. Route genuine ownership drift to `StateGravityOwnershipAudit.md`.
- **Verification fan-out:** compare the smallest matching check (`npm run typecheck`, focused `npm test -- <file>`, focused Playwright spec, `npm run check:theme`, or `npm run build`) with the required `npm run verify` path. Do not shorten a gate merely to reduce output.
- **Output friction:** use focused paths while iterating; use Vitest's configured/default reporter or `--reporter=dot`, and Playwright's `--reporter=line`. Record summaries, not entire logs. A shorter command is only a win if it keeps the same semantic owner and evidence.

## Matching verification

Run the path-scoped command that proves the locality change, then the integrated gate when multiple runtime layers move. Report the before/after touchpoint or preread/output proxy, the unchanged correctness check, and any intentionally untouched generated files.
