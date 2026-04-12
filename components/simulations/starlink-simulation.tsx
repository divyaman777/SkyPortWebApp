'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  STARLINK_COLOR,
  STARLINK_LINK_COLOR,
  TOTAL_SATS,
  NUM_PLANES,
  SATS_PER_PLANE,
  ALTITUDE_KM,
  INCLINATION_DEG,
  ORBITAL_ELEMENTS,
  LASER_LINKS,
  SCENE_ORBIT_RADIUS,
  MEAN_MOTION,
  getStarlinkPosition,
  getOrbitRingPoints,
  type SelectedStarlinkSat,
} from '@/lib/starlink-data';

// ─── Constants ────────────────────────────────────────────────

const TIME_SCALE = 10; // slower than earth (30) so user can click/hover individual sats
const simStartReal = Date.now();
const simStartDate = new Date();

function getSimTimeSec(): number {
  const realElapsed = Date.now() - simStartReal;
  const simDate = new Date(simStartDate.getTime() + realElapsed * TIME_SCALE);
  return simDate.getTime() / 1000;
}

// ─── Starlink v2 Mini Geometry ────────────────────────────────
// Real shape: very thin flat body (~4.1m × 2.7m × ~0.2m)
// with two large deployable solar panel wings (~30m total span)
// At scene scale we exaggerate for visibility but keep proportions

