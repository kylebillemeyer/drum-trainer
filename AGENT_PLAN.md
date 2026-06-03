## Goal
Replace Three.js with Babylon.js in `DrumHighway3D` — engine, camera, lighting, fog, lane geometry — so the scene looks visually identical without rendering any note gems.

## Tasks
- [x] Create AGENT_PLAN.md and commit
- [x] Label issue in-progress, remove spec-approved
- [x] Remove `three` and `@types/three`; add `@babylonjs/core`
- [x] Rewrite `DrumHighway3D.tsx` useEffect body with Babylon.js equivalents
- [x] Verify coordinate system: negate laneX for Babylon left-handed coord system
- [x] Port label projection using `Vector3.TransformCoordinates`
- [x] Run `npx tsc --noEmit` — must pass cleanly
- [x] Open PR with Closes #22

## Decisions / blockers
- Babylon.js uses a left-handed coordinate system (X+ = screen right when looking in +Z).
  Three.js looking in +Z mirrors X (right-handed rotation), so world +X appears screen-LEFT.
  Fix: negate the laneX() return value in the Babylon version to preserve lane order.
- Label projection: use `Vector3.TransformCoordinates(pos, scene.getTransformMatrix())` to get
  NDC coords, then convert to pixels — same algorithm as Three.js, no Viewport class needed.
- Note gems excluded per spec (issue #23 covers Phase 2).
