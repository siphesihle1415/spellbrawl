import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, MathUtils, type Group, type Mesh } from "three";

export function SpellProjectileEffect({ source, target, color, twin = false }: { source: [number, number, number]; target: [number, number, number]; color: string; twin?: boolean }) {
  const root = useRef<Group>(null);
  const bolts = useRef<Array<Mesh | null>>([]);
  const impact = useRef<Group>(null);
  const started = useRef(performance.now());
  useFrame(() => {
    if (!root.current || !impact.current) return;
    const progress = Math.min(1, (performance.now() - started.current) / 1_450);
    const eased = 1 - Math.pow(1 - progress, 2);
    bolts.current.forEach((bolt, index) => {
      if (!bolt) return;
      const side = twin ? (index === 0 ? -0.3 : 0.3) * (1 - eased) : 0;
      bolt.position.set(MathUtils.lerp(source[0], target[0], eased) + side, MathUtils.lerp(source[1], target[1], eased) + Math.sin(progress * Math.PI) * 0.22, MathUtils.lerp(source[2], target[2], eased));
      bolt.rotation.x += 0.06;
      bolt.rotation.y += 0.08;
    });
    impact.current.visible = progress > 0.78;
    if (impact.current.visible) impact.current.scale.setScalar((progress - 0.78) * 7);
    if (progress === 1) root.current.visible = false;
  });
  return (
    <group ref={root}>
      {Array.from({ length: twin ? 2 : 1 }, (_, index) => (
        <mesh key={index} ref={(mesh) => { bolts.current[index] = mesh; }}>
          <octahedronGeometry args={[0.14, 2]} />
          <meshBasicMaterial color={color} transparent opacity={0.88} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <Sparkles count={twin ? 70 : 45} position={source} scale={[1.1, 0.7, 1.5]} size={3} speed={2.4} color={color} />
      <group ref={impact} position={target} visible={false}>
        <mesh><sphereGeometry args={[0.18, 20, 20]} /><meshBasicMaterial color={color} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} /></mesh>
        <Sparkles count={80} scale={0.9} size={3.5} speed={4} color={color} />
        <pointLight color={color} intensity={20} distance={4} />
      </group>
    </group>
  );
}
