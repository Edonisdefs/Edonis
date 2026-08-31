import { STAGES, useUI } from '../lib/sceneState.js';

/**
 * A quiet technical read-out along the bottom of the intro: which stage of the
 * pipeline is on screen, and how far through the build we are. It doubles as
 * the site's thesis — this is how a visualization actually gets made.
 */
export default function IntroReadout() {
  const stage = useUI((s) => s.stage);
  const progress = useUI((s) => s.progress);
  const introDone = useUI((s) => s.introDone);

  return (
    <div className={`readout ${introDone ? 'is-out' : ''}`} aria-hidden="true">
      <div className="readout__row">
        <span className="readout__index">{stage.index}</span>
        <span className="readout__label">{stage.label}</span>
        <span className="readout__steps">
          {STAGES.map((s) => (
            <i key={s.key} className={progress >= s.at ? 'is-done' : ''} />
          ))}
        </span>
      </div>
      <div className="readout__track">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
