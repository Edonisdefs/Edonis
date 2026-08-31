import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import { SHOTS, camState } from '../lib/sceneState.js';

const _pos = new Vector3();
const _tgt = new Vector3();
const _fwd = new Vector3();
const _right = new Vector3();
const _up = new Vector3();
const _widePos = new Vector3(SHOTS.wide.px, SHOTS.wide.py, SHOTS.wide.pz);
const _wideTgt = new Vector3(SHOTS.wide.tx, SHOTS.wide.ty, SHOTS.wide.tz);
const UP = new Vector3(0, 1, 0);

/**
 * The shots are framed for 16:9. Narrower viewports widen the lens to hold the
 * horizontal framing, but only up to a point — past that the shot is pulled
 * back instead, so a phone gets a wide-angle view rather than a fisheye one.
 */
const REF_ASPECT = 1.78;
const MAX_FOV = 54;

function fitFov(fov, aspect) {
  if (aspect >= REF_ASPECT) return fov;
  const horizontal = Math.tan(MathUtils.degToRad(fov) / 2) * REF_ASPECT;
  return Math.min(MAX_FOV, MathUtils.radToDeg(2 * Math.atan(horizontal / Math.max(aspect, 0.4))));
}

/** 0 on a landscape viewport, 1 on a phone held upright. */
function portraitAmount(aspect) {
  return MathUtils.clamp((1.3 - aspect) / 0.7, 0, 1);
}

/** Maximum pointer parallax, in radians of orbit — deliberately tiny. */
const PARALLAX_X = MathUtils.degToRad(3.4);
const PARALLAX_Y = MathUtils.degToRad(2.0);

/**
 * Applies the authored shot, then the scroll dolly, then the pointer parallax.
 * The camera itself is never animated directly — everything lands here so the
 * three inputs can never fight each other.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // Frame-rate independent smoothing.
    const k = 1 - Math.pow(0.0015, dt);
    camState.mouse.lerp(camState.mouseTarget, k);

    _pos.copy(camState.pos);
    _tgt.copy(camState.target);
    let fov = camState.fov;

    // Scroll pulls the camera back into a wider survey shot.
    const s = camState.scroll;
    if (s > 0.0001) {
      const e = s * s * (3 - 2 * s);
      _pos.lerp(_widePos, e);
      _tgt.lerp(_wideTgt, e);
      fov = MathUtils.lerp(fov, SHOTS.wide.fov, e);
    }

    // Portrait viewports pull the shot back so nothing important is cropped,
    // and aim higher so the building sits low in the tall frame rather than
    // floating above an empty foreground.
    const portrait = portraitAmount(camera.aspect);
    if (portrait > 0.001) {
      if (camState.dolly !== 1) {
        const dolly = 1 + (camState.dolly - 1) * portrait;
        _pos.sub(_tgt).multiplyScalar(dolly).add(_tgt);
      }
      _fwd.subVectors(_tgt, _pos).normalize();
      _tgt.y += portrait * 7.5 * (1 - Math.abs(_fwd.y));
    }

    // Pointer parallax as a small orbit about the look-at point.
    const amp = camState.parallax;
    if (amp > 0.001) {
      _fwd.subVectors(_tgt, _pos);
      const dist = _fwd.length();
      _fwd.divideScalar(dist || 1);
      _right.crossVectors(_fwd, UP).normalize();
      _up.crossVectors(_right, _fwd).normalize();
      _pos.addScaledVector(_right, -camState.mouse.x * Math.tan(PARALLAX_X) * dist * amp);
      _pos.addScaledVector(_up, camState.mouse.y * Math.tan(PARALLAX_Y) * dist * amp);
    }

    camera.position.copy(_pos);
    camera.lookAt(_tgt);

    const fitted = fitFov(fov, camera.aspect);
    if (Math.abs(camera.fov - fitted) > 0.001) {
      camera.fov = fitted;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
