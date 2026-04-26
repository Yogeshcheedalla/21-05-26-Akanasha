'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';

type AvatarEmotion = 'happy' | 'neutral' | 'thinking' | 'sad' | 'surprised';

interface AvatarProps {
  isSpeaking: boolean;
  speakingVolume?: number;
  viseme?: number;
  emotion?: AvatarEmotion;
}

const EMOTION_COLORS: Record<AvatarEmotion, { skin: string; aura: string; blush: string }> = {
  neutral: { skin: '#efc8b3', aura: '#6c47ff', blush: '#f4a7a7' },
  happy: { skin: '#f1cbb5', aura: '#ec4899', blush: '#ff9fb6' },
  thinking: { skin: '#efc7b0', aura: '#38bdf8', blush: '#efb0a4' },
  sad: { skin: '#e4b29c', aura: '#64748b', blush: '#d99898' },
  surprised: { skin: '#f5d1ba', aura: '#f59e0b', blush: '#ffb4a2' },
};

export function Avatar({
  isSpeaking,
  speakingVolume = 0,
  viseme = 0,
  emotion = 'neutral',
}: AvatarProps) {
  const rootRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const jawRef = useRef<Group>(null);
  const leftEyeRef = useRef<Group>(null);
  const rightEyeRef = useRef<Group>(null);
  const leftPupilRef = useRef<Mesh>(null);
  const rightPupilRef = useRef<Mesh>(null);
  const auraRef = useRef<Mesh>(null);
  const browLeftRef = useRef<Mesh>(null);
  const browRightRef = useRef<Mesh>(null);
  const mouthRef = useRef<Mesh>(null);

  const palette = useMemo(() => EMOTION_COLORS[emotion], [emotion]);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    const blinkPhase = (Math.sin(elapsed * 0.52) + 1) * 0.5;
    const blink = blinkPhase > 0.985 ? 0.08 : 1;
    const gazeX = Math.sin(elapsed * 0.34) * 0.03;
    const gazeY = Math.cos(elapsed * 0.21) * 0.02;
    const idleLift = Math.sin(elapsed * 0.82) * 0.05;
    const sideTurn = Math.sin(elapsed * 0.27) * 0.14;
    const speakingOpen = isSpeaking ? 0.08 + speakingVolume * 0.2 + viseme * 0.018 : 0.018;
    const surpriseBoost = emotion === 'surprised' ? 1.18 : 1;
    const sadDrop = emotion === 'sad' ? -0.04 : 0;
    const thinkingTilt = emotion === 'thinking' ? 0.1 : 0;

    if (rootRef.current) {
      rootRef.current.position.y = idleLift;
      rootRef.current.rotation.y = sideTurn;
      rootRef.current.rotation.x = sadDrop + thinkingTilt * 0.4;
    }

    if (headRef.current) {
      headRef.current.rotation.z = emotion === 'thinking' ? 0.08 : emotion === 'sad' ? -0.03 : 0;
    }

    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = blink * surpriseBoost;
      rightEyeRef.current.scale.y = blink * surpriseBoost;
      leftEyeRef.current.position.set(-0.32 + gazeX, 0.18 + gazeY, 0.8);
      rightEyeRef.current.position.set(0.32 + gazeX, 0.18 + gazeY, 0.8);
    }

    if (leftPupilRef.current && rightPupilRef.current) {
      leftPupilRef.current.position.set(gazeX * 0.7, gazeY * 0.6, 0.055);
      rightPupilRef.current.position.set(gazeX * 0.7, gazeY * 0.6, 0.055);
    }

    if (jawRef.current) {
      jawRef.current.rotation.x = speakingOpen;
      jawRef.current.position.y = -0.28 - speakingOpen * 0.12;
    }

    if (mouthRef.current) {
      mouthRef.current.scale.y = 0.45 + speakingOpen * 3.2;
      mouthRef.current.scale.x = emotion === 'happy' ? 1.16 : emotion === 'sad' ? 0.85 : 1;
      mouthRef.current.position.y = emotion === 'happy' ? -0.06 : emotion === 'sad' ? -0.11 : -0.09;
    }

    if (browLeftRef.current && browRightRef.current) {
      const browLift = emotion === 'surprised' ? 0.06 : emotion === 'sad' ? -0.03 : 0;
      browLeftRef.current.position.y = 0.42 + browLift;
      browRightRef.current.position.y = 0.42 + browLift;
      browLeftRef.current.rotation.z =
        emotion === 'thinking' ? 0.22 : emotion === 'sad' ? -0.12 : 0.08;
      browRightRef.current.rotation.z =
        emotion === 'thinking' ? -0.08 : emotion === 'sad' ? 0.12 : -0.08;
    }

    if (auraRef.current) {
      const auraPulse = isSpeaking ? 1.08 + speakingVolume * 0.14 : 1 + Math.sin(elapsed) * 0.035;
      auraRef.current.scale.set(auraPulse, auraPulse, auraPulse);
      auraRef.current.rotation.z = elapsed * 0.22;
    }
  });

  return (
    <group ref={rootRef} position={[0, -0.25, 0]}>
      <mesh ref={auraRef} position={[0, 0.55, -0.22]}>
        <torusGeometry args={[1.5, 0.045, 22, 120]} />
        <meshBasicMaterial color={palette.aura} transparent opacity={0.45} />
      </mesh>

      <mesh position={[0, -1.6, 0]}>
        <cylinderGeometry args={[0.78, 1.18, 1.85, 36]} />
        <meshStandardMaterial color="#131c2b" roughness={0.72} metalness={0.18} />
      </mesh>

      <group ref={headRef} position={[0, 0.48, 0]}>
        <mesh position={[0, -0.55, 0.02]}>
          <cylinderGeometry args={[0.18, 0.24, 0.34, 18]} />
          <meshStandardMaterial color={palette.skin} roughness={0.58} metalness={0.05} />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.96, 64, 64]} />
          <meshStandardMaterial color={palette.skin} roughness={0.47} metalness={0.08} />
        </mesh>

        <mesh position={[0, 0.55, 0.05]} scale={[1.02, 0.92, 1.02]}>
          <sphereGeometry args={[0.84, 48, 48]} />
          <meshStandardMaterial color="#1f2937" roughness={0.68} metalness={0.06} />
        </mesh>

        <mesh position={[-0.9, -0.02, 0.04]} rotation={[0, 0, -0.08]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color={palette.skin} roughness={0.52} />
        </mesh>
        <mesh position={[0.9, -0.02, 0.04]} rotation={[0, 0, 0.08]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color={palette.skin} roughness={0.52} />
        </mesh>

        <mesh position={[-0.34, -0.02, 0.86]}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshStandardMaterial color={palette.blush} transparent opacity={0.28} />
        </mesh>
        <mesh position={[0.34, -0.02, 0.86]}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshStandardMaterial color={palette.blush} transparent opacity={0.28} />
        </mesh>

        <group ref={leftEyeRef} position={[-0.32, 0.18, 0.8]}>
          <mesh>
            <sphereGeometry args={[0.12, 24, 24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.12} metalness={0.04} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <sphereGeometry args={[0.065, 24, 24]} />
            <meshStandardMaterial color="#60a5fa" roughness={0.2} />
          </mesh>
          <mesh ref={leftPupilRef} position={[0, 0, 0.055]}>
            <sphereGeometry args={[0.03, 18, 18]} />
            <meshStandardMaterial color="#020617" roughness={0.15} />
          </mesh>
        </group>

        <group ref={rightEyeRef} position={[0.32, 0.18, 0.8]}>
          <mesh>
            <sphereGeometry args={[0.12, 24, 24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.12} metalness={0.04} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <sphereGeometry args={[0.065, 24, 24]} />
            <meshStandardMaterial color="#60a5fa" roughness={0.2} />
          </mesh>
          <mesh ref={rightPupilRef} position={[0, 0, 0.055]}>
            <sphereGeometry args={[0.03, 18, 18]} />
            <meshStandardMaterial color="#020617" roughness={0.15} />
          </mesh>
        </group>

        <mesh ref={browLeftRef} position={[-0.33, 0.42, 0.84]} rotation={[0, 0, 0.08]}>
          <boxGeometry args={[0.28, 0.03, 0.02]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh ref={browRightRef} position={[0.33, 0.42, 0.84]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[0.28, 0.03, 0.02]} />
          <meshStandardMaterial color="#111827" />
        </mesh>

        <mesh position={[0, -0.02, 0.92]} rotation={[0.08, 0, 0]}>
          <coneGeometry args={[0.075, 0.22, 12]} />
          <meshStandardMaterial color="#d7a384" roughness={0.56} />
        </mesh>

        <group ref={jawRef} position={[0, -0.28, 0.02]}>
          <mesh position={[0, -0.12, 0.2]} scale={[0.78, 0.56, 0.72]}>
            <sphereGeometry args={[0.68, 36, 36]} />
            <meshStandardMaterial color={palette.skin} roughness={0.5} metalness={0.06} />
          </mesh>
          <mesh ref={mouthRef} position={[0, -0.09, 0.74]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[0.18, 26, 26]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.4} metalness={0.03} />
          </mesh>
          <mesh position={[0, -0.05, 0.78]} scale={[1.2, 0.18, 0.55]}>
            <sphereGeometry args={[0.13, 20, 20]} />
            <meshStandardMaterial color="#c85d6d" roughness={0.42} metalness={0.02} />
          </mesh>
        </group>
      </group>

      <mesh position={[0, -2.2, 0]} scale={[1.18, 0.78, 0.98]}>
        <sphereGeometry args={[1.16, 32, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.84} metalness={0.1} />
      </mesh>
    </group>
  );
}
