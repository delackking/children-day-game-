import React, { useEffect, useRef, useState } from 'react';
import { socketClient } from '../../net/socketClient';
import type { ArcadeGameId } from '../../shared/types';
import { useGameStore } from '../../stores/useGameStore';

export interface MiniGameProps {
  onFinish: (gameId: ArcadeGameId, score: number, won: boolean) => void;
}

// 1. MEMORY MATCH
const MEMORY_ICONS = ['🪁', '🎪', '🥁', '🥭', '🍧', '🏆', '🎆', '⚽'];
export const MemoryMatchGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [cards, setCards] = useState(() =>
    [...MEMORY_ICONS, ...MEMORY_ICONS]
      .sort(() => Math.random() - 0.5)
      .map((icon, idx) => ({ id: idx, icon, flipped: false, matched: false })),
  );
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const finishedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flip = (idx: number) => {
    if (finishedRef.current || picked.length >= 2 || cards[idx].flipped || cards[idx].matched) return;
    const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(next);
    const nextPicked = [...picked, idx];
    setPicked(nextPicked);

    if (nextPicked.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [a, b] = nextPicked;
      if (next[a].icon === next[b].icon) {
        const matchedNext = next.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
        setCards(matchedNext);
        setPicked([]);
        if (matchedNext.every((c) => c.matched)) {
          finishedRef.current = true;
          const score = Math.max(200, 950 - nextMoves * 25);
          onFinish('memory_match', score, true);
        }
      } else {
        timerRef.current = window.setTimeout(() => {
          setCards((prev) => prev.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
          setPicked([]);
        }, 520);
      }
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-600 text-center">Moves: {moves}</p>
      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => flip(idx)}
            className={`h-14 rounded-xl text-2xl font-bold border transition-colors ${
              c.matched
                ? 'bg-emerald-100 border-emerald-400'
                : c.flipped
                  ? 'bg-amber-100 border-amber-400'
                  : 'bg-slate-800 text-amber-300 border-slate-700'
            }`}
          >
            {c.flipped || c.matched ? c.icon : '?'}
          </button>
        ))}
      </div>
    </div>
  );
};

