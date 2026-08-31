const EMAIL = 'studio@es-visuals.de';

export default function Contact() {
  return (
    <section id="contact" className="section contact">
      <div className="section__head">
        <p className="eyebrow" data-reveal>
          05 — Contact
        </p>
        <h2 className="section__title" data-reveal style={{ '--reveal-delay': '80ms' }}>
          Send drawings. Get an image back.
        </h2>
      </div>

      <div className="contact__body">
        <a className="contact__mail" href={`mailto:${EMAIL}`} data-cursor="cta" data-reveal>
          <span>{EMAIL}</span>
          <svg viewBox="0 0 28 8" aria-hidden="true" width="28" height="8">
            <path d="M0 4h26M22.5 0.8 26.2 4l-3.7 3.2" fill="none" stroke="currentColor" />
          </svg>
        </a>

        <div className="contact__cols">
          <div data-reveal>
            <p className="eyebrow">What to send</p>
            <p>
              Plans, sections and elevations as DWG or PDF. A model if you have one &mdash; Revit,
              ArchiCAD, SketchUp or IFC all work. A rough idea of the camera helps; it is not
              required.
            </p>
          </div>
          <div data-reveal style={{ '--reveal-delay': '90ms' }}>
            <p className="eyebrow">What comes back</p>
            <p>
              A fixed quote and a date, usually within one working day. Then a clay review before
              anything is textured, and two revision rounds on the final images.
            </p>
          </div>
        </div>
      </div>

      <footer className="footer">
        <hr className="rule" />
        <div className="footer__row">
          <span>ES-Visuals &mdash; Edonis Sahitaj</span>
          <span className="footer__claim">We make architecture visible.</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </section>
  );
}
