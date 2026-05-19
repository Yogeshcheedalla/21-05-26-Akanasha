'use client';

import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

type AssistantEmotion = 'happy' | 'neutral' | 'thinking' | 'sad' | 'surprised';
type VoiceGender = 'male' | 'female';
type VoiceTone = 'friendly' | 'professional' | 'energetic' | 'calm';

interface AssistantAvatarStageProps {
  isListening: boolean;
  isSpeaking: boolean;
  speakingVolume: number;
  viseme: number;
  emotion: AssistantEmotion;
  listenerEmotion: AssistantEmotion;
  voiceGender: VoiceGender;
  voiceTone: VoiceTone;
}

const HUMAN_AVATAR_PATH = '/assets/images/akansha-human-avatar.png';

const EMOTION_THEME: Record<AssistantEmotion, { glow: string; key: string; rim: string }> = {
  happy: { glow: 'rgba(244,114,182,0.2)', key: '#f9a8d4', rim: '#34d399' },
  neutral: { glow: 'rgba(148,163,184,0.12)', key: '#f8fafc', rim: '#67e8f9' },
  thinking: { glow: 'rgba(245,158,11,0.14)', key: '#fde68a', rim: '#fbbf24' },
  sad: { glow: 'rgba(96,165,250,0.13)', key: '#bfdbfe', rim: '#60a5fa' },
  surprised: { glow: 'rgba(251,113,133,0.17)', key: '#fecdd3', rim: '#fb7185' },
};

const TONE_ENERGY: Record<VoiceTone, number> = {
  friendly: 0.24,
  professional: 0.1,
  energetic: 0.38,
  calm: 0.06,
};

