'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Engine,
  Scene,
  Color3,
  Color4,
  Vector3,
  FreeCamera,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  Mesh,
  InstancedMesh,
} from '@babylonjs/core';
import { DrumNote, DrumTrack, LaneId } from '@/types/music';
import { LANES } from '@/lib/lanes';
import { useSettings } from '@/lib/SettingsContext';

interface Props {
  track: DrumTrack;
  getCurrentTime: () => number;
  playedUpTo: number;
  lookaheadSeconds?: number;
}

// World-space constants
const UNITS_PER_SEC  = 8;
const LANE_W         = 1.0;
const LANE_GAP       = 0.06;
const NOTE_H         = 0.20;
const NOTE_DEPTH_SEC = 0.07;
const NOTE_DEPTH     = NOTE_DEPTH_SEC * UNITS_PER_SEC;
const TRACK_LENGTH   = 300;
const POOL_SIZE      = 64; // per lane per state — covers any realistic note density in a 3s window

const N       = LANES.length;
const TOTAL_W = N * LANE_W + (N - 1) * LANE_GAP;

// Babylon.js uses a left-handed coordinate system where X+ = screen right when looking
// in +Z. Three.js (right-handed) mirrors X when looking in +Z, so world +X appeared
// screen-left there. Negate here to preserve the same left-to-right lane order on screen.
function laneX(i: number) {
  return -(TOTAL_W / 2 - i * (LANE_W + LANE_GAP) - LANE_W / 2);
}

function hexToColor3(hex: number): Color3 {
  return new Color3((hex >> 16 & 0xff) / 255, (hex >> 8 & 0xff) / 255, (hex & 0xff) / 255);
}

type LanePool = {
  futureMaster: Mesh;
  pastMaster:   Mesh;
  futurePool:   InstancedMesh[];
  pastPool:     InstancedMesh[];
};

function* visibleNotesInWindow(
  notes: DrumNote[],
  laneId: LaneId,
  windowStart: number,
  windowEnd: number,
): Generator<DrumNote> {
  let lo = 0, hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].time < windowStart) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < notes.length && notes[i].time <= windowEnd; i++) {
    if (notes[i].lane === laneId) yield notes[i];
  }
}