function createStarlinkGeometry(): THREE.BufferGeometry {
  // Body: thin flat rectangular slab (the spacecraft bus)
  const body = new THREE.BoxGeometry(0.008, 0.001, 0.005);

  // Left solar wing — large thin panel
  const leftWing = new THREE.BoxGeometry(0.018, 0.0004, 0.006);
  const leftMatrix = new THREE.Matrix4().makeTranslation(-0.013, 0, 0);
  const leftGeo = leftWing.clone().applyMatrix4(leftMatrix);

  // Right solar wing — mirror
  const rightWing = new THREE.BoxGeometry(0.018, 0.0004, 0.006);
  const rightMatrix = new THREE.Matrix4().makeTranslation(0.013, 0, 0);
  const rightGeo = rightWing.clone().applyMatrix4(rightMatrix);

  // Antenna bump on body (phased array)
  const antenna = new THREE.BoxGeometry(0.004, 0.0015, 0.003);
  const antennaMatrix = new THREE.Matrix4().makeTranslation(0, 0.001, 0);
  const antennaGeo = antenna.clone().applyMatrix4(antennaMatrix);

  // Merge all parts
  const parts = [body, leftGeo, rightGeo, antennaGeo];
  let totalVerts = 0;
  let totalIdx = 0;
  for (const p of parts) {
    totalVerts += p.getAttribute('position').count;
    totalIdx += (p.getIndex()?.count || 0);
  }

  const positions = new Float32Array(totalVerts * 3);
  const indices = new Uint16Array(totalIdx);
  let vOffset = 0;
  let iOffset = 0;
  let vCount = 0;

  for (const p of parts) {
    const pos = p.getAttribute('position');
    const idx = p.getIndex();
    if (!idx) continue;

    for (let i = 0; i < pos.count * 3; i++) {
      positions[vOffset + i] = pos.array[i];
    }
    for (let i = 0; i < idx.count; i++) {
      indices[iOffset + i] = idx.array[i] + vCount;
    }
    vOffset += pos.count * 3;
    iOffset += idx.count;
    vCount += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();

  // Cleanup
  for (const p of parts) p.dispose();
  leftWing.dispose();
  rightWing.dispose();
  antenna.dispose();

  return merged;
}

// ─── Hover Tooltip ───────────────────────────────────────────

interface TooltipData {
  instanceId: number;
  position: [number, number, number];
  planeIdx: number;
  satIdx: number;
}

function StarlinkTooltip({ data, onClick }: { data: TooltipData; onClick?: () => void }) {
  const speedKmS = (2 * Math.PI * (6371 + ALTITUDE_KM)) / (2 * Math.PI / MEAN_MOTION) ; // v = 2πr/T
  return (
    <Html position={data.position} center>
      <div
        className="bg-[rgba(0,0,0,0.92)] border border-[rgba(176,196,222,0.4)] px-2.5 py-2 rounded text-[10px] whitespace-nowrap font-mono cursor-pointer hover:brightness-125"
        onClick={onClick}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[#B0C4DE] font-bold">STARLINK-{data.planeIdx * SATS_PER_PLANE + data.satIdx + 1}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#4FC3F7] animate-pulse" />
        </div>
        <div className="text-muted-foreground text-[9px] space-y-0.5">
          <div>Plane {data.planeIdx + 1}/{NUM_PLANES} &middot; Slot {data.satIdx + 1}/{SATS_PER_PLANE}</div>
          <div>{ALTITUDE_KM} km &middot; {INCLINATION_DEG}° &middot; {speedKmS.toFixed(1)} km/s</div>
          <div className="text-[#4FC3F7]">4 laser links active</div>
        </div>
      </div>
    </Html>
  );
}

// ─── Orbit Ring (for selected satellite's plane) ────────────

function OrbitRing({ raan }: { raan: number }) {
  const points = useMemo(() => {
    return getOrbitRingPoints(raan, 180).map(
      ([x, y, z]) => new THREE.Vector3(x, y, z)
    );
  }, [raan]);

  return (
    <Line
      points={points}
      color={STARLINK_COLOR}
      lineWidth={2}
      opacity={0.6}
      transparent
    />
  );
}

// ─── Main Component ──────────────────────────────────────────

interface StarlinkSimulationProps {
  isSimulating: boolean;
  onStarlinkSelect?: (sat: SelectedStarlinkSat | null) => void;
  selectedSat?: SelectedStarlinkSat | null;
}

export function StarlinkSimulation({ isSimulating, onStarlinkSelect, selectedSat }: StarlinkSimulationProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const linksRef = useRef<THREE.LineSegments>(null);
  const [hovered, setHovered] = useState<TooltipData | null>(null);
  const [selected, setSelected] = useState<TooltipData | null>(null);

  // Satellite geometry — Starlink v2 Mini shape
  const geometry = useMemo(() => createStarlinkGeometry(), []);

  // Satellite material — silver/white body with subtle blue emissive (solar panels)
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#D8DEE9',
      emissive: '#3A5070',
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.7,
    });
  }, []);

  // Laser link line material — very subtle dashed lines
  const linkMaterial = useMemo(() => {
    return new THREE.LineDashedMaterial({
      color: STARLINK_LINK_COLOR,
      transparent: true,
      opacity: 0.06,
      dashSize: 0.06,
      gapSize: 0.18,
    });
  }, []);

  // Laser link geometry — positions updated each frame
  const linkGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(LASER_LINKS.length * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  // Store satellite positions for link updates + tooltip positioning
  const positionsCache = useRef(new Float32Array(TOTAL_SATS * 3));

  // Sync internal selection with external (e.g. background click clears it)
  useEffect(() => {
    if (!selectedSat) {
      setSelected(null);
    }
  }, [selectedSat]);

  // Initialize instance matrices
  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < TOTAL_SATS; i++) {
      dummy.position.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Override raycast: default does ray-triangle on the tiny geometry which
    // nearly always misses. Instead use distance-from-ray-to-instance-center.
    const mesh = meshRef.current;
    const HIT_RADIUS_SQ = 0.12 * 0.12;
    const _mat = new THREE.Matrix4();
    const _pos = new THREE.Vector3();
    const _closest = new THREE.Vector3();

    mesh.raycast = function (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
      for (let i = 0; i < TOTAL_SATS; i++) {
        this.getMatrixAt(i, _mat);
        _pos.setFromMatrixPosition(_mat).applyMatrix4(this.matrixWorld);
        raycaster.ray.closestPointToPoint(_pos, _closest);
        if (_closest.distanceToSquared(_pos) < HIT_RADIUS_SQ) {
          const d = raycaster.ray.origin.distanceTo(_closest);
          if (d >= raycaster.near && d <= raycaster.far) {
            intersects.push({ distance: d, point: _closest.clone(), object: this, instanceId: i } as THREE.Intersection);
          }
        }
      }
    };
  }, []);

  // Animate each frame
  useFrame(() => {
    if (!isSimulating || !meshRef.current) return;

    const simTime = getSimTimeSec();
    const dummy = new THREE.Object3D();
    const cache = positionsCache.current;

    // Update all satellite positions
    for (let i = 0; i < TOTAL_SATS; i++) {
      const [x, y, z] = getStarlinkPosition(ORBITAL_ELEMENTS[i], simTime);
      cache[i * 3] = x;
      cache[i * 3 + 1] = y;
      cache[i * 3 + 2] = z;

      dummy.position.set(x, y, z);
      // Orient: solar panels face the sun (roughly), body faces Earth
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update tooltip position if hovered/selected
    if (hovered) {
      const id = hovered.instanceId;
      setHovered(prev => prev ? {
        ...prev,
        position: [cache[id * 3], cache[id * 3 + 1] + 0.06, cache[id * 3 + 2]],
      } : null);
    }
    if (selected) {
      const id = selected.instanceId;
      setSelected(prev => prev ? {
        ...prev,
        position: [cache[id * 3], cache[id * 3 + 1] + 0.06, cache[id * 3 + 2]],
      } : null);
    }

    // Update laser link positions
    if (linksRef.current) {
      const attr = linkGeometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;

      for (let i = 0; i < LASER_LINKS.length; i++) {
        const [a, b] = LASER_LINKS[i];
        const off = i * 6;
        arr[off] = cache[a * 3];
        arr[off + 1] = cache[a * 3 + 1];
        arr[off + 2] = cache[a * 3 + 2];
        arr[off + 3] = cache[b * 3];
        arr[off + 4] = cache[b * 3 + 1];
        arr[off + 5] = cache[b * 3 + 2];
      }
      attr.needsUpdate = true;
      linksRef.current.computeLineDistances();
    }
  });

  // Event handlers for InstancedMesh raycasting
  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = e.instanceId;
    if (id === undefined) return;
    document.body.style.cursor = 'pointer';
    const elem = ORBITAL_ELEMENTS[id];
    const cache = positionsCache.current;
    setHovered({
      instanceId: id,
      position: [cache[id * 3], cache[id * 3 + 1] + 0.06, cache[id * 3 + 2]],
      planeIdx: elem.planeIdx,
      satIdx: elem.satIdx,
    });
  }, []);

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto';
    setHovered(null);
  }, []);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const id = e.instanceId;
    if (id === undefined) return;
    const elem = ORBITAL_ELEMENTS[id];
    const cache = positionsCache.current;
    const isDeselect = selected?.instanceId === id;
    const newSelected = isDeselect ? null : {
      instanceId: id,
      position: [cache[id * 3], cache[id * 3 + 1] + 0.06, cache[id * 3 + 2]] as [number, number, number],
      planeIdx: elem.planeIdx,
      satIdx: elem.satIdx,
    };
    setSelected(newSelected);
    onStarlinkSelect?.(isDeselect ? null : {
      instanceId: id,
      planeIdx: elem.planeIdx,
      satIdx: elem.satIdx,
      raan: elem.raan,
    });
  }, [selected?.instanceId, onStarlinkSelect]);

  if (!isSimulating) return null;

  return (
    <group>
      {/* 1,584 Starlink satellites — InstancedMesh for performance */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, TOTAL_SATS]}
        frustumCulled={false}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />

      {/* Inter-satellite laser links — fine dashed lines */}
      <lineSegments ref={linksRef} geometry={linkGeometry} material={linkMaterial} />

      {/* Orbit shell indicator — subtle ring at Starlink altitude */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SCENE_ORBIT_RADIUS - 0.005, SCENE_ORBIT_RADIUS + 0.005, 128]} />
        <meshBasicMaterial
          color={STARLINK_COLOR}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Orbit ring for selected satellite's orbital plane */}
      {selected && (
        <OrbitRing raan={ORBITAL_ELEMENTS[selected.instanceId].raan} />
      )}

      {/* Hover tooltip — click to select */}
      {hovered && !selected && (
        <StarlinkTooltip data={hovered} onClick={() => {
          const elem = ORBITAL_ELEMENTS[hovered.instanceId];
          setSelected(hovered);
          onStarlinkSelect?.({
            instanceId: hovered.instanceId,
            planeIdx: elem.planeIdx,
            satIdx: elem.satIdx,
            raan: elem.raan,
          });
        }} />
      )}

      {/* Selected tooltip (persistent) */}
      {selected && <StarlinkTooltip data={selected} />}
    </group>
  );
}
