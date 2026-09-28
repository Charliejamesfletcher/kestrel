import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Platform, ReportResponse, ReportScope } from '@kestrel/shared';
import { getReport, scout, type ApiResult } from '../api.js';
import { platformLabel, profileUrl } from '../format.js';
import { Link, useNavigate } from '../nav.js';
import { nextPollDelay } from '../poll.js';
import { reportPath } from '../route.js';
import { ReportView, type ReadyResponse } from '../components/ReportView.js';
import { SearchForm } from '../components/SearchForm.js';

interface Props {
  platform: Platform;
  username: string;
  scope: ReportScope | null;
}

type Problem = Exclude<ApiResult['kind'], 'ok'>;

const QUIET_RETRIES = 3;
const QUIET_RETRY_MS = 5_000;

// POST /api/scout once on open, then poll GET /api/report. Scope switches only GET.
export function ReportPage({ platform, username, scope }: Props) {
  const [latest, setLatest] = useState<ReportResponse | null>(null);
  const [ready, setReady] = useState<ReadyResponse | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [refreshGaveUp, setRefreshGaveUp] = useState(false);
  const [waitGaveUp, setWaitGaveUp] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scouted = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${username} · ${platformLabel(platform)} · Kestrel`;
  }, [platform, username]);

  useEffect(() => {
    const ctrl = new AbortController();
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let quietFailures = 0;
    setProblem(null);
    setRefreshGaveUp(false);
    setWaitGaveUp(false);

    const later = (fn: () => Promise<void>, ms: number) => {
      timer = setTimeout(() => void fn().catch(ignoreAbort), ms);
    };

    async function handle(result: ApiResult, again: () => Promise<void>) {
      if (ctrl.signal.aborted) return;
      if (result.kind === 'slow_down') {
        setProblem('slow_down');
        later(again, result.retryInMs);
        return;
      }
      if (result.kind !== 'ok') {
        if ((result.kind === 'network' || result.kind === 'server') && scouted.current && quietFailures < QUIET_RETRIES) {
          quietFailures++;
          later(again, QUIET_RETRY_MS);
          return;
        }
        setProblem(result.kind);
        return;
      }
      quietFailures = 0;
      setProblem(null);
      const data = result.data;
      if (data.status === 'ready' && scope !== null && data.report.scope !== scope) {
        // server fell back to another scope; sync the URL
        navigate(reportPath(platform, username, data.report.scope), { replace: true, keepScroll: true });
        return;
      }
      setLatest(data);
      if (data.status === 'ready') setReady(data);
      if (data.status === 'removed' || data.status === 'not_found' || data.status === 'invalid') setReady(null);
      if (data.status === 'unknown' && scouted.current) {
        // server lost our request (restart?), ask again
        scouted.current = false;
        await first();
        return;
      }
      const delay = nextPollDelay(data, Date.now() - started);
      if (delay !== null) later(poll, delay);
      else if (data.status === 'ready' && data.refreshing) setRefreshGaveUp(true);
      else if (data.status === 'queued' || data.status === 'fetching') setWaitGaveUp(true);
    }

    async function first() {
      const req = scope ? { platform, username, scope } : { platform, username };
      const result = await scout(req, ctrl.signal);
      if (result.kind === 'ok') scouted.current = true;
      await handle(result, first);
    }

    async function poll() {
      await handle(await getReport(platform, username, scope, ctrl.signal), poll);
    }

    void (scouted.current ? poll() : first()).catch(ignoreAbort);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [platform, username, scope, attempt]);

  function retry() {
    scouted.current = false;
    setAttempt((n) => n + 1);
  }

  function checkAgain() {
    setAttempt((n) => n + 1);
  }

  if (ready) {
    const switchingTo = scope !== null && scope !== ready.report.scope ? scope : null;
    return (
      <>
        {problem && <ProblemBanner problem={problem} onRetry={retry} />}
        <ReportView
          response={latest?.status === 'ready' ? latest : ready}
          switchingTo={switchingTo}
          refreshGaveUp={refreshGaveUp}
        />
      </>
    );
  }

  if (problem) {
    return (
      <StatePanel title={problemTitle(problem)} platform={platform} username={username}>
        <p>{problemText(problem)}</p>
        {problem !== 'invalid' && problem !== 'slow_down' && (
          <button type="button" className="button" onClick={retry}>
            Try again
          </button>
        )}
      </StatePanel>
    );
  }

  return (
    <WaitingOrFinal
      response={latest}
      platform={platform}
      username={username}
      onRetry={retry}
      waitGaveUp={waitGaveUp}
      onCheckAgain={checkAgain}
    />
  );
}

function ignoreAbort(err: unknown) {
  if (err instanceof DOMException && err.name === 'AbortError') return;
  throw err;
}

/* ---------- States before a report exists ---------- */

function WaitingOrFinal({
  response,
  platform,
  username,
  onRetry,
  waitGaveUp,
  onCheckAgain
}: {
  response: ReportResponse | null;
  platform: Platform;
  username: string;
  onRetry: () => void;
  waitGaveUp: boolean;
  onCheckAgain: () => void;
}) {
  const site = platformLabel(platform);
  const stillWaiting = (
    <>
      <p>This is taking longer than usual, so the page has stopped checking by itself.</p>
      <button type="button" className="button" onClick={onCheckAgain}>
        Check again
      </button>
    </>
  );
  if (!response) {
    return (
      <StatePanel title={username} platform={platform} username={username} busy>
        <p>Asking for their report…</p>
      </StatePanel>
    );
  }
  switch (response.status) {
    case 'queued':
      return (
        <StatePanel title={username} platform={platform} username={username} busy>
          <p className="state__big">
            In the queue: position {response.position}
          </p>
          <p>
            Kestrel downloads games one request at a time, to respect {site}'s rules for fair use of their data.
            {!waitGaveUp && ' This page updates by itself.'}
          </p>
          {waitGaveUp && stillWaiting}
        </StatePanel>
      );
    case 'fetching':
      return (
        <StatePanel title={username} platform={platform} username={username} busy>
          <p className="state__big">Downloading their public games…</p>
          <p>
            Players with thousands of games can take a minute.{!waitGaveUp && ' This page updates by itself.'}
          </p>
          {waitGaveUp && stillWaiting}
        </StatePanel>
      );
    case 'not_found':
      return (
        <StatePanel title="Player not found" platform={platform} username={username} search>
          <p>
            There's no {site} account called <strong>{username}</strong>. Check the spelling, or try the other site.
          </p>
        </StatePanel>
      );
    case 'removed':
      return (
        <StatePanel title="This player asked not to be scouted" search>
          <p>We respect that request, so Kestrel shows nothing about them.</p>
        </StatePanel>
      );
    case 'failed':
      return (
        <StatePanel title="We couldn't download their games" platform={platform} username={username}>
          <p>
            {response.retryable
              ? `${site} didn't answer after several tries. It's usually temporary.`
              : `Something went wrong fetching this player from ${site}.`}
          </p>
          <button type="button" className="button" onClick={onRetry}>
            Try again
          </button>
        </StatePanel>
      );
    case 'invalid':
      return (
        <StatePanel title="That doesn't look like a username" search>
          <p>Usernames are 2–30 letters, numbers, underscores or hyphens.</p>
        </StatePanel>
      );
    case 'unknown':
      return (
        <StatePanel title={username} platform={platform} username={username}>
          <p>We haven't scouted this player yet.</p>
          <button type="button" className="button button--primary" onClick={onRetry}>
            Scout for free
          </button>
        </StatePanel>
      );
    case 'ready':
      return null;
  }
}

function problemTitle(problem: Problem): string {
  switch (problem) {
    case 'invalid':
      return "That doesn't look like a username";
    case 'slow_down':
      return 'One moment';
    case 'network':
      return "Can't reach Kestrel";
    case 'server':
      return 'Something went wrong on our side';
  }
}

function problemText(problem: Problem): string {
  switch (problem) {
    case 'invalid':
      return 'Usernames are 2–30 letters, numbers, underscores or hyphens. Check it and search again.';
    case 'slow_down':
      return "You've made a lot of requests in a short time. We'll try again automatically in a few seconds.";
    case 'network':
      return 'Check your internet connection, then try again.';
    case 'server':
      return 'Please try again in a minute.';
  }
}

function ProblemBanner({ problem, onRetry }: { problem: Problem; onRetry: () => void }) {
  return (
    <div className="banner" role="status">
      <p>
        <strong>{problemTitle(problem)}.</strong> {problemText(problem)}
      </p>
      {problem !== 'slow_down' && problem !== 'invalid' && (
        <button type="button" className="button button--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

function StatePanel({
  title,
  platform,
  username,
  busy = false,
  search = false,
  children
}: {
  title: string;
  platform?: Platform;
  username?: string;
  busy?: boolean;
  search?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="panel state" aria-busy={busy}>
      <div className="state__head">
        {busy && <span className="spinner spinner--big" aria-hidden="true" />}
        <h1 tabIndex={-1}>{title}</h1>
        {platform && username && title === username && (
          <span className={`badge badge--${platform}`}>{platformLabel(platform)}</span>
        )}
      </div>
      <div role="status" aria-live="polite">
        {children}
      </div>
      {platform && username && !search && title === username && (
        <p className="small muted">
          <a href={profileUrl(platform, username)} target="_blank" rel="noopener noreferrer">
            Their public profile<span className="visually-hidden"> on {platformLabel(platform)} (opens in a new tab)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        </p>
      )}
      {search && (
        <div className="state__search">
          <h2 className="small-head">Scout someone else</h2>
          <SearchForm compact />
        </div>
      )}
      {!search && (
        <p className="small">
          <Link href="/">Back to search</Link>
        </p>
      )}
    </section>
  );
}