// 2. TIC TAC TOE (Solo vs Smart Bot OR Live Room Multiplayer Challenge!)
export const TicTacToeGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const [mode, setMode] = useState<'bot' | 'pvp'>('bot');
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [done, setDone] = useState<string | null>(null);

  const checkWinner = (b: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b2, c] of lines) {
      if (b[a] && b[a] === b[b2] && b[a] === b[c]) return b[a];
    }
    return b.every(Boolean) ? 'draw' : null;
  };

  const playBotMove = (idx: number) => {
    if (board[idx] || done) return;
    const next = [...board];
    next[idx] = 'X';
    const w1 = checkWinner(next);
    if (w1) {
      setBoard(next);
      setDone(w1);
      onFinish('tic_tac_toe', w1 === 'X' ? 280 : 120, w1 === 'X');
      return;
    }
    const empty = next.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
    const botIdx = empty[Math.floor(Math.random() * empty.length)];
    if (botIdx !== undefined) next[botIdx] = 'O';
    const w2 = checkWinner(next);
    setBoard(next);
    if (w2) {
      setDone(w2);
      onFinish('tic_tac_toe', w2 === 'X' ? 280 : w2 === 'draw' ? 120 : 60, false);
    }
  };

  const ch = room?.arcadeChallenge;

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setMode('bot')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${mode === 'bot' ? 'bg-slate-900 text-amber-300' : 'bg-slate-200'}`}
        >
          Solo vs Bot
        </button>
        <button
          type="button"
          onClick={() => setMode('pvp')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${mode === 'pvp' ? 'bg-slate-900 text-amber-300' : 'bg-slate-200'}`}
        >
          Room Friend Challenge
        </button>
      </div>

      {mode === 'bot' ? (
        <div className="space-y-3 text-center">
          <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
            {board.map((cell, i) => (
              <button
                key={i}
                type="button"
                onClick={() => playBotMove(i)}
                className="h-16 rounded-xl bg-white border-2 border-amber-300 text-2xl font-display font-extrabold text-slate-900"
              >
                {cell}
              </button>
            ))}
          </div>
          {done && (
            <p className="text-sm font-bold text-amber-800">
              {done === 'X' ? 'You Won!' : done === 'draw' ? 'Friendly Draw!' : 'Carnival Bot Won!'}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-center">
          {!ch || ch.status === 'finished' ? (
            <div className="space-y-2">
              {ch?.status === 'finished' && (
                <p className="text-sm font-bold text-emerald-700">
                  {ch.winnerId === 'draw'
                    ? 'Match ended in a Draw!'
                    : ch.winnerId === localPlayerId
                      ? 'You won the Room Challenge! (+40 coins)'
                      : 'Friend won this round!'}
                </p>
              )}
              <button
                type="button"
                onClick={() => socketClient.createTicTacToeChallenge()}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
              >
                Host New Room Match
              </button>
            </div>
          ) : ch.status === 'waiting' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold">
                {ch.hostName} is waiting for an opponent in this room!
              </p>
              {ch.hostPlayerId !== localPlayerId && (
                <button
                  type="button"
                  onClick={() => socketClient.joinTicTacToeChallenge()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  Join &amp; Start Match
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold">
                {ch.hostName} (X) vs {ch.opponentName} (O) ·{' '}
                {ch.turnPlayerId === localPlayerId ? 'Your Turn!' : "Opponent's Turn"}
              </p>
              <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
                {ch.boardState.map((cell, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => socketClient.playTicTacToeMove(i)}
                    className="h-16 rounded-xl bg-white border-2 border-amber-300 text-2xl font-display font-extrabold"
                  >
                    {cell}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 3. SNAKE (Stable useRef engine — zero interval resets, safe food spawn, WASD + Arrows + buttons)
export const SnakeGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const GRID = 14;
  const [snake, setSnake] = useState([{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }]);
  const [food, setFood] = useState({ x: 10, y: 6 });
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);

  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const scoreRef = useRef(0);
  const dirRef = useRef({ x: 1, y: 0 });
  const pendingDirRef = useRef({ x: 1, y: 0 });
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const queueDir = (dx: number, dy: number) => {
    const cur = dirRef.current;
    if (cur.x === -dx && cur.y === -dy) return;
    pendingDirRef.current = { x: dx, y: dy };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        queueDir(0, -1);
      } else if (e.key === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        queueDir(0, 1);
      } else if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        queueDir(-1, 0);
      } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        queueDir(1, 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!alive) return;
    const t = window.setInterval(() => {
      dirRef.current = pendingDirRef.current;
      const curSnake = snakeRef.current;
      const head = { x: curSnake[0].x + dirRef.current.x, y: curSnake[0].y + dirRef.current.y };
      const ate = head.x === foodRef.current.x && head.y === foodRef.current.y;
      const bodyToCheck = ate ? curSnake : curSnake.slice(0, -1);

      if (
        head.x < 0 ||
        head.x >= GRID ||
        head.y < 0 ||
        head.y >= GRID ||
        bodyToCheck.some((p) => p.x === head.x && p.y === head.y)
      ) {
        setAlive(false);
        finishRef.current('snake', scoreRef.current, scoreRef.current >= 150);
        return;
      }

      const nextSnake = [head, ...(ate ? curSnake : curSnake.slice(0, -1))];
      snakeRef.current = nextSnake;
      setSnake(nextSnake);

      if (ate) {
        scoreRef.current += 50;
        setScore(scoreRef.current);
        // Spawn food on guaranteed free cell
        const free: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            if (!nextSnake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
          }
        }
        const picked = free.length > 0 ? free[Math.floor(Math.random() * free.length)] : { x: 0, y: 0 };
        foodRef.current = picked;
        setFood(picked);
      }
    }, 170);
    return () => clearInterval(t);
  }, [alive]);

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs font-bold">Score: {score} · Arrows / WASD / Buttons</p>
      <div
        className="grid gap-0.5 bg-slate-900 p-2 rounded-xl mx-auto w-fit"
        style={{ gridTemplateColumns: `repeat(${GRID}, 16px)` }}
      >
        {Array.from({ length: GRID * GRID }).map((_, idx) => {
          const x = idx % GRID;
          const y = Math.floor(idx / GRID);
          const isHead = snake[0].x === x && snake[0].y === y;
          const isBody = snake.some((s) => s.x === x && s.y === y);
          const isFood = food.x === x && food.y === y;
          return (
            <div
              key={idx}
              className={`w-4 h-4 rounded-sm ${
                isHead ? 'bg-amber-400' : isBody ? 'bg-emerald-500' : isFood ? 'bg-red-500' : 'bg-slate-800'
              }`}
            />
          );
        })}
      </div>
      <div className="flex justify-center gap-2">
        {[
          { label: 'Up', dx: 0, dy: -1 },
          { label: 'Left', dx: -1, dy: 0 },
          { label: 'Down', dx: 0, dy: 1 },
          { label: 'Right', dx: 1, dy: 0 },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => queueDir(b.dx, b.dy)}
            className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-bold"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// 4. WHACK-A-MOLE (Fixed independent timer so whacking moles doesn't reset the clock)
export const WhackAMoleGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [moleIdx, setMoleIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const scoreRef = useRef(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const secTimer = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(secTimer);
          finishRef.current('whack_a_mole', scoreRef.current, scoreRef.current >= 250);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    const hopTimer = window.setInterval(() => {
      setMoleIdx((prev) => {
        let next = Math.floor(Math.random() * 9);
        if (next === prev) next = (prev + 1) % 9;
        return next;
      });
    }, 680);

    return () => {
      clearInterval(secTimer);
      clearInterval(hopTimer);
    };
  }, []);

  const whack = (idx: number) => {
    if (timeLeft <= 0 || idx !== moleIdx) return;
    scoreRef.current += 50;
    setScore(scoreRef.current);
    setMoleIdx((prev) => (prev + 1 + Math.floor(Math.random() * 8)) % 9);
  };

  return (
    <div className="space-y-3 text-center">
      <p className="text-xs font-bold tabular-nums">
        Time: {timeLeft}s · Score: {score}
      </p>
      <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
        {Array.from({ length: 9 }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => whack(idx)}
            className={`h-16 rounded-xl text-2xl font-bold border-2 transition-colors ${
              idx === moleIdx && timeLeft > 0
                ? 'bg-amber-400 border-amber-600'
                : 'bg-amber-900/15 border-amber-200'
            }`}
          >
            {idx === moleIdx && timeLeft > 0 ? '🐹' : ''}
          </button>
        ))}
      </div>
    </div>
  );
};

// 5. REACTION SPEED TEST (Click or Spacebar + feedback if tapped too early)
export const ReactionSpeedGame: React.FC<MiniGameProps> = ({ onFinish }) => {
  const [phase, setPhase] = useState<'wait' | 'ready' | 'go' | 'tooSoon' | 'done'>('wait');
  const [ms, setMs] = useState<number | null>(null);
  const startRef = useRef(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    if (phase !== 'ready') return;
    const delay = 1100 + Math.random() * 1800;
    const t = window.setTimeout(() => {
      startRef.current = performance.now();
      setPhase('go');
    }, delay);
    return () => clearTimeout(t);
  }, [phase]);

  const tap = () => {
    if (phase === 'wait' || phase === 'tooSoon') {
      setPhase('ready');
    } else if (phase === 'ready') {
      setPhase('tooSoon');
    } else if (phase === 'go') {
      const elapsed = Math.round(performance.now() - startRef.current);
      setMs(elapsed);
      setPhase('done');
      const score = Math.max(100, 800 - elapsed);
      finishRef.current('reaction_speed', score, elapsed < 420);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-3 text-center">
      <button
        type="button"
        onClick={tap}
        className={`w-full max-w-xs h-44 rounded-2xl font-display text-lg font-bold text-white shadow-lg transition-colors ${
          phase === 'go'
            ? 'bg-emerald-600'
            : phase === 'ready'
              ? 'bg-red-600'
              : phase === 'tooSoon'
                ? 'bg-amber-600'
                : 'bg-slate-800'
        }`}
      >
        {phase === 'wait' && 'Click or Space to Start'}
        {phase === 'ready' && 'Wait for Green Lantern...'}
        {phase === 'tooSoon' && 'Too early! Click to retry'}
        {phase === 'go' && 'TAP NOW!'}
        {phase === 'done' && `${ms} ms!`}
      </button>
    </div>
  );
};
