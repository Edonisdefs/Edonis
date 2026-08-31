import { useMemo } from 'react';
import { PROJECTS, axonometric } from '../../lib/projects.js';

function Plate({ project }) {
  const faces = useMemo(() => axonometric(project.massing), [project.massing]);

  if (project.image) {
    return <img className="plate__image" src={project.image} alt="" loading="lazy" />;
  }

  return (
    <svg className="plate__axo" viewBox="0 0 100 100" aria-hidden="true">
      {faces.map((face, i) => (
        <polygon key={i} className={`axo axo--${face.tone}`} points={face.points} />
      ))}
    </svg>
  );
}

export default function Work() {
  return (
    <section id="work" className="section work">
      <div className="section__head">
        <p className="eyebrow" data-reveal>
          01 — Selected work
        </p>
        <h2 className="section__title" data-reveal style={{ '--reveal-delay': '80ms' }}>
          Buildings photographed before they exist.
        </h2>
      </div>

      <ol className="work__grid">
        {PROJECTS.map((project, i) => (
          <li
            key={project.id}
            className="work__item"
            data-reveal
            style={{ '--reveal-delay': `${(i % 3) * 90}ms` }}
          >
            <a className="plate" href="#contact" data-cursor="link">
              <span className="plate__frame">
                <Plate project={project} />
                <span className="plate__scan" />
              </span>
              <span className="plate__meta">
                <span className="plate__index">{project.index}</span>
                <span className="plate__title">{project.title}</span>
                <span className="plate__type">{project.type}</span>
              </span>
              <span className="plate__foot">
                <span>{project.place}</span>
                <span>{project.year}</span>
              </span>
              <span className="plate__note">{project.note}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
