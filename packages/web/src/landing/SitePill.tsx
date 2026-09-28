import type { Platform } from '@kestrel/shared';
import { PLATFORMS, platformLabel } from '../format.js';

export function SitePill({ value, onChange }: { value: Platform; onChange: (p: Platform) => void }) {
  return (
    <div className="lp-pill lp-pill--site" role="group" aria-label="Site they play on">
      {PLATFORMS.map((p) => (
        <button
          key={p}
          type="button"
          className="k-btn lp-pill__btn"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
        >
          {platformLabel(p)}
        </button>
      ))}
    </div>
  );
}
