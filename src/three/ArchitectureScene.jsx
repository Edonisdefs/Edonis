import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { ACESFilmicToneMapping, FogExp2 } from 'three';
import { uniforms } from '../lib/sceneState.js';
import Blueprint from './Blueprint.jsx';
import Building from './Building.jsx';
import CameraRig from './CameraRig.jsx';
import LabelProjector from './LabelProjector.jsx';
import Landscape from './Landscape.jsx';
import LightingRig from './LightingRig.jsx';
import PerfGuard from './PerfGuard.jsx';
import SkyDome from './SkyDome.jsx';

/**
 * A local environment probe built from light cards. No HDRI download, full
 * control over the mood, and it renders exactly once.
 */
function StudioEnvironment({ settings }) {
  return (
    <Environment resolution={settings.envResolution} frames={1}>
      <color attach="background" args={['#0a0e13']} />
      {/* Overhead sky panel */}
      <Lightformer
        intensity={0.6}
        color="#b8cfe8"
        position={[0, 14, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[36, 36, 1]}
      />
      {/* Warm key card, on the sun's side */}
      <Lightformer
        intensity={0.9}
        color="#ffcf9d"
        position={[16, 7, 9]}
        rotation={[0, -Math.PI / 3.2, 0]}
        scale={[14, 9, 1]}
      />
      {/* Cool bounce opposite, keeps the shadow side readable */}
      <Lightformer
        intensity={0.35}
        color="#2f4761"
        position={[-16, 5, -10]}
        rotation={[0, Math.PI / 2.6, 0]}
        scale={[18, 8, 1]}
      />
      {/* Ground bounce */}
      <Lightformer
        intensity={0.3}
        color="#161c22"
        position={[0, -8, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[36, 36, 1]}
      />
    </Environment>
  );
}

/** Atmosphere follows the light phase so the horizon never looks pasted on. */
function Atmosphere() {
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    scene.fog = new FogExp2(0x080a0c, 0.0030);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    const t = uniforms.uLight.value;
    if (scene.fog) {
      // Track the sky's horizon so the ground plane never shows its edge.
      scene.fog.color.setRGB(0.006 + t * 0.056, 0.008 + t * 0.044, 0.011 + t * 0.037);
      scene.fog.density = 0.0030 + t * 0.0042;
    }
  });

  return null;
}

export default function ArchitectureScene({ settings, interactive, onDemote }) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  return (
    <>
      <Atmosphere />
      <CameraRig />
      {onDemote ? <PerfGuard onDemote={onDemote} /> : null}
      <StudioEnvironment settings={settings} />

      <SkyDome />
      <LightingRig settings={settings} />
      <Landscape settings={settings} />
      <Blueprint />
      <Building settings={settings} interactive={interactive} />
      <LabelProjector />
    </>
  );
}
