import { useUI } from '../lib/sceneState.js';

/**
 * The hero lockup. It stays out of the way until the render is finished, then
 * resolves in one line at a time.
 */
export default function HeroTypography() {
  const show = useUI((s) => s.typographyIn);

  const scrollTo = (event, id) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`hero-type ${show ? 'is-in' : ''}`}>
      <h1 className="hero-type__mark display">ES&#8209;VISUALS</h1>
      <p className="hero-type__claim">We make architecture visible.</p>
      <p className="hero-type__meta">Architecture Visualization · CGI · 3D</p>
      <a
        className="hero-type__cta"
        href="#work"
        onClick={(e) => scrollTo(e, 'work')}
        data-cursor="cta"
      >
        <span>View projects</span>
        <svg viewBox="0 0 28 8" aria-hidden="true" width="28" height="8">
          <path d="M0 4h26M22.5 0.8 26.2 4l-3.7 3.2" fill="none" stroke="currentColor" />
        </svg>
      </a>
    </div>
  );
}
