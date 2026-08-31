import { WORKFLOW } from '../../lib/projects.js';

/**
 * The workflow section is the payoff for the intro: the same six steps the
 * hero animation just walked through, named.
 */
export default function Workflow() {
  return (
    <section id="workflow" className="section workflow">
      <div className="section__head">
        <p className="eyebrow" data-reveal>
          03 — Workflow
        </p>
        <h2 className="section__title" data-reveal style={{ '--reveal-delay': '80ms' }}>
          You watched it happen. Here it is, named.
        </h2>
      </div>

      <ol className="workflow__steps">
        {WORKFLOW.map((step, i) => (
          <li key={step.index} className="step" data-reveal style={{ '--reveal-delay': `${i * 60}ms` }}>
            <span className="step__index">{step.index}</span>
            <span className="step__line" aria-hidden="true" />
            <h3 className="step__title">{step.title}</h3>
            <p className="step__body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
