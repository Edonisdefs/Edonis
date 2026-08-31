import { useUI } from '../lib/sceneState.js';

const LINKS = [
  { id: 'work', label: 'Work' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

export default function Nav() {
  const introDone = useUI((s) => s.introDone);
  const active = useUI((s) => s.activeSection);

  const go = (event, id) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className={`nav ${introDone ? 'is-in' : ''}`}>
      <a className="nav__mark" href="#hero" onClick={(e) => go(e, 'hero')} data-cursor="link">
        ES&#8209;VISUALS
      </a>
      <nav className="nav__links" aria-label="Primary">
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            onClick={(e) => go(e, link.id)}
            className={active === link.id ? 'is-active' : ''}
            data-cursor="link"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
