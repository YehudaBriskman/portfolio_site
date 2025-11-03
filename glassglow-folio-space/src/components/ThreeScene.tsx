
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

interface ThreeSceneProps {
  darkMode?: boolean;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({ darkMode = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const cubeRef = useRef<THREE.Mesh>(null);
  const torusRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.1;
    }
    
    if (sphereRef.current) {
      sphereRef.current.rotation.x = time * 0.3;
      sphereRef.current.rotation.y = time * 0.2;
    }
    
    if (cubeRef.current) {
      cubeRef.current.rotation.x = time * 0.4;
      cubeRef.current.rotation.z = time * 0.1;
    }
    
    if (torusRef.current) {
      torusRef.current.rotation.x = time * 0.2;
      torusRef.current.rotation.y = time * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Floating geometric shapes with day/night colors */}
      <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
        <mesh ref={sphereRef} position={[-4, 2, -2]}>
          <sphereGeometry args={[0.8, 64, 64]} />
          <meshStandardMaterial
            color={darkMode ? "#6366f1" : "#3b82f6"}
            roughness={0}
            metalness={0.8}
          />
        </mesh>
      </Float>

      <Float speed={2} rotationIntensity={1.5} floatIntensity={1.5}>
        <mesh ref={cubeRef} position={[4, -2, -1]}>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshStandardMaterial
            color={darkMode ? "#ec4899" : "#06b6d4"}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={2} floatIntensity={1}>
        <mesh ref={torusRef} position={[0, 4, -3]}>
          <torusGeometry args={[1, 0.4, 16, 100]} />
          <meshStandardMaterial
            color={darkMode ? "#06b6d4" : "#10b981"}
            roughness={0}
            metalness={1}
          />
        </mesh>
      </Float>

      <Float speed={1.2} rotationIntensity={0.8} floatIntensity={2.5}>
        <mesh position={[-2, -4, -2]}>
          <octahedronGeometry args={[1]} />
          <meshStandardMaterial
            color={darkMode ? "#8b5cf6" : "#8b5cf6"}
            roughness={0.2}
            metalness={0.7}
          />
        </mesh>
      </Float>

      {/* Ambient shapes with adaptive colors */}
      {Array.from({ length: 50 }).map((_, i) => (
        <Float key={i} speed={Math.random() * 2 + 0.5}>
          <mesh
            position={[
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20
            ]}
          >
            <sphereGeometry args={[Math.random() * 0.1 + 0.05, 8, 8]} />
            <meshStandardMaterial
              color={darkMode 
                ? `hsl(${Math.random() * 360}, 70%, 60%)`
                : `hsl(${Math.random() * 120 + 180}, 60%, 50%)`
              }
              transparent
              opacity={darkMode ? 0.6 : 0.4}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
};
