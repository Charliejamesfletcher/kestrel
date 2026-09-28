import { useId, useState, type FormEvent } from 'react';
import type { Platform } from '@kestrel/shared';
import { platformLabel, PLATFORMS, readSearchInput } from '../format.js';
import { reportPath } from '../route.js';
import { useNavigate } from '../nav.js';

const PLATFORM_KEY = 'kestrel.platform';

// localStorage can throw in private windows
function loadPlatform(): Platform {
  try {
    const saved = window.localStorage.getItem(PLATFORM_KEY);
    return saved === 'lichess' ? 'lichess' : 'chesscom';
  } catch {
    return 'chesscom';
  }
}

function savePlatform(platform: Platform): void {
  try {
    window.localStorage.setItem(PLATFORM_KEY, platform);
  } catch {
  }
}

export function SearchForm({ compact = false, initial }: { compact?: boolean; initial?: { platform: Platform; username: string } }) {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<Platform>(() => initial?.platform ?? loadPlatform());
  const [username, setUsername] = useState(initial?.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  function choose(p: Platform) {
    setPlatform(p);
    savePlatform(p);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const read = readSearchInput(username);
    if (!read.username) {
      setError(
        username.trim() === ''
          ? 'Type their username first.'
          : read.platform
            ? `That link isn't a ${platformLabel(read.platform)} profile. Paste their profile link or just the username.`
            : 'Usernames are 2–30 letters, numbers, underscores or hyphens.'
      );
      return;
    }
    const site = read.platform ?? platform;
    setError(null);
    choose(site);
    navigate(reportPath(site, read.username));
  }

  return (
    <form className={`search${compact ? ' search--compact' : ''}`} onSubmit={submit} noValidate role="search">
      <fieldset className="toggle">
        <legend className="visually-hidden">Site they play on</legend>
        {PLATFORMS.map((p) => (
          <label key={p} className={`toggle__option${platform === p ? ' is-on' : ''}`}>
            <input
              type="radio"
              name="platform"
              value={p}
              checked={platform === p}
              onChange={() => choose(p)}
            />
            {platformLabel(p)}
          </label>
        ))}
      </fieldset>
      <div className="search__row">
        <label htmlFor={inputId} className={compact ? 'visually-hidden' : 'search__label'}>
          Their {platformLabel(platform)} username
        </label>
        <input
          id={inputId}
          className="search__input"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. magnuscarlsen"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" className="button button--primary">
          Scout for free
        </button>
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
