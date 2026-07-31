# Torch audits

These are re-runnable, one-shot guides for improving Torch code quality. An
audit is not a project tracker or standing product requirement: run it when a
user cites it, or when a planned review explicitly includes it. Do not turn
uncited findings into backlog by default.

Past dispositions live in [decisions.md](decisions.md). Check the ledger before
confirming a candidate; do not re-propose a dispositioned item unless the
evidence changed.

## Shared contract

Every confirmed finding must state:

- the candidate and confirming evidence;
- user, correctness, or maintenance impact;
- a preferred remedy (delete, reuse, or local simplification before a new abstraction);
- why that remedy is smaller than both a patch that leaves the cause and a larger abstraction;
- expected authored production/test LOC, declaration, and file/type direction; and
- matching verification.

A probe hit is not a finding. Zero findings is a successful audit result. Never
invent a fix or structural proposal to satisfy a quota.

Unless the cited audit explicitly owns the behavior, do not change player-facing
balance, copy, layout, accessibility semantics, generated output, deterministic
seeds, or architecture boundaries. Do not add a package or weaken a test/gate
to make a finding disappear.

## Right-size policy

Prefer the smallest remedy that removes the confirmed cause. Related hits may
justify one cohesive change, but shared ownership alone does not justify a new
seam or framework.

- **Ship in-pass:** confirmed local fixes that fully address the finding.
- **Propose and stop:** significant refactors, package moves, new seams, or
  architecture changes. Present the proposal and wait for approval.
- **Proposal bar:** require confirmed evidence, a clear maintenance or
  correctness win, a local patch that would leave the same class of problem,
  an existing owner for the remedy, and at least three current uses (or an
  enforced architecture boundary) for a generic abstraction.

## Pass outcomes and repeat runs

Inventory confirmed findings and address them according to the right-size
policy. If the scope is large, split it into explicit phases. Record outcomes in
the handoff or commit, not in these guides; the durable exception is
`decisions.md` for rejected, deferred, or intentionally kept candidates.

On repeat runs, prefer the changed surface:

```bash
git diff --name-only HEAD~1..HEAD
git log --oneline -- src tests scripts
```

Use a full-repository pass periodically or when the audit’s cheap probe is
cheap enough to justify it. The cadence table is guidance, not a gate; a user
citing an audit always runs it.

| Cadence | Audits |
| --- | --- |
| Frequent, mechanical | `DeadCodeAudit`, `TypeSafetyAudit`, `SideEffectSurfaceAudit`, `DesignSystemConsistencyAudit`, `DocumentationStalenessAudit`, diff-scoped `BugHuntingAudit` |
| Occasional, judgment/runtime | `UnitTestAudit`, `E2ETestQualityAudit`, `BehaviorHardeningAudit`, `AsyncRaceAudit`, `UIInteractionFeedbackAudit`, `InelegantSlopAudit`, `PerformanceAudit` |
| Rare, structural | `DuplicateFeatureSurfaceAudit`, `StateGravityOwnershipAudit`, `DualPathRetentionAudit`, `ChangeLocalityContextEfficiencyAudit` |

## Orchestrated runs

When multiple audits or subagents are requested, one root orchestrator owns the
shared prereads, candidate deduplication, confirmation, edit ownership, final
review, and integrated verification. Delegate only bounded, independent slices
with a task brief naming the audit, evidence, intended remedy, exact files or
symbols, hard stops, and cheapest matching check. Keep concurrent write
ownership disjoint. The root reviews every diff and runs the integrated gates
once; workers report changed paths, verification, and blockers rather than
dumping full logs.

## Ownership

