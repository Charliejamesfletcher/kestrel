import { useId, useState } from 'react';
import { CHEVRON, Icon } from './pieces.js';
import { FAQ_HEAD, FAQS } from './data.js';

export function Faq() {
  const [open, setOpen] = useState(0);
  const baseId = useId();

  return (
    <section id="faq" className="lp-section lp-faq" aria-labelledby="faq-title">
      <div className="k-reveal lp-head lp-head--center">
        <span className="lp-eyebrow">{FAQ_HEAD.eyebrow}</span>
        <h2 id="faq-title" className="lp-h2">
          {FAQ_HEAD.title}
        </h2>
      </div>
      <div className="k-reveal lp-faq__list">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          const answerId = `${baseId}-answer-${i}`;
          return (
            <div key={f.q} className={`lp-faq__item${isOpen ? ' is-open' : ''}`}>
              <h3 className="lp-faq__q">
                <button
                  type="button"
                  className="k-row lp-faq__btn"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{f.q}</span>
                  <Icon d={CHEVRON} size={20} stroke="#81B64C" width={3} className="lp-faq__chev" />
                </button>
              </h3>
              <p id={answerId} className="k-fade lp-faq__a" hidden={!isOpen}>
                {f.a}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
