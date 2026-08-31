import { SERVICES } from '../../lib/projects.js';

export default function Services() {
  return (
    <section id="services" className="section services">
      <div className="section__head">
        <p className="eyebrow" data-reveal>
          02 — Services
        </p>
        <h2 className="section__title" data-reveal style={{ '--reveal-delay': '80ms' }}>
          Five ways to make a project understood.
        </h2>
      </div>

      <ul className="services__list">
        {SERVICES.map((service) => (
          <li key={service.index} className="service" data-reveal>
            <span className="service__index">{service.index}</span>
            <h3 className="service__title">{service.title}</h3>
            <p className="service__body">{service.body}</p>
            <ul className="service__tags">
              {service.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