| Concern | Owner audit |
| --- | --- |
| Dead or unused symbols | `DeadCodeAudit.md` |
| Reachable shims or parallel implementations | `DualPathRetentionAudit.md` |
| RNG, browser I/O, and shared mutation seams | `SideEffectSurfaceAudit.md` |
| Idempotency, persistence, and swallowed errors | `BehaviorHardeningAudit.md` |
| Async lifetime, timers, listeners, and stale effects | `AsyncRaceAudit.md` |
| `any`, unsafe casts, and suppressions | `TypeSafetyAudit.md` |
| Vitest value, runtime, redundancy, and ownership | `UnitTestAudit.md` |
| Playwright reliability and tier fit | `E2ETestQualityAudit.md` |
| Opportunistic defects | `BugHuntingAudit.md` |
| Documentation drift | `DocumentationStalenessAudit.md` |
| React interaction, feedback, and keyboard behavior | `UIInteractionFeedbackAudit.md` |
| Shared UI tokens and primitives | `DesignSystemConsistencyAudit.md` |
| Over-engineering, ceremony, and mass hotspots | `InelegantSlopAudit.md` |
| Render churn, frame cost, build and asset weight | `PerformanceAudit.md` |
| Copied UI surfaces and shells | `DuplicateFeatureSurfaceAudit.md` |
| Misplaced rules, state, or presentation | `StateGravityOwnershipAudit.md` |
| Change amplification and context cost | `ChangeLocalityContextEfficiencyAudit.md` |

The ownership boundary comes from
[ARCHITECTURE.md](../../ARCHITECTURE.md): `src/sim/` is pure deterministic
simulation, `src/game/` owns session/input/Phaser presentation, `src/ui/` owns
React overlays, `src/content/` owns data definitions, and `src/components/ui/`
plus `src/ui/primitives.tsx` own shared UI behavior. Do not invent a second
authority in an audit guide.

## Verification map

Use the cheapest check that can confirm the candidate, then run the complete
gate when a change crosses multiple layers:

| Check | Best fit |
| --- | --- |
| `npm run check:theme` | UI token and palette ownership |
| `npm run typecheck` | Type safety, import/API drift, and documentation snippets that are compiled in tests |
| `npm test` or a focused `npm test -- <pattern>` | Simulation, state, UI helper, and regression behavior |
| `npm run build` | Production TypeScript/Vite integration and asset pipeline |
| `npm run test:e2e -- --reporter=line` | Browser flow, interaction, console, and responsive evidence |
| `npm run assets:build` | Raw-art changes and generated asset/manifest consistency |
| `npm run verify` | Integrated UI theme, typecheck, unit tests, build, and Playwright gate |

If the default E2E port is occupied, use an isolated port:

```bash
TORCH_E2E_PORT=4174 npm run verify
```

Torch does not currently ship a separate lint, knip, madge, coverage, or audit
aggregator command. The guides use scoped `rg`, `git`, and the checks above as
discovery/verification signals; do not document nonexistent commands as gates.
If a signal becomes stable and mechanical, propose promoting it to a checked-in
script or lint rule rather than quietly adding a second policy owner.

## Toolchain and source boundaries

Use the versions in `package.json` and the committed lockfile. The supported
client stack is Phaser 4, TypeScript, React 19, Vite, Vitest, Playwright, and the
checked-in Base UI/shadcn-style primitives already present in the repository.
There is no Electron desktop shell, Zustand store, server persistence layer, or
Alchemy feature tree in this checkout; an audit must not assume any of them.

Read the project contracts before making a proposal:

- [README.md](../../README.md) for product direction and current status;
- [ARCHITECTURE.md](../../ARCHITECTURE.md) for runtime ownership and invariants;
- [ROADMAP.md](../../ROADMAP.md) for active milestone scope;
- [DEVELOPMENT.md](../../DEVELOPMENT.md) for local workflow and checks;
- [DETERMINISM.md](../../DETERMINISM.md) for seeds, commands, and replay rules;
- [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) for React/UI contracts; and
- [AGENTS.md](../../AGENTS.md) for repository-wide agent guardrails.

These guides remain focused on their distinct audit scope. Shared policy belongs
in the documents above, not in copied per-audit prose.
