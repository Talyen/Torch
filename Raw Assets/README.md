# Raw Assets

This directory is the source-of-truth home for original artwork used by Torch.

- Keep raw files unchanged so they can be reprocessed when the pipeline evolves.
- Organize source art by content family, such as `Heroes`, `Enemies`, `Abilities`, and `Items`.
- Do not hand-edit files under `public/assets`; those are generated outputs.
- Run `npm run assets:build` after adding or replacing source art; the command
  runs `scripts/process-assets.mjs` and writes generated output under
  `public/assets/`.

The asset pipeline preserves original-ratio variants for menus and creates focused
variants for compact in-game surfaces without modifying the raw source file. Compact
art variants may include transparent rounded corners so the tile beneath remains
visible in the world.

Enemy art belongs under `Raw Assets/Enemies/`. Enemy definitions reference stable
asset IDs, while the pipeline owns the full-ratio and in-world marker variants.
When a source format is not supported by the local Sharp build, preserve the
original and document the pipeline-compatible copy in the asset metadata.

Ability art belongs under `Raw Assets/Abilities/`. The current Bash, Sunder, and
Avatar sources are 896×1200 (3:4) originals and are emitted as native-ratio
WebP display assets.
