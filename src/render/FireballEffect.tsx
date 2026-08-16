import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, DoubleSide, MathUtils, ShaderMaterial, type Group, type Mesh } from "three";

const FLIGHT_MS = 1_800;
const TRAIL_COUNT = 14;

const flameVertexShader = `
  uniform float uTime;
  uniform float uSeed;
  varying float vNoise;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int octave = 0; octave < 5; octave++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + 0.17;
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    float flow = uTime * 2.4 + uSeed;
    float broadNoise = fbm(normal * 2.8 + vec3(0.0, -flow, flow * 0.28));
    float fineNoise = noise(position * 11.0 + flow);
    vNoise = broadNoise * 0.78 + fineNoise * 0.22;
    float displacement = (vNoise - 0.48) * 0.11 + sin((position.y + flow) * 12.0) * 0.012;
    vec3 displaced = position + normal * displacement;
    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const flameFragmentShader = `
  uniform vec3 uDark;
  uniform vec3 uMid;
  uniform vec3 uHot;
  uniform vec3 uCore;
  varying float vNoise;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    float heat = smoothstep(0.18, 0.9, vNoise);
    vec3 color = mix(uDark, uMid, smoothstep(0.14, 0.48, heat));
    color = mix(color, uHot, smoothstep(0.42, 0.78, heat));
    color = mix(color, uCore, smoothstep(0.74, 1.0, heat));
    float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 2.0);
    float alpha = 0.7 + heat * 0.22 + rim * 0.08;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function FireballEffect({ source, target }: { source: [number, number, number]; target: [number, number, number] }) {
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const impact = useRef<Group>(null);
  const trail = useRef<Array<Mesh | null>>([]);
  const started = useRef(performance.now());
  const material = useMemo(() => new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: Math.random() * 20 },
      uDark: { value: new Color("#7a0800") },
      uMid: { value: new Color("#ff3100") },
      uHot: { value: new Color("#ffad18") },
      uCore: { value: new Color("#fff4ae") },
    },
    vertexShader: flameVertexShader,
    fragmentShader: flameFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  }), []);

  useEffect(() => () => material.dispose(), [material]);

  const placeOnPath = (object: Group | Mesh, progress: number) => {
    const eased = 1 - Math.pow(1 - progress, 2);
    object.position.set(
      MathUtils.lerp(source[0], target[0], eased),
      MathUtils.lerp(source[1], target[1], eased) + Math.sin(progress * Math.PI) * 0.17,
      MathUtils.lerp(source[2], target[2], eased),
    );
  };

  useFrame(() => {
    if (!root.current || !head.current || !impact.current) return;
    const elapsed = performance.now() - started.current;
    const progress = Math.min(1, elapsed / FLIGHT_MS);
    material.uniforms.uTime.value = elapsed / 1_000;
    placeOnPath(head.current, progress);
    head.current.rotation.x += 0.035;
    head.current.rotation.z += 0.055;
    head.current.scale.setScalar(0.75 + Math.sin(elapsed * 0.018) * 0.08);

    trail.current.forEach((flame, index) => {
      if (!flame) return;
      const delayedProgress = (elapsed - (index + 1) * 62) / FLIGHT_MS;
      flame.visible = delayedProgress > 0 && delayedProgress < 1;
      if (!flame.visible) return;
      placeOnPath(flame, Math.min(1, delayedProgress));
      const taper = 0.68 * (1 - index / (TRAIL_COUNT + 2));
      const flicker = 0.88 + Math.sin(elapsed * 0.022 + index * 1.7) * 0.14;
      flame.scale.setScalar(taper * flicker);
      flame.rotation.y += 0.025 + index * 0.001;
    });

    const impacting = progress > 0.84;
    impact.current.visible = impacting;
    if (impacting) {
      impact.current.position.set(...target);
      const impactProgress = (progress - 0.84) / 0.16;
      impact.current.scale.setScalar(0.2 + impactProgress * 1.8);
      impact.current.rotation.z += 0.07;
    }
    if (progress === 1) root.current.visible = false;
  });

  return (
    <group ref={root} renderOrder={30}>
      <group ref={head} position={source}>
        <mesh material={material}>
          <icosahedronGeometry args={[0.18, 4]} />
        </mesh>
        <Sparkles count={36} scale={[0.55, 0.55, 0.9]} size={3.4} speed={2.4} color="#ffae35" />
        <pointLight color="#ff5318" intensity={16} distance={3.2} />
      </group>
      {Array.from({ length: TRAIL_COUNT }, (_, index) => (
        <mesh key={index} ref={(mesh) => { trail.current[index] = mesh; }} material={material} visible={false}>
          <icosahedronGeometry args={[0.14, 2]} />
        </mesh>
      ))}
      <group ref={impact} position={target} visible={false}>
        <mesh>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshBasicMaterial color="#ff7a16" transparent opacity={0.42} blending={AdditiveBlending} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.018, 8, 48]} />
          <meshBasicMaterial color="#ffd15a" transparent opacity={0.5} blending={AdditiveBlending} depthTest={false} depthWrite={false} />
        </mesh>
        <Sparkles count={64} scale={0.7} size={3.8} speed={4} color="#ff8a2a" />
      </group>
    </group>
  );
}
