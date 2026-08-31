import { useMemo } from 'react';
import { getCapabilities } from './lib/capabilities.js';
import CustomCursor from './components/CustomCursor.jsx';
import Hero from './components/Hero.jsx';
import Nav from './components/Nav.jsx';
import About from './components/sections/About.jsx';
import Contact from './components/sections/Contact.jsx';
import Services from './components/sections/Services.jsx';
import Work from './components/sections/Work.jsx';
import Workflow from './components/sections/Workflow.jsx';

export default function App() {
  const caps = useMemo(() => getCapabilities(), []);

  return (
    <>
      <a className="skip-link" href="#work">
        Skip to content
      </a>

      {caps.finePointer ? <CustomCursor /> : null}
      <Nav />
      <Hero />

      <main className="shell" id="content">
        <div className="seam" aria-hidden="true" />
        <div className="shell__body">
          <Work />
          <Services />
          <Workflow />
          <About />
          <Contact />
        </div>
      </main>
    </>
  );
}
