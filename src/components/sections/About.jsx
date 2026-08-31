const FACTS = [
  { k: 'Studio', v: 'ES-Visuals' },
  { k: 'Discipline', v: 'Architectural draughting & 3D visualization' },
  { k: 'Based in', v: 'Ingolstadt / Weißenburg, Germany' },
  { k: 'Working with', v: 'Architects, developers, estate agents' },
];

export default function About() {
  return (
    <section id="about" className="section about">
      <div className="section__head">
        <p className="eyebrow" data-reveal>
          04 — Studio
        </p>
        <h2 className="section__title" data-reveal style={{ '--reveal-delay': '80ms' }}>
          A draughtsman&rsquo;s eye, a renderer&rsquo;s patience.
        </h2>
      </div>

      <div className="about__body">
        <div className="about__prose">
          <p className="lede" data-reveal>
            ES-Visuals is the studio of Edonis Sahitaj &mdash; trained as an architectural
            draughtsman, working in 3D visualization.
          </p>
          <p data-reveal style={{ '--reveal-delay': '90ms' }}>
            That order matters. Every image starts as a set of drawings that has to be read
            correctly: what the wall build-up is, where the slab edge lands, how the reveal sits
            in the opening. A render that gets those wrong looks wrong long before anyone can
            say why.
          </p>
          <p data-reveal style={{ '--reveal-delay': '150ms' }}>
            The work is deliberately narrow. One person, a small number of projects at a time,
            and a process that puts the camera and the massing in front of you early &mdash; while
            changing them is still cheap.
          </p>
        </div>

        <dl className="about__facts" data-reveal style={{ '--reveal-delay': '120ms' }}>
          {FACTS.map((fact) => (
            <div key={fact.k} className="about__fact">
              <dt>{fact.k}</dt>
              <dd>{fact.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
