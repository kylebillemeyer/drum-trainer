'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DrumTrack } from '@/types/music';
import { LANES, LANE_INDEX } from '@/lib/lanes';

interface Props {
  track: DrumTrack;
  getCurrentTime: () => number;
  playedUpTo: number;
  showLabels?: boolean;
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

const N       = LANES.length;
const TOTAL_W = N * LANE_W + (N - 1) * LANE_GAP;

// Lanes run right-to-left in world X so the camera's mirrored X axis (a consequence
// of looking in the +Z direction) renders them left-to-right on screen in LANES order.
function laneX(i: number) {
  return TOTAL_W / 2 - i * (LANE_W + LANE_GAP) - LANE_W / 2;
}

function laneColorCss(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export default function DrumHighway3D({
  track,
  getCurrentTime,
  playedUpTo,
  showLabels = false,
  lookaheadSeconds = 3,
}: Props) {
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

    // ── Scene ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050a);
    scene.fog = new THREE.FogExp2(0x05050a, 0.012);

    // ── Camera ────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 500);
    camera.position.set(0, 4.2, -4.5);
    camera.lookAt(0, 0, 40);

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display  = 'block';
    renderer.domElement.style.width    = '100%';
    renderer.domElement.style.height   = '100%';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset    = '0';
    renderer.domElement.style.zIndex   = '0';
    container.appendChild(renderer.domElement);

    // ── Lighting ──────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 12, -6);
    key.castShadow = true;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far  = 60;
    key.shadow.camera.left = key.shadow.camera.bottom = -20;
    key.shadow.camera.right = key.shadow.camera.top   =  20;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x3040ff, 0.25);
    fill.position.set(0, 3, 50);
    scene.add(fill);

    // ── Lane surfaces ─────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const geo = new THREE.PlaneGeometry(LANE_W, TRACK_LENGTH);
      const mat = new THREE.MeshStandardMaterial({ color: LANES[i].bgColor, roughness: 0.95 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(laneX(i), 0, TRACK_LENGTH / 2 - 6);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // Lane dividers
    for (let i = 0; i <= N; i++) {
      const x = TOTAL_W / 2 - i * (LANE_W + LANE_GAP) + LANE_GAP / 2;
      const geo = new THREE.BoxGeometry(LANE_GAP * 0.5, 0.01, TRACK_LENGTH);
      const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a40 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.005, TRACK_LENGTH / 2 - 6);
      scene.add(mesh);
    }

    // ── Hit zone bar ──────────────────────────────────────────────────
    const hitBarGeo = new THREE.BoxGeometry(TOTAL_W + 0.3, 0.03, 0.06);
    const hitBarMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    const hitBar = new THREE.Mesh(hitBarGeo, hitBarMat);
    hitBar.position.set(0, 0.015, 0);
    scene.add(hitBar);

    const glowGeo = new THREE.PlaneGeometry(TOTAL_W + 0.5, 0.6);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.01, 0);
    scene.add(glow);

    // ── Note meshes ───────────────────────────────────────────────────
    type NoteMesh = { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; note: (typeof track.notes)[0] };
    const noteMeshes: NoteMesh[] = [];

    for (const note of track.notes) {
      const laneIdx = LANE_INDEX[note.lane];
      if (laneIdx === undefined) continue;

      const lane  = LANES[laneIdx];
      const color = new THREE.Color(lane.color);
      const emissiveIntensity = 0.1 + (note.velocity / 127) * 0.25;

      const geo = new THREE.BoxGeometry(LANE_W - 0.12, NOTE_H, NOTE_DEPTH);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity, roughness: 0.35, metalness: 0.15, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.set(laneX(laneIdx), NOTE_H / 2, 9999);
      mesh.visible = false;
      scene.add(mesh);
      noteMeshes.push({ mesh, mat, note });
    }

    // ── Label X positions ─────────────────────────────────────────────
    function computeLabelXs(w: number) {
      // Project lane centers at whichever world Z is visible at the screen bottom.
      // The hit zone (z=0) is just below the view frustum due to camera angle, so
      // we binary-search for the Z that lands at NDC y=-1 and project there instead.
      const probe = new THREE.Vector3(0, 0, 0);
      probe.project(camera);
      let labelZ = 0;
      if (probe.y < -1) {
        let lo = 0, hi = 50;
        for (let iter = 0; iter < 30; iter++) {
          const mid = (lo + hi) / 2;
          probe.set(0, 0, mid);
          probe.project(camera);
          if (probe.y < -1) lo = mid; else hi = mid;
        }
        labelZ = (lo + hi) / 2;
      }
      setLabelXs(LANES.map((_, i) => {
        const v = new THREE.Vector3(laneX(i), 0, labelZ);
        v.project(camera);
        return ((v.x + 1) / 2) * w;
      }));
    }

    if (showLabels) computeLabelXs(W);

    // ── Resize ────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const { width: w, height: h } = container.getBoundingClientRect();
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (showLabels) computeLabelXs(w);
      }
    });
    ro.observe(container);

    // ── Animation loop ────────────────────────────────────────────────
    let animId: number;
    let destroyed = false;

    function animate() {
      if (destroyed) return;
      animId = requestAnimationFrame(animate);

      const ct = getCurrentTimeRef.current();
      for (const { mesh, mat, note } of noteMeshes) {
        const t = note.time - ct;
        if (t < -0.3 || t > lookaheadSeconds + 0.3) { mesh.visible = false; continue; }
        mesh.visible = true;
        mesh.position.z = t * UNITS_PER_SEC + NOTE_DEPTH / 2;
        mat.opacity = note.time < playedUpToRef.current ? 0.15 : 1.0;
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
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
            color:         laneColorCss(LANES[i].color),
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
