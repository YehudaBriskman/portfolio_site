import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Environment, Instance, Instances, Lightformer, Line } from "@react-three/drei";
import * as THREE from "three";
import { namespaces, totalPods } from "@/data/infrastructure";

const SODIUM = "#FF8C42";
const SCREEN = "#6EA8C7";
const CLAY = "#9A8C7C";
const TONE: Record<string, string> = { sodium: SODIUM, screen: SCREEN, clay: CLAY };

/* One point per pod actually running, distributed on a Fibonacci sphere so the
   arrangement is even without looking gridded. Grouped by namespace, coloured by
   what that namespace does. */
function usePods() {
  return useMemo(() => {
    const out: { pos: THREE.Vector3; color: string; scale: number; phase: number }[] = [];
    let i = 0;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (const ns of namespaces) {
      for (let p = 0; p < ns.pods; p++) {
        const t = i / Math.max(totalPods - 1, 1);
        const y = 1 - t * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        const radius = 1.52 + (i % 3) * 0.11;
        out.push({
          pos: new THREE.Vector3(Math.cos(theta) * r * radius, y * radius * 0.78, Math.sin(theta) * r * radius),
          color: TONE[ns.tone] ?? CLAY,
          scale: 0.043 + (i % 4) * 0.006,
          phase: i * 0.9,
        });
        i++;
      }
    }
    return out;
  }, []);
}

/* The node itself: a single slab, deliberately monolithic. One machine, not a
   fleet — that is the honest shape of this system. */
function Node({ load, still }: { load: number; still: boolean }) {
  const slab = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!slab.current || still) return;
    slab.current.rotation.y += dt * 0.075;
    slab.current.position.y = Math.sin(state.clock.elapsedTime * 0.42) * 0.07;
  });
  return (
    <group ref={slab}>
      <mesh castShadow>
        <boxGeometry args={[1.18, 1.98, 0.42]} />
        <meshStandardMaterial color="#2E241C" metalness={0.55} roughness={0.28} envMapIntensity={1.3} />
        <Edges threshold={15} color={SODIUM} />
      </mesh>
      {/* Seam of light down the slab — the machine is powered, not inert. */}
      <mesh position={[0, 0, 0.215]}>
        <planeGeometry args={[0.055, 1.58]} />
        <meshBasicMaterial color={SODIUM} transparent opacity={0.32 + load * 0.5} />
      </mesh>
    </group>
  );
}

function Pods({ load, still }: { load: number; still: boolean }) {
  const pods = usePods();
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (still) return;
    if (ref.current) ref.current.rotation.y -= dt * 0.035;
    const t = state.clock.elapsedTime;
    ref.current?.children.forEach((child, i) => {
      const p = pods[i];
      if (!p) return;
      const s = 1 + Math.sin(t * 1.3 + p.phase) * (0.14 + load * 0.3);
      child.scale.setScalar(s);
    });
  });
  return (
    <group ref={ref}>
      {pods.map((p, i) => (
        <Line
          key={`l${i}`}
          points={[[0, 0, 0], [p.pos.x, p.pos.y, p.pos.z]]}
          color={p.color}
          transparent
          opacity={0.14}
          lineWidth={1}
        />
      ))}
      <Instances limit={64} range={pods.length}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
        {pods.map((p, i) => (
          <Instance key={i} position={p.pos} scale={p.scale} color={p.color} />
        ))}
      </Instances>
    </group>
  );
}

/* Sparse drift, not a particle field. Enough to give the void depth. */
function Dust({ still }: { still: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 130;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 13;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (!still && ref.current) ref.current.rotation.y += dt * 0.012;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.02} color={CLAY} transparent opacity={0.45} sizeAttenuation />
    </points>
  );
}

function Rig() {
  const { camera, pointer } = useThree();
  useFrame((_, dt) => {
    // Parallax that follows the cursor without ever taking control away from it.
    camera.position.x += (pointer.x * 0.85 - camera.position.x) * Math.min(1, dt * 1.6);
    camera.position.y += (pointer.y * 0.5 + 0.15 - camera.position.y) * Math.min(1, dt * 1.6);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function ClusterScene({ load = 0.2, reduced = false }: { load?: number; reduced?: boolean }) {
  // On narrow screens there is no room to offset; centre it and let type stack below.
  const wide = typeof window !== "undefined" && window.innerWidth >= 1024;
  const offsetX = wide ? 1.9 : 0;
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.15, 6.4], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      frameloop="always"
    >
      <color attach="background" args={["#120E0B"]} />
      <fog attach="fog" args={["#120E0B", 6, 15]} />
      <ambientLight intensity={0.35} />
      {/* Warm key from below-left: sodium lamp. Cold rim from above-right: screen glow. */}
      <directionalLight position={[-4, -1.5, 3]} intensity={2.1} color={SODIUM} />
      <directionalLight position={[3.5, 4, 2]} intensity={1.1} color={SCREEN} />
      <Environment resolution={192}>
        <Lightformer intensity={2.4} color={SODIUM} position={[-5, -2, 2]} scale={[9, 9, 1]} />
        <Lightformer intensity={1.4} color={SCREEN} position={[4, 5, 3]} scale={[7, 7, 1]} />
        <Lightformer intensity={0.5} color="#FFFFFF" position={[0, 0, -6]} scale={[10, 10, 1]} />
      </Environment>
      <group position={[offsetX, 0.1, 0]}>
        <Node load={load} still={reduced} />
        <Pods load={load} still={reduced} />
      </group>
      <Dust still={reduced} />
      {!reduced && <Rig />}
    </Canvas>
  );
}
