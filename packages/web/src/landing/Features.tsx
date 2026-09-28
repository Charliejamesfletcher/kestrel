import { FEATURES, FEATURES_HEAD, ICONS } from './data.js';
import { GhostPiece, Icon } from './pieces.js';

export function Features() {
  return (
    <section id="features" className="lp-section lp-features" aria-labelledby="features-title">
      <GhostPiece type="b" size={340} rotate="14deg" delay="-2s, -8s" style={{ right: -150, top: 60 }} />
      <div className="k-reveal lp-head lp-head--wide">
        <span className="lp-eyebrow">{FEATURES_HEAD.eyebrow}</span>
        <h2 id="features-title" className="lp-h2">
          {FEATURES_HEAD.title}
        </h2>
      </div>
      <div className="k-reveal lp-grid">
        {FEATURES.map((f) => (
          <article key={f.title} className="k-card lp-feature">
            <div className="k-ico lp-feature__icon">
              <Icon d={ICONS[f.icon]} size={26} width={2.1} />
            </div>
            <div className="lp-feature__title-row">
              <h3 className="lp-h3">{f.title}</h3>
              {f.pro && <span className="lp-pro">PRO</span>}
            </div>
            <p className="lp-feature__body">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
