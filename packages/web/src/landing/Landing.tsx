import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from '../nav.js';
import { reportPath } from '../route.js';
import { readSearchInput } from '../format.js';
import { DEMO_NAME, USERNAME_ERROR, WORKS_ON } from './data.js';
import { DemoReport } from './DemoReport.js';
import { EarlyAccess } from './EarlyAccess.js';
import { Faq } from './Faq.js';
import { FairPlay } from './FairPlay.js';
import { Features } from './Features.js';
import { FinalCta } from './FinalCta.js';
import { Footer } from './Footer.js';
import { Header } from './Header.js';
import { Hero } from './Hero.js';
import { HowItWorks } from './HowItWorks.js';
import { PieceDefs } from './pieces.js';
import { Pricing } from './Pricing.js';
import { scrollToSection, useRememberedPlatform, useRevealOnScroll } from './hooks.js';
import { useDemo } from './useDemo.js';
import './landing.css';

const TITLE = 'Kestrel | Scout your chess opponents';

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [platform, setPlatform] = useRememberedPlatform();
  const [query, setQuery] = useState('');
  const [heroError, setHeroError] = useState<string | null>(null);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const demo = useDemo();

  useRevealOnScroll(root);

  useEffect(() => {
    document.title = TITLE;
    // overscroll colour
    document.documentElement.classList.add('is-landing');
    return () => document.documentElement.classList.remove('is-landing');
  }, []);

  // A real name opens their report; an empty box runs the demo scan
  function scoutWith(setError: (e: string | null) => void) {
    return (e: FormEvent) => {
      e.preventDefault();
      if (query.trim() === '') {
        setError(null);
        demo.scan(DEMO_NAME, platform);
        scrollToSection('demo');
        return;
      }
      const read = readSearchInput(query);
      if (!read.username) {
        setError(USERNAME_ERROR);
        return;
      }
      const site = read.platform ?? platform;
      setError(null);
      setPlatform(site);
      navigate(reportPath(site, read.username));
    };
  }

  function onValue(v: string) {
    setQuery(v);
    setHeroError(null);
    setCtaError(null);
  }

  const formProps = { value: query, onValue, platform, onPlatform: setPlatform };

  return (
    <div className="landing" ref={root}>
      <PieceDefs />
      <a className="lp-skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="lp-main">
        <Hero {...formProps} error={heroError} onSubmit={scoutWith(setHeroError)} />
        <WorksOn />
        <DemoReport demo={demo} platform={platform} />
        <Features />
        <HowItWorks />
        <FairPlay />
        <Pricing />
        <Faq />
        <FinalCta {...formProps} error={ctaError} onSubmit={scoutWith(setCtaError)} />
        <EarlyAccess />
      </main>
      <Footer />
    </div>
  );
}

function WorksOn() {
  return (
    <div className="lp-works">
      <ul className="lp-works__inner">
        {WORKS_ON.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
