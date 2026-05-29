'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DrumTrack } from '@/types/music';
import { LANES, LANE_INDEX } from '@/lib/lanes';

interface Props {
  track: DrumTrack;
  playing: boolean;
  playbackRate?: number;
  lookaheadSeconds?: number;
}

// World-space constants
const UNITS_PER_SEC  = 8;    // how many world units = 1 second of track time
const LANE_W         = 1.0;  // world units wide per lane
const LANE_GAP       = 0.06;
const NOTE_H         = 0.20; // note box height (Y)
const NOTE_DEPTH_SEC = 0.07; // note box depth in seconds
const NOTE_DEPTH     = NOTE_DEPTH_SEC * UNITS_PER_SEC;
const TRACK_LENGTH   = 300;  // how far the lane surfaces extend

const N              = LANES.length;
const TOTAL_W        = N * LANE_W + (N - 1) * LANE_GAP;

function laneX(i: number) {
  return -TOTAL_W / 2 + i * (LANE_W + LANE_GAP) + LANE_W / 2;
}

export default function DrumHighway3D({
  track,
  playing,
  playbackRate = 1,
  lookaheadSeconds = 3,
}: Props) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const playingRef       = useRef(playing);
  const playbackRateRef  = useRef(playbackRate);
  const currentTimeRef   = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    playingRef.current = playing;
    if (!playing) lastTimestampRef.current = null;
  }, [playing]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();
    const W = width  || 800;
    const H = height || 500;

    // ── Scene ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050a);
    // Subtle exponential fog — fades the far end of the track naturally
    scene.fog = new THREE.FogExp2(0x05050a, 0.012);

    // ── Camera ────────────────────────────────────────────────────────
    // Positioned above and slightly behind the hit zone (Z=0), looking forward
    const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 500);
    camera.position.set(0, 4.2, -4.5);
    camera.lookAt(0, 0, 40);

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width  = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // ── Lighting ──────────────────────────────────────────────────────
    // Ambient — base fill so nothing is fully black
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    // Key light — above and behind camera, illuminates top faces of boxes
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 12, -6);
    key.castShadow = true;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far  = 60;
    key.shadow.camera.left = key.shadow.camera.bottom = -20;
    key.shadow.camera.right = key.shadow.camera.top   =  20;
    scene.add(key);

    // Cool blue fill from the horizon — gives the track a slight glow
    const fill = new THREE.DirectionalLight(0x3040ff, 0.25);
    fill.position.set(0, 3, 50);
    scene.add(fill);

    // ── Lane surfaces ─────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const geo = new THREE.PlaneGeometry(LANE_W, TRACK_LENGTH);
      const mat = new THREE.MeshStandardMaterial({
        color: LANES[i].bgColor,
        roughness: 0.95,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(laneX(i), 0, TRACK_LENGTH / 2 - 6);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // Lane dividers — thin boxes standing just above the surface
    for (let i = 0; i <= N; i++) {
      const x = -TOTAL_W / 2 + i * (LANE_W + LANE_GAP) - LANE_GAP / 2;
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

    // Soft glow behind the hit zone using a wide, very transparent plane
    const glowGeo = new THREE.PlaneGeometry(TOTAL_W + 0.5, 0.6);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.01, 0);
    scene.add(glow);

    // ── Note meshes ───────────────────────────────────────────────────
    // One mesh per note, repositioned each frame — straightforward for track sizes
    type NoteMesh = { mesh: THREE.Mesh; note: (typeof track.notes)[0] };
    const noteMeshes: NoteMesh[] = [];

    for (const note of track.notes) {
      const laneIdx = LANE_INDEX[note.lane];
      if (laneIdx === undefined) continue;

      const lane   = LANES[laneIdx];
      const color  = new THREE.Color(lane.color);
      // Emissive intensity encodes velocity so louder notes glow brighter
      const emissiveIntensity = 0.1 + (note.velocity / 127) * 0.25;

      const geo = new THREE.BoxGeometry(LANE_W - 0.12, NOTE_H, NOTE_DEPTH);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity,
        roughness: 0.35,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow    = true;
      mesh.receiveShadow = false;
      mesh.position.set(laneX(laneIdx), NOTE_H / 2, 9999); // offscreen initially
      mesh.visible = false;
      scene.add(mesh);
      noteMeshes.push({ mesh, note });
    }

    // ── Resize handling ───────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const { width: w, height: h } = container.getBoundingClientRect();
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    // ── Animation loop ────────────────────────────────────────────────
    let animId: number;
    let destroyed = false;

    function animate() {
      if (destroyed) return;
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      if (playingRef.current) {
        if (lastTimestampRef.current !== null) {
          currentTimeRef.current +=
            ((now - lastTimestampRef.current) / 1000) * playbackRateRef.current;
        }
        lastTimestampRef.current = now;
      }

      const ct = currentTimeRef.current;

      for (const { mesh, note } of noteMeshes) {
        const t = note.time - ct; // seconds until this note hits the zone
        if (t < -0.3 || t > lookaheadSeconds + 0.3) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        // Positive Z = ahead of hit zone (upcoming), negative = behind (past)
        mesh.position.z = t * UNITS_PER_SEC + NOTE_DEPTH / 2;
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      currentTimeRef.current   = 0;
      lastTimestampRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: 400 }} />
  );
}
