import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { demoteTier, getCapabilities } from '../lib/capabilities.js';
import { camState, useUI } from '../lib/sceneState.js';
import { useIntroTimeline } from '../hooks/useIntroTimeline.js';
import { useScrollStory } from '../hooks/useScrollStory.js';
import ArchitectureScene from '../three/ArchitectureScene.jsx';
import Fallback from './Fallback.jsx';
import HeroTypography from './HeroTypography.jsx';
import HoverAnnotation from './HoverAnnotation.jsx';
import IntroReadout from './IntroReadout.jsx';

export default function Hero() {
  const caps = useMemo(() => getCapabilities(), []);
  const [settings, setSettings] = useState(caps.settings);
  const [live, setLive] = useState(true);
  const canvasRef = useRef(null);

  const introDone = useUI((s) => s.introDone);
  const webglOk = useUI((s) => s.webgl);
  const setWebgl = useUI((s) => s.setWebgl);

  useEffect(() => {
    if (!caps.webgl) setWebgl(false);
  }, [caps.webgl, setWebgl]);

  // `caps.webgl` is the probe; `webglOk` also goes false if the context is
  // lost at runtime, which swaps in the static plate rather than freezing.
  const live3d = caps.webgl && webglOk;

  const introConfig = useMemo(
    () => ({ animate: caps.webgl && !caps.reducedMotion }),
    [caps.webgl, caps.reducedMotion],
  );

  const onIntroComplete = useCallback(() => {
    document.body.dataset.intro = 'done';
  }, []);

  // Without WebGL the timeline still runs its `animate: false` branch, which is
  // what reveals the hero lockup over the static plate.
  useIntroTimeline({ enabled: introConfig, onComplete: onIntroComplete });

  useEffect(() => {
    document.body.dataset.intro = caps.webgl && !caps.reducedMotion ? 'running' : 'done';
    return () => {
      delete document.body.dataset.intro;
    };
  }, [caps.webgl, caps.reducedMotion]);

  const onVisibilityChange = useCallback((visible) => setLive(visible), []);
  useScrollStory({ ready: introDone || !live3d, canvasRef, onVisibilityChange });

  /* Pointer parallax input. */
  useEffect(() => {
    if (!live3d || caps.touch) return undefined;
    const onMove = (event) => {
      camState.mouseTarget.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [live3d, caps.touch]);

  const onDemote = useCallback(() => {
    setSettings(demoteTier().settings);
  }, []);

  const onCreated = useCallback(({ gl }) => {
    gl.domElement.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        useUI.getState().setWebgl(false);
      },
      { once: true },
    );
  }, []);

  return (
    <>
      <div className="stage" ref={canvasRef}>
        {live3d ? (
          <Canvas
            frameloop={live ? 'always' : 'never'}
            dpr={[1, settings.maxPixelRatio]}
            shadows={settings.shadows}
            gl={{
              antialias: settings.shadows,
              powerPreference: 'high-performance',
              alpha: false,
              stencil: false,
            }}
            camera={{ fov: camState.fov, near: 0.5, far: 900, position: [0, 43, 5] }}
            onCreated={onCreated}
          >
            <Suspense fallback={null}>
              <ArchitectureScene
                settings={settings}
                interactive={introDone && !caps.touch}
                onDemote={caps.pinned ? undefined : onDemote}
              />
            </Suspense>
          </Canvas>
        ) : (
          <Fallback />
        )}
      </div>

      <section id="hero" className="hero" aria-label="ES-Visuals">
        <HeroTypography />
        {live3d && !caps.reducedMotion ? <IntroReadout /> : null}
        {live3d && !caps.touch ? <HoverAnnotation /> : null}
        <span className="hero__scroll" aria-hidden="true">
          <i />
          Scroll
        </span>
      </section>
    </>
  );
}
