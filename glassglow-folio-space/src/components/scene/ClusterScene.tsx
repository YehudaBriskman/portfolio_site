import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Environment, Instance, Instances, Lightformer } from "@react-three/drei";
import * as THREE from "three";

const SODIUM = "#FF8C42";
const SCREEN = "#6EA8C7";
const CLAY = "#9A8C7C";
const TONE = [SODIUM, SCREEN, SCREEN, CLAY, SCREEN, SODIUM, CLAY];
const COUNT = 20;

type Pod = { pos: THREE.Vector3; color: string; scale: number; phase: number };

function usePods(): Pod[] {
  return useMemo(() => {
    const out: Pod[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const t = i / (COUNT - 1);
      const y = 1 - t * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const radius = 1.52 + (i % 3) * 0.11;
      out.push({
        pos: new THREE.Vector3(Math.cos(theta) * r * radius, y * radius * 0.78, Math.sin(theta) * r * radius),
        color: TONE[i % TONE.length],
        scale: 0.043 + (i % 4) * 0.006,
        phase: i * 0.9,
      });
    }
    return out;
  }, []);
}

function Node({ still }: { still: boolean }) {
  const slab = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!slab.current || still) return;
    slab.current.rotation.y += dt * 0.075;
    slab.current.position.y = Math.sin(state.clock.elapsedTime * 0.42) * 0.07;
  });
  return (
    <group ref={slab} rotation={[0, 0.6, 0]}>
      <mesh>
        <boxGeometry args={[1.18, 1.98, 0.42]} />
        <meshStandardMaterial color="#2E241C" metalness={0.55} roughness={0.28} envMapIntensity={1.3} />
        <Edges threshold={15} color={SODIUM} />
      </mesh>
      <mesh position={[0, 0, 0.215]}>
        <planeGeometry args={[0.055, 1.58]} />
        <meshBasicMaterial color={SODIUM} transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

/* Each pod holds its own ref. The previous version walked group.children by
   index, but drei renders one primitive per <Line>, so those indices were the
   tether lines — the pods themselves never animated at all. */
function Pods({ still }: { still: boolean }) {
  const pods = usePods();
  const group = useRef<THREE.Group>(null);
  const refs = useRef<(THREE.Object3D | null)[]>([]);

  useFrame((state, dt) => {
    if (still) return;
    if (group.current) group.current.rotation.y -= dt * 0.035;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < pods.length; i++) {
      const o = refs.current[i];
      if (o) o.scale.setScalar(1 + Math.sin(t * 1.3 + pods[i].phase) * 0.16);
    }
  });

  const tethers = useMemo(() => {
    const pts: number[] = [];
    pods.forEach((p) => pts.push(0, 0, 0, p.pos.x, p.pos.y, p.pos.z));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [pods]);

  return (
    <group ref={group}>
      {/* One LineSegments instead of 20 drei <Line> primitives: 1 draw call
          instead of 20, and it drops the three-stdlib dependency entirely. */}
      <lineSegments geometry={tethers}>
        <lineBasicMaterial color={CLAY} transparent opacity={0.16} />
      </lineSegments>
      <Instances limit={COUNT} range={COUNT}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
        {pods.map((p, i) => (
          <Instance
            key={i}
            ref={(el: THREE.Object3D | null) => (refs.current[i] = el)}
            position={p.pos}
            scale={p.scale}
            color={p.color}
          />
        ))}
      </Instances>
    </group>
  );
}

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

function Rig({ enabled }: { enabled: boolean }) {
  const { camera, pointer } = useThree();
  useFrame((_, dt) => {
    if (!enabled) return;
    // Frame-rate independent: the old Math.min(1, dt*k) behaved differently at 144Hz.
    const k = 1 - Math.exp(-dt * 2.2);
    camera.position.x += (pointer.x * 0.85 - camera.position.x) * k;
    camera.position.y += (pointer.y * 0.5 + 0.15 - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* Reduced motion means STILL, not blank. Render a few frames so drei's
   Environment lands its one-shot FBO, then stop the loop for good. */
function RenderThenStop({ frames = 3 }: { frames?: number }) {
  const { setFrameloop } = useThree();
  const n = useRef(0);
  useFrame(() => {
    if (++n.current >= frames) setFrameloop("never");
  });
  return null;
}

export default function ClusterScene({
  reduced = false,
  active = true,
}: {
  reduced?: boolean;
  active?: boolean;
}) {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const [fine, setFine] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.15, 6.4], fov: 42 }}
      // Opaque canvas painting the page colour: transparent WebGL layers
      // composite unreliably, and this skips a per-pixel blend.
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
      frameloop={reduced || !active ? (reduced ? "always" : "never") : "always"}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => {
            e.preventDefault();
            console.warn("[hero] webgl context lost");
          },
          { passive: false }
        );
      }}
    >
      <color attach="background" args={["#120E0B"]} />
      <fog attach="fog" args={["#120E0B", 6, 15]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-4, -1.5, 3]} intensity={2.1} color={SODIUM} />
      <directionalLight position={[3.5, 4, 2]} intensity={1.1} color={SCREEN} />
      <Environment resolution={192} frames={1} background={false}>
        <Lightformer intensity={2.4} color={SODIUM} position={[-5, -2, 2]} scale={[9, 9, 1]} />
        <Lightformer intensity={1.4} color={SCREEN} position={[4, 5, 3]} scale={[7, 7, 1]} />
        <Lightformer intensity={0.5} color="#FFFFFF" position={[0, 0, -6]} scale={[10, 10, 1]} />
      </Environment>
      <group position={[wide ? 1.9 : 0, 0.1, 0]}>
        <Node still={reduced} />
        <Pods still={reduced} />
      </group>
      <Dust still={reduced} />
      <Rig enabled={!reduced && fine} />
      {reduced && <RenderThenStop />}
    </Canvas>
  );
}
