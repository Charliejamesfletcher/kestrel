import { useMemo } from 'react';
import { boardAt, boardSquares } from './board.js';
import { DEMO_NAME } from './data.js';
import { useBoardLoop } from './hooks.js';

const SQUARES = boardSquares();

export function DemoBoard() {
  const ply = useBoardLoop();
  const board = useMemo(() => boardAt(ply), [ply]);
  const last = board.lastMove;

  return (
    <div className="k-up k-d2 lp-board-col">
      <div className="lp-player">
        <div className="lp-player__who">
          <span className="lp-avatar">R</span>
          <span className="lp-player__names">
            <span className="lp-player__name">
              {DEMO_NAME} <span className="lp-muted-600">(1487)</span>
            </span>
            <span className="lp-player__status">Being scouted</span>
          </span>
        </div>
        <span className="lp-clock">10:00</span>
      </div>

      <div
        className="lp-board"
        role="img"
        aria-label="Example board: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5, the Italian Game"
      >
        <div className="lp-board__grid" aria-hidden="true">
          {SQUARES.map((sq) => {
            const lit = !!last && (last[0] === sq.name || last[1] === sq.name);
            return (
              <div key={sq.name} className={`lp-sq ${sq.dark ? 'lp-sq--dark' : 'lp-sq--light'}`}>
                {lit && <div className="k-fade lp-sq__hl" />}
                {sq.file === 'a' && <span className="lp-sq__rank">{sq.rank}</span>}
                {sq.rank === 1 && <span className="lp-sq__file">{sq.file}</span>}
              </div>
            );
          })}
        </div>
        {board.pieces.map((p) => (
          <svg
            key={p.id}
            className={`k-piece lp-piece ${p.white ? 'lp-piece--white' : 'lp-piece--black'}`}
            viewBox="0 0 45 45"
            aria-hidden="true"
            focusable="false"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              opacity: p.visible ? 1 : 0,
              transitionDelay: `0s, 0s, ${board.resetting ? '0.45s' : '0s'}`
            }}
          >
            <use href={`#pc-${p.type}`} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ))}
      </div>

      <div className="lp-player">
        <div className="lp-player__who">
          <span className="lp-avatar lp-avatar--you">Y</span>
          <span className="lp-player__name">
            You <span className="lp-muted-600">(1502)</span>
          </span>
        </div>
        <span className="lp-clock lp-clock--you">10:00</span>
      </div>

      <div className="k-pop lp-prep" aria-hidden="true">
        <div className="lp-prep__head">
          <span className="k-live lp-prep__dot" />
          <span className="lp-prep__title">PREP EXPLORER</span>
        </div>
        <div className="lp-prep__moves">
          {board.moveList.map((m, i) => (
            <span key={m} className={`k-fade${i === board.moveList.length - 1 ? ' lp-prep__move--last' : ''}`}>
              {m}
            </span>
          ))}
        </div>
        <div className="lp-rule" />
        <span className="lp-prep__note">{board.note}</span>
        <div className="lp-prep__meter">
          <div className="lp-prep__meter-row">
            <span>Played in their games</span>
            <span className="lp-white">{board.pct}%</span>
          </div>
          <div className="lp-track">
            <div className="lp-track__fill lp-prep__fill" style={{ width: `${board.pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