export default function DrumHighway3D({
  track,
  getCurrentTime,
  playedUpTo,
  lookaheadSeconds = 3,
}: Props) {
  const { showLabels } = useSettings();
  const containerRef      = useRef<HTMLDivElement>(null);
  const getCurrentTimeRef = useRef(getCurrentTime);
  const playedUpToRef     = useRef(playedUpTo);

  const [labelXs, setLabelXs] = useState<number[] | null>(null);

  useEffect(() => {
    getCurrentTimeRef.current = getCurrentTime;
  }, [getCurrentTime]);

  useEffect(() => {
    playedUpToRef.current = playedUpTo;
  }, [playedUpTo]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();
    const W = width  || 800;
    const H = height || 500;

    // ── Canvas ────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.style.display  = 'block';
    canvas.style.width    = '100%';
    canvas.style.height   = '100%';
    canvas.style.position = 'absolute';
    canvas.style.inset    = '0';
    canvas.style.zIndex   = '0';
    container.appendChild(canvas);

    // ── Engine & Scene ────────────────────────────────────────────────
    const engine = new Engine(canvas, true);
    engine.setSize(W, H);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(5 / 255, 5 / 255, 10 / 255, 1); // 0x05050a
    scene.fogMode    = Scene.FOGMODE_EXP2;
    scene.fogColor   = new Color3(5 / 255, 5 / 255, 10 / 255);
    scene.fogDensity = 0.012;

    // ── Camera ────────────────────────────────────────────────────────
    const camera = new FreeCamera('camera', new Vector3(0, 4.2, -4.5), scene);
    camera.setTarget(new Vector3(0, 0, 40));
    camera.fov  = 62 * Math.PI / 180;
    camera.minZ = 0.1;
    camera.maxZ = 500;

    // ── Lighting ──────────────────────────────────────────────────────
    // Equivalent of Three.js AmbientLight(0xffffff, 0.35)
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambient.intensity    = 0.35;
    ambient.diffuse      = Color3.White();
    ambient.groundColor  = Color3.White();
    ambient.specular     = Color3.Black();

    // Key light — position (2, 12, -6); DirectionalLight takes direction (toward scene)
    const key = new DirectionalLight('key', new Vector3(-2, -12, 6), scene);
    key.position  = new Vector3(2, 12, -6);
    key.intensity = 1.1;

    // Fill light — 0x3040ff at position (0, 3, 50)
    const fill = new DirectionalLight('fill', new Vector3(0, -3, -50), scene);
    fill.position  = new Vector3(0, 3, 50);
    fill.intensity = 0.25;
    fill.diffuse   = hexToColor3(0x3040ff);
    fill.specular  = Color3.Black();

    // Shadow generator on key light (PCFSoft equivalent)
    const shadowGen = new ShadowGenerator(1024, key);
    shadowGen.usePoissonSampling = true;
    key.shadowMinZ = 0.5;
    key.shadowMaxZ = 60;

    // ── Lane surfaces ─────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const ground = MeshBuilder.CreateGround(`lane_${i}`, {
        width:  LANE_W,
        height: TRACK_LENGTH,
      }, scene);
      const mat = new StandardMaterial(`laneMat_${i}`, scene);
      mat.diffuseColor = hexToColor3(LANES[i].bgColor);
      ground.material       = mat;
      ground.position       = new Vector3(laneX(i), 0, TRACK_LENGTH / 2 - 6);
      ground.receiveShadows = true;
    }

    // ── Lane dividers ─────────────────────────────────────────────────
    for (let i = 0; i <= N; i++) {
      // Negate X for same reason as laneX()
      const x = -(TOTAL_W / 2 - i * (LANE_W + LANE_GAP) + LANE_GAP / 2);
      const divider = MeshBuilder.CreateBox(`divider_${i}`, {
        width:  LANE_GAP * 0.5,
        height: 0.01,
        depth:  TRACK_LENGTH,
      }, scene);
      const mat = new StandardMaterial(`divMat_${i}`, scene);
      mat.emissiveColor = hexToColor3(0x2a2a40);
      mat.diffuseColor  = Color3.Black();
      divider.material = mat;
      divider.position = new Vector3(x, 0.005, TRACK_LENGTH / 2 - 6);
    }

    // ── Hit zone bar ──────────────────────────────────────────────────
    const hitBar = MeshBuilder.CreateBox('hitBar', {
      width:  TOTAL_W + 0.3,
      height: 0.03,
      depth:  0.06,
    }, scene);
    const hitBarMat = new StandardMaterial('hitBarMat', scene);
    hitBarMat.emissiveColor = Color3.White();
    hitBarMat.diffuseColor  = Color3.Black();
    hitBarMat.alpha         = 0.75;
    hitBar.material = hitBarMat;
    hitBar.position = new Vector3(0, 0.015, 0);

    // Glow plane beneath hit bar
    const glow = MeshBuilder.CreateGround('glow', {
      width:  TOTAL_W + 0.5,
      height: 0.6,
    }, scene);
    const glowMat = new StandardMaterial('glowMat', scene);
    glowMat.emissiveColor   = Color3.White();
    glowMat.diffuseColor    = Color3.Black();
    glowMat.alpha           = 0.06;
    glowMat.backFaceCulling = false;
    glow.material = glowMat;
    glow.position = new Vector3(0, 0.01, 0);

    // ── Note gem pools ─────────────────────────────────────────────────
    // Two master meshes per lane (future / past); POOL_SIZE instances each.
    // Masters are invisible — only instances render.
    const boxOpts = { width: LANE_W - 0.12, height: NOTE_H, depth: NOTE_DEPTH };

    const lanePools: LanePool[] = LANES.map((lane, i) => {
      const color = hexToColor3(lane.color);

      const futureMat = new PBRMaterial(`lane-future-mat-${i}`, scene);
      futureMat.albedoColor   = color;
      futureMat.emissiveColor = color.scale(0.15);
      futureMat.metallic      = 0.15;
      futureMat.roughness     = 0.35;

      const pastMat = futureMat.clone(`lane-past-mat-${i}`);
      pastMat.alpha = 0.15;

      const futureMaster = MeshBuilder.CreateBox(`note-future-master-${i}`, boxOpts, scene);
      futureMaster.material  = futureMat;
      futureMaster.isVisible = false;

      const pastMaster = MeshBuilder.CreateBox(`note-past-master-${i}`, boxOpts, scene);
      pastMaster.material  = pastMat;
      pastMaster.isVisible = false;

      const futurePool = Array.from({ length: POOL_SIZE }, (_, j) => {
        const inst = futureMaster.createInstance(`note-future-${i}-${j}`);
        inst.isVisible = false;
        return inst;
      });

      const pastPool = Array.from({ length: POOL_SIZE }, (_, j) => {
        const inst = pastMaster.createInstance(`note-past-${i}-${j}`);
        inst.isVisible = false;
        return inst;
      });

      return { futureMaster, pastMaster, futurePool, pastPool };
    });

    // ── Label X positions ─────────────────────────────────────────────
    // Vector3.TransformCoordinates applies the VP matrix with perspective divide,
    // yielding NDC coords — same algorithm as Three.js vector.project(camera).
    function computeLabelXs(w: number, h: number) {
      const transform = scene.getTransformMatrix();

      // Check if hit zone (z=0) is below the screen bottom (NDC y < -1)
      const probe0 = Vector3.TransformCoordinates(Vector3.Zero(), transform);
      let labelZ = 0;
      if (probe0.y < -1) {
        let lo = 0, hi = 50;
        for (let iter = 0; iter < 30; iter++) {
          const mid = (lo + hi) / 2;
          const p = Vector3.TransformCoordinates(new Vector3(0, 0, mid), transform);
          if (p.y < -1) lo = mid; else hi = mid;
        }
        labelZ = (lo + hi) / 2;
      }

      setLabelXs(LANES.map((_, i) => {
        const ndc = Vector3.TransformCoordinates(new Vector3(laneX(i), 0, labelZ), transform);
        return ((ndc.x + 1) / 2) * w;
      }));

      void h; // h reserved for future use (e.g. vertical label placement)
    }

    // ── Render loop ───────────────────────────────────────────────────
    engine.runRenderLoop(() => {
      const ct          = getCurrentTimeRef.current();
      const playedUpTo  = playedUpToRef.current;
      const windowStart = ct - 0.3;
      const windowEnd   = ct + lookaheadSeconds + 0.3;

      for (let i = 0; i < LANES.length; i++) {
        const { futurePool, pastPool } = lanePools[i];
        const lane = LANES[i];
        let futureIdx = 0;
        let pastIdx   = 0;

        for (const note of visibleNotesInWindow(track.notes, lane.id, windowStart, windowEnd)) {
          const z      = (note.time - ct) * UNITS_PER_SEC + NOTE_DEPTH / 2;
          const isPast = note.time < playedUpTo;
          const pool   = isPast ? pastPool : futurePool;
          const idx    = isPast ? pastIdx++ : futureIdx++;
          if (idx >= POOL_SIZE) continue; // safety guard

          const inst = pool[idx];
          inst.position.set(laneX(i), NOTE_H / 2, z);
          inst.isVisible = true;
        }

        // Hide unused slots
        for (let j = futureIdx; j < POOL_SIZE; j++) futurePool[j].isVisible = false;
        for (let j = pastIdx;   j < POOL_SIZE; j++) pastPool[j].isVisible   = false;
      }

      scene.render();
    });

    if (showLabels) computeLabelXs(W, H);

    // ── Resize ────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const { width: w, height: h } = container.getBoundingClientRect();
      if (w > 0 && h > 0) {
        engine.resize();
        if (showLabels) computeLabelXs(w, h);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
      setLabelXs(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, showLabels]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: 400 }}>
      {showLabels && labelXs && labelXs.map((x, i) => (
        <div
          key={LANES[i].id}
          style={{
            position:      'absolute',
            left:          x,
            bottom:        10,
            transform:     'translateX(-50%)',
            color:         `#${LANES[i].color.toString(16).padStart(6, '0')}`,
            fontSize:      10,
            fontFamily:    'monospace',
            lineHeight:    1,
            pointerEvents: 'none',
            userSelect:    'none',
            textShadow:    '0 1px 3px #000, 0 0 6px #000',
            whiteSpace:    'nowrap',
            zIndex:        1,
          }}
        >
          {LANES[i].label}
        </div>
      ))}
    </div>
  );
}