const PORTRAIT_VERTEX_SHADER = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSpeech;
  uniform float uViseme;
  uniform float uSmile;
  uniform float uConcern;
  uniform float uBlink;

  float gaussian(vec2 uv, vec2 center, vec2 spread) {
    vec2 delta = (uv - center) / spread;
    return exp(-dot(delta, delta));
  }

  void main() {
    vUv = uv;
    vec3 p = position;
    float mouth = gaussian(uv, vec2(0.5, 0.535), vec2(0.095, 0.024));
    float upperLip = gaussian(uv, vec2(0.5, 0.56), vec2(0.11, 0.02));
    float cheeks = gaussian(uv, vec2(0.5, 0.595), vec2(0.27, 0.07));
    float eyes = gaussian(uv, vec2(0.5, 0.685), vec2(0.25, 0.035));
    float jaw = gaussian(uv, vec2(0.5, 0.47), vec2(0.17, 0.07));
    float side = sign(uv.x - 0.5);

    p.z += mouth * 0.0;
    p.y -= mouth * 0.0;
    p.x += side * mouth * 0.0;
    p.y += upperLip * (0.014 * uSmile - 0.014 * uConcern);
    p.y += cheeks * (0.018 * uSmile - 0.012 * uConcern);
    p.z += cheeks * (0.028 * uSmile);
    p.y -= eyes * uBlink * 0.018;
    p.z -= eyes * uBlink * 0.012;
    p.y -= jaw * 0.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const PORTRAIT_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uSpeech;
  uniform float uSmile;
  uniform float uConcern;

  void main() {
    vec4 color = texture2D(uMap, vUv);
    color.rgb += vec3(0.018, 0.01, 0.006) * uSmile;
    color.rgb -= vec3(0.0, 0.008, 0.018) * uConcern;
    color.rgb += vec3(0.01) * uSpeech;
    color.a *= uOpacity;
    gl_FragColor = color;
  }
`;

function createPortraitMaterial(texture: THREE.Texture, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uSpeech: { value: 0 },
      uViseme: { value: 0 },
      uSmile: { value: 0 },
      uConcern: { value: 0 },
      uBlink: { value: 0 },
    },
    vertexShader: PORTRAIT_VERTEX_SHADER,
    fragmentShader: PORTRAIT_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function HologramParticles({ color }: { color: string }) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (let index = 0; index < 260; index += 1) {
      const radius = 0.95 + Math.random() * 1.25;
      const angle = Math.random() * Math.PI * 2;
      const height = -1.65 + Math.random() * 3.4;
      positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius * 0.32);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return particleGeometry;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = clock.getElapsedTime() * 0.08;
    pointsRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.6) * 0.018;
  });

  return (
      <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color={color} size={0.017} transparent opacity={0.68} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function HologramScanField({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const rings = useMemo(() => Array.from({ length: 20 }, (_, index) => -1.62 + index * 0.17), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();
    groupRef.current.children.forEach((child, index) => {
      child.position.y = -1.62 + ((rings[index] + 1.62 + time * 0.18) % 3.35);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = 0.07 + Math.sin(time * 1.6 + index) * 0.025;
    });
  });

  return (
    <group ref={groupRef}>
      {rings.map((y, index) => (
        <mesh key={`scan-${index}`} position={[0, y, 0.025]} scale={[2.22, 0.006, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function HologramAvatar({
  isListening,
  isSpeaking,
  speakingVolume,
  viseme,
  emotion,
  listenerEmotion,
  voiceTone,
}: AssistantAvatarStageProps) {
  const rootRef = useRef<THREE.Group>(null);
  const portraitRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const pedestalRef = useRef<THREE.Mesh>(null);
  const nextBlinkAtRef = useRef(0);
  const blinkStartAtRef = useRef(-10);
  const loadedTexture = useLoader(THREE.TextureLoader, HUMAN_AVATAR_PATH);
  const activeEmotion = isListening ? listenerEmotion : emotion;
  const theme = EMOTION_THEME[activeEmotion];
  const toneEnergy = TONE_ENERGY[voiceTone];
  const hologramColor = new THREE.Color(theme.rim);

  const portraitTexture = useMemo(() => {
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.anisotropy = 12;
    loadedTexture.needsUpdate = true;
    return loadedTexture;
  }, [loadedTexture]);

  const portraitMaterials = useMemo(
    () => [0.18, 0.22, 0.96, 0.22, 0.18].map((opacity) => createPortraitMaterial(portraitTexture, opacity)),
    [portraitTexture]
  );

  useFrame(({ clock, mouse }) => {
    const time = clock.getElapsedTime();
    const rawSpeech = isSpeaking ? THREE.MathUtils.clamp(speakingVolume, 0, 1) : 0;
    const speech = rawSpeech > 0.08 ? rawSpeech : 0;
    const mouthEnergy = speech > 0 ? THREE.MathUtils.clamp(viseme / 8, 0, 1) : 0;
    if (!nextBlinkAtRef.current) {
      nextBlinkAtRef.current = time + 1.2 + Math.random() * 2.8;
    }
    if (time >= nextBlinkAtRef.current) {
      blinkStartAtRef.current = time;
      nextBlinkAtRef.current = time + 1.8 + Math.random() * 3.4;
    }
    const blinkProgress = (time - blinkStartAtRef.current) / 0.16;
    const blink =
      blinkProgress >= 0 && blinkProgress <= 1 ? Math.sin(blinkProgress * Math.PI) : 0;
    const smileTarget = activeEmotion === 'happy' ? 1 : voiceTone === 'friendly' && isSpeaking ? 0.32 : 0.12;
    const concernTarget = activeEmotion === 'sad' ? 0.9 : activeEmotion === 'thinking' ? 0.35 : 0;
    const listenLift = isListening ? 0.025 : 0;
    const emotionTilt =
      activeEmotion === 'thinking' ? -0.025 : activeEmotion === 'surprised' ? 0.02 : activeEmotion === 'sad' ? -0.015 : 0;
    const targetX = THREE.MathUtils.clamp(mouse.y * 0.025 + emotionTilt, -0.035, 0.035);
    const targetY = THREE.MathUtils.clamp(mouse.x * 0.05, -0.06, 0.06);

    if (rootRef.current) {
      rootRef.current.position.y = -0.16 + listenLift + Math.sin(time * (0.9 + toneEnergy)) * 0.018;
      rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, targetX, 0.045);
      rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, targetY + Math.sin(time * 0.22) * 0.035, 0.045);
      rootRef.current.scale.setScalar(1 + speech * 0.012);
    }

    if (portraitRef.current) {
      portraitRef.current.position.z = 0.02 + Math.sin(time * 0.7) * 0.025;
      portraitRef.current.rotation.y = Math.sin(time * 0.35) * 0.018;
      portraitRef.current.children.forEach((child, index) => {
        child.position.z = -0.04 + index * 0.026 + Math.sin(time * 1.1 + index) * 0.006;
      });
    }

    portraitMaterials.forEach((material, index) => {
      material.uniforms.uTime.value = time;
      material.uniforms.uSpeech.value = THREE.MathUtils.lerp(
        material.uniforms.uSpeech.value,
        speech,
        speech > 0 ? 0.28 : 0.72
      );
      material.uniforms.uViseme.value = THREE.MathUtils.lerp(
        material.uniforms.uViseme.value,
        mouthEnergy,
        mouthEnergy > 0 ? 0.3 : 0.8
      );
      material.uniforms.uSmile.value = THREE.MathUtils.lerp(
        material.uniforms.uSmile.value,
        smileTarget,
        0.055
      );
      material.uniforms.uConcern.value = THREE.MathUtils.lerp(
        material.uniforms.uConcern.value,
        concernTarget,
        0.045
      );
      material.uniforms.uBlink.value = blink;
      material.uniforms.uOpacity.value = index === 2 ? 0.96 : 0.15 + speech * 0.08;
    });

    if (auraRef.current) {
      auraRef.current.scale.set(2.2 + speech * 0.12 + mouthEnergy * 0.04, 3.38 + speech * 0.16, 1);
      const material = auraRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.22 + speech * 0.12;
    }

    if (pedestalRef.current) {
      pedestalRef.current.rotation.z = time * 0.2;
      pedestalRef.current.scale.x = 1.08 + speech * 0.08;
      pedestalRef.current.scale.y = 0.18 + speech * 0.02;
    }
  });

  return (
    <group ref={rootRef} position={[0, -0.16, 0]}>
      <HologramParticles color={theme.rim} />

      <mesh ref={auraRef} position={[0, -0.03, -0.08]} scale={[2.2, 3.38, 1]}>
        <planeGeometry args={[1, 1.35]} />
        <meshBasicMaterial color={theme.rim} transparent opacity={0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <group ref={portraitRef} position={[0, -0.04, 0]}>
        {[-0.04, -0.015, 0.012, 0.04, 0.065].map((z, index) => (
          <mesh
            key={`depth-plane-${index}`}
            position={[0, 0, z]}
            rotation={[0, (index - 2) * 0.018, 0]}
            scale={[2.08 + index * 0.014, 3.16 + index * 0.014, 1]}
            renderOrder={10 + index}
          >
            <planeGeometry args={[1, 1.36, 64, 64]} />
            <primitive object={portraitMaterials[index]} attach="material" />
          </mesh>
        ))}
      </group>

      <HologramScanField color={theme.rim} />

      <mesh position={[0, -0.05, 0.17]} scale={[1.1, 1.72, 1]} renderOrder={30}>
        <torusGeometry args={[1, 0.006, 10, 180]} />
        <meshBasicMaterial color={theme.rim} transparent opacity={0.34} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[-1.14, -0.08, 0.12]} rotation={[0, 0, -0.02]} scale={[0.012, 3.25, 1]} renderOrder={31}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={theme.rim} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[1.14, -0.08, 0.12]} rotation={[0, 0, 0.02]} scale={[0.012, 3.25, 1]} renderOrder={31}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={theme.rim} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh ref={pedestalRef} position={[0, -1.5, 0.16]} rotation={[Math.PI / 2, 0, 0]} scale={[1.08, 0.18, 1]} renderOrder={32}>
        <torusGeometry args={[1, 0.012, 12, 120]} />
        <meshBasicMaterial color={theme.rim} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, -1.5, 0.14]} rotation={[Math.PI / 2, 0, 0]} scale={[0.75, 0.75, 1]} renderOrder={31}>
        <circleGeometry args={[1, 80]} />
        <meshBasicMaterial color={theme.rim} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function AssistantAvatarStage(props: AssistantAvatarStageProps) {
  const interactionMode = props.isSpeaking ? 'speaking' : props.isListening ? 'listening' : 'idle';
  const activeEmotion = interactionMode === 'listening' ? props.listenerEmotion : props.emotion;
  const theme = EMOTION_THEME[activeEmotion];

  return (
    <div
      className="relative h-full overflow-hidden bg-[#050814]"
      style={{ boxShadow: `inset 0 0 110px ${theme.glow}` }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_#050814_0%,_#070b18_55%,_#050814_100%)]" />

      <Canvas
        camera={{ position: [0, 0.16, 4.65], fov: 35 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="absolute inset-0"
      >
        <color attach="background" args={['#050814']} />
        <ambientLight intensity={1} />
        <directionalLight position={[1.6, 2.2, 3.2]} intensity={0.65} color={theme.key} />
        <Suspense fallback={null}>
          <HologramAvatar {...props} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(103,232,249,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(103,232,249,0.04)_1px,transparent_1px)] bg-[size:46px_46px] opacity-35" />
      <div className="pointer-events-none absolute inset-x-[18%] bottom-9 h-14 rounded-full bg-cyan-300/10 blur-2xl" />
    </div>
  );
}
