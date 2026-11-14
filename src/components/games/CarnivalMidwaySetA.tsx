import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import type { ArcadeGameId } from '../../shared/types';

interface GameProps {
  onFinish: (gameId: ArcadeGameId, score: number, won: boolean) => void;
}

// 1. Ring Toss (Hoopla)
export const RingTossGame: React.FC<GameProps> = ({ onFinish }) => {
  const [ringsLeft, setRingsLeft] = useState(6);
  const [score, setScore] = useState(0);
  const [aimX, setAimX] = useState(50);
  const [power, setPower] = useState(50);
  const [landedPegs, setLandedPegs] = useState<number[]>([]);
  const [status, setStatus] = useState('Line up the cursor over a prize peg and toss!');
  const doneRef = useRef(false);

  const pegs = [
    { id: 0, x: 20, y: 38, pts: 120, label: 'Teddy', color: '#EC4899' },
    { id: 1, x: 50, y: 26, pts: 250, label: 'Gold Crown', color: '#F59E0B' },
    { id: 2, x: 80, y: 38, pts: 120, label: 'Duck', color: '#06B6D4' },
    { id: 3, x: 35, y: 64, pts: 160, label: 'Laddoo', color: '#10B981' },
    { id: 4, x: 65, y: 64, pts: 160, label: 'Rocket', color: '#8B5CF6' },
  ];

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - start) / 1000;
      setAimX(50 + Math.sin(t * 2.6) * 40);
      setPower(50 + Math.cos(t * 3.3) * 40);
    }, 30);
    return () => clearInterval(id);
  }, []);

  const tossRing = () => {
    if (doneRef.current || ringsLeft <= 0) return;
    const hit = pegs.find((p) => Math.abs(p.x - aimX) < 12 && Math.abs(p.y - power) < 16);
    let nextScore = score;
    if (hit) {
      soundEngine.playCoin();
      nextScore += hit.pts;
      setScore(nextScore);
      setLandedPegs((prev) => [...prev, hit.id]);
      setStatus(`Ringed ${hit.label}! +${hit.pts} pts`);
    } else {
      soundEngine.playClick();
      setStatus('Bounced off the peg! Try lining up X & Depth.');
    }

    const nextRings = ringsLeft - 1;
    setRingsLeft(nextRings);
    if (nextRings <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('ring_toss', nextScore, nextScore >= 300), 500);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700 px-1">
        <span>Rings Left: {ringsLeft}</span>
        <span className="text-pink-600">{status}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-56 rounded-2xl border-2 border-pink-200 bg-gradient-to-b from-amber-50 to-orange-100 overflow-hidden">
        {pegs.map((p) => {
          const ringedCount = landedPegs.filter((id) => id === p.id).length;
          return (
            <div
              key={p.id}
              style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
              className="absolute flex flex-col items-center"
            >
              <div
                className="w-9 h-9 rounded-full border-4 flex items-center justify-center text-[10px] font-bold text-white shadow"
                style={{ backgroundColor: p.color, borderColor: ringedCount > 0 ? '#FACC15' : '#FFF' }}
              >
                {p.pts}
              </div>
              <span className="text-[10px] font-bold text-slate-700 mt-0.5">{p.label}</span>
            </div>
          );
        })}
        <div
          style={{ left: `${aimX}%`, top: `${power}%`, transform: 'translate(-50%, -50%)' }}
          className="absolute w-11 h-11 rounded-full border-4 border-dashed border-red-600 pointer-events-none"
        />
      </div>
      <button
        type="button"
        onClick={tossRing}
        disabled={ringsLeft <= 0}
        className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold shadow"
      >
        Toss Ring!
      </button>
    </div>
  );
};

// 2. Can Knockdown (Pyramid Knockdown)
export const CanKnockdownGame: React.FC<GameProps> = ({ onFinish }) => {
  const [cans, setCans] = useState<boolean[]>(Array(10).fill(true));
  const [throwsLeft, setThrowsLeft] = useState(5);
  const [aimX, setAimX] = useState(50);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Aim at the bottom center of the pyramid to collapse multiple cans!');
  const doneRef = useRef(false);

  // Pyramid coordinates [row, col, centerX]
  const layout = [
    { idx: 0, x: 50, row: 0 },
    { idx: 1, x: 42, row: 1 },
    { idx: 2, x: 58, row: 1 },
    { idx: 3, x: 34, row: 2 },
    { idx: 4, x: 50, row: 2 },
    { idx: 5, x: 66, row: 2 },
    { idx: 6, x: 26, row: 3 },
    { idx: 7, x: 42, row: 3 },
    { idx: 8, x: 58, row: 3 },
    { idx: 9, x: 74, row: 3 },
  ];

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setAimX(50 + Math.sin(((performance.now() - t0) / 1000) * 3.1) * 34);
    }, 30);
    return () => clearInterval(id);
  }, []);

  const throwBag = () => {
    if (doneRef.current || throwsLeft <= 0) return;
    const nextCans = [...cans];
    let knocked = 0;
    layout.forEach((c) => {
      if (nextCans[c.idx] && Math.abs(c.x - aimX) <= 13) {
        nextCans[c.idx] = false;
        knocked++;
      }
    });
    // Chain collapse: upper cans without support fall too!
    if (!nextCans[4]) {
      if (nextCans[1] && Math.random() < 0.7) { nextCans[1] = false; knocked++; }
      if (nextCans[2] && Math.random() < 0.7) { nextCans[2] = false; knocked++; }
    }
    if (!nextCans[1] && !nextCans[2] && nextCans[0]) {
      nextCans[0] = false;
      knocked++;
    }

    const gained = knocked * 120;
    const nextScore = score + gained;
    const remainingCans = nextCans.filter(Boolean).length;
    setCans(nextCans);
    setScore(nextScore);
    if (knocked > 0) {
      soundEngine.playPotBreak();
      setMsg(`CRASH! Knocked down ${knocked} can${knocked > 1 ? 's' : ''}! +${gained}`);
    } else {
      soundEngine.playClick();
      setMsg('Whiff! Aim closer to standing cans.');
    }

    const nextThrows = throwsLeft - 1;
    setThrowsLeft(nextThrows);
    if ((remainingCans === 0 || nextThrows <= 0) && !doneRef.current) {
      doneRef.current = true;
      const bonus = remainingCans === 0 ? nextThrows * 100 : 0;
      const finalScore = nextScore + bonus;
      window.setTimeout(() => onFinish('can_knockdown', finalScore, remainingCans <= 2), 550);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Beanbags: {throwsLeft}</span>
        <span className="text-orange-600">{msg}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-56 rounded-2xl bg-slate-900 border-2 border-orange-300 flex flex-col justify-end pb-8 overflow-hidden">
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex justify-center gap-2">
              {layout
                .filter((c) => c.row === row)
                .map((c) => (
                  <div
                    key={c.idx}
                    className={`w-8 h-9 rounded-md border transition-all duration-300 flex items-center justify-center text-[10px] font-bold ${
                      cans[c.idx]
                        ? 'bg-gradient-to-b from-red-500 to-amber-500 border-amber-200 text-white'
                        : 'opacity-15 translate-y-4 rotate-45 bg-slate-600 border-slate-500'
                    }`}
                  >
                    CAN
                  </div>
                ))}
            </div>
          ))}
        </div>
        {/* Aim track at bottom */}
        <div className="absolute bottom-2 left-4 right-4 h-2 bg-slate-700 rounded-full">
          <div
            style={{ left: `${aimX}%`, transform: 'translate(-50%, -25%)' }}
            className="absolute w-5 h-5 rounded-full bg-amber-400 border-2 border-white shadow"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={throwBag}
        disabled={throwsLeft <= 0}
        className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold"
      >
        Throw Beanbag!
      </button>
    </div>
  );
};

// 3. Balloon Pop Darts
export const BalloonPopGame: React.FC<GameProps> = ({ onFinish }) => {
  const palette = ['#EF4444', '#F59E0B', '#10B981', '#0284C7', '#EC4899', '#8B5CF6'];
  const [balloons, setBalloons] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      popped: false,
      golden: i === 2 || i === 7 || i === 10,
      color: palette[i % palette.length],
      phase: i * 0.7,
    })),
  );
  const [darts, setDarts] = useState(12);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          if (!doneRef.current) {
            doneRef.current = true;
            onFinish('balloon_pop', scoreRef.current, scoreRef.current >= 500);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onFinish]);

  const popBalloon = (idx: number) => {
    if (doneRef.current || darts <= 0 || balloons[idx].popped) return;
    soundEngine.playPop();
    const pts = balloons[idx].golden ? 200 : 100;
    const nextScore = scoreRef.current + pts;
    scoreRef.current = nextScore;
    setScore(nextScore);
    const nextB = balloons.map((b, i) => (i === idx ? { ...b, popped: true } : b));
    setBalloons(nextB);
    const nextDarts = darts - 1;
    setDarts(nextDarts);
    if ((nextB.every((b) => b.popped) || nextDarts <= 0) && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('balloon_pop', nextScore, nextScore >= 500), 400);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Darts: {darts}</span>
        <span>Time: {timeLeft}s</span>
        <span>Score: {score}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 p-4 rounded-2xl bg-sky-50 border-2 border-sky-200">
        {balloons.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            disabled={b.popped}
            onClick={() => popBalloon(idx)}
            className={`h-16 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-md transition-transform active:scale-90 ${
              b.popped ? 'opacity-15 scale-75 bg-slate-300' : 'hover:scale-105 animate-bounce'
            }`}
            style={{
              backgroundColor: b.popped ? undefined : b.golden ? '#EAB308' : b.color,
              animationDuration: `${1.8 + (idx % 3) * 0.4}s`,
            }}
          >
            {b.popped ? 'POP!' : b.golden ? '200' : '100'}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-600">Tap gold balloons first for double points!</p>
    </div>
  );
};

// 4. Duck Pond (Matching Ducks)
export const DuckPondGame: React.FC<GameProps> = ({ onFinish }) => {
  const [ducks] = useState(() => {
    const vals = [100, 100, 200, 200, 350, 350, 50, 500];
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    return vals;
  });
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const doneRef = useRef(false);

  const pickDuck = (idx: number) => {
    if (doneRef.current || picked.includes(idx) || picked.length >= 4) return;
    soundEngine.playSplash();
    const nextPicked = [...picked, idx];
    const nextScore = score + ducks[idx];
    setPicked(nextPicked);
    setScore(nextScore);
    if (nextPicked.length >= 4 && !doneRef.current) {
      doneRef.current = true;
      // Bonus if any two picked ducks match!
      const vals = nextPicked.map((i) => ducks[i]);
      const hasMatch = new Set(vals).size < vals.length;
      const finalScore = nextScore + (hasMatch ? 250 : 0);
      window.setTimeout(() => onFinish('duck_pond', finalScore, finalScore >= 600), 650);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Picks Left: {4 - picked.length}</span>
        <span className="text-cyan-700">Pick 4 ducks — Matching numbers win +250 bonus!</span>
        <span>Score: {score}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 p-5 rounded-2xl bg-gradient-to-b from-cyan-400 to-sky-600 border-2 border-cyan-200">
        {ducks.map((val, idx) => {
          const isRevealed = picked.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={isRevealed}
              onClick={() => pickDuck(idx)}
              className={`h-16 rounded-2xl font-bold shadow-md transition-all flex flex-col items-center justify-center ${
                isRevealed
                  ? 'bg-white text-slate-900 scale-95'
                  : 'bg-yellow-300 hover:bg-yellow-200 text-amber-900 hover:-translate-y-1'
              }`}
            >
              <span className="text-lg">{isRevealed ? `+${val}` : '🐥'}</span>
              <span className="text-[10px]">{isRevealed ? 'Revealed' : `Duck #${idx + 1}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// 5. Cup Ball Toss
export const CupBallTossGame: React.FC<GameProps> = ({ onFinish }) => {
  const [ballsLeft, setBallsLeft] = useState(6);
  const [score, setScore] = useState(0);
  const [aimX, setAimX] = useState(50);
  const [msg, setMsg] = useState('Wait for the aim cursor to pass over Gold (250) or Cyan (150) cups!');
  const doneRef = useRef(false);

  const cups = [
    { x: 18, pts: 100, color: '#EF4444' },
    { x: 34, pts: 150, color: '#06B6D4' },
    { x: 50, pts: 250, color: '#F59E0B' },
    { x: 66, pts: 150, color: '#06B6D4' },
    { x: 82, pts: 100, color: '#EF4444' },
  ];

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setAimX(50 + Math.sin(((performance.now() - t0) / 1000) * 3.4) * 38);
    }, 30);
    return () => clearInterval(id);
  }, []);

  const toss = () => {
    if (doneRef.current || ballsLeft <= 0) return;
    const hit = cups.find((c) => Math.abs(c.x - aimX) <= 7.5);
    let nextScore = score;
    if (hit) {
      soundEngine.playCoin();
      nextScore += hit.pts;
      setScore(nextScore);
      setMsg(`Plop! Landed in the ${hit.pts}-pt cup!`);
    } else {
      soundEngine.playPop();
      setMsg('Bounced off the rim! Try timing the cup center.');
    }
    const nextBalls = ballsLeft - 1;
    setBallsLeft(nextBalls);
    if (nextBalls <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('cup_ball_toss', nextScore, nextScore >= 400), 450);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Balls: {ballsLeft}</span>
        <span className="text-cyan-700">{msg}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-48 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-cyan-300 flex items-center justify-around px-4">
        {cups.map((c, idx) => (
          <div
            key={idx}
            className="w-14 h-20 rounded-b-2xl border-4 border-white/80 flex items-center justify-center font-bold text-white shadow-lg"
            style={{ backgroundColor: c.color }}
          >
            {c.pts}
          </div>
        ))}
        <div
          style={{ left: `${aimX}%`, transform: 'translateX(-50%)' }}
          className="absolute bottom-3 w-5 h-5 rounded-full bg-white border-2 border-amber-400 shadow"
        />
      </div>
      <button
        type="button"
        onClick={toss}
        disabled={ballsLeft <= 0}
        className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold"
      >
        Toss Ping-Pong Ball!
      </button>
    </div>
  );
};

// 6. Dunk Tank Splash
export const DunkTankGame: React.FC<GameProps> = ({ onFinish }) => {
  const [ballsLeft, setBallsLeft] = useState(5);
  const [score, setScore] = useState(0);
  const [dunks, setDunks] = useState(0);
  const [targetY, setTargetY] = useState(50);
  const [dunkedAnim, setDunkedAnim] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setTargetY(50 + Math.sin(((performance.now() - t0) / 1000) * 3.8) * 36);
    }, 30);
    return () => clearInterval(id);
  }, []);

  const throwBall = () => {
    if (doneRef.current || ballsLeft <= 0) return;
    const hit = Math.abs(targetY - 50) <= 15;
    let nextScore = score;
    if (hit) {
      soundEngine.playSplash();
      nextScore += 300;
      setScore(nextScore);
      setDunks((d) => d + 1);
      setDunkedAnim(true);
      window.setTimeout(() => setDunkedAnim(false), 600);
    } else {
      soundEngine.playClick();
    }
    const nextBalls = ballsLeft - 1;
    setBallsLeft(nextBalls);
    if (nextBalls <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('dunk_tank', nextScore, nextScore >= 600), 650);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Softballs: {ballsLeft}</span>
        <span>Dunks: {dunks}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-52 rounded-2xl bg-sky-100 border-2 border-sky-400 flex items-center justify-around p-4">
        <div className="flex flex-col items-center">
          <div className={`text-3xl transition-transform duration-300 ${dunkedAnim ? 'translate-y-16' : 'translate-y-0'}`}>
            🤡
          </div>
          <div className="w-28 h-24 rounded-b-xl bg-cyan-500/80 border-2 border-cyan-700 flex items-center justify-center text-white text-xs font-bold">
            {dunkedAnim ? 'SPLASH!!' : 'WATER TANK'}
          </div>
        </div>
        <div className="relative w-14 h-40 rounded-full bg-slate-200 border-2 border-slate-400">
          <div className="absolute top-1/2 left-0 right-0 h-8 -translate-y-1/2 bg-emerald-200/80 border-y border-emerald-500" />
          <div
            style={{ top: `${targetY}%`, transform: 'translate(-50%, -50%)', left: '50%' }}
            className="absolute w-10 h-10 rounded-full bg-red-600 border-4 border-white shadow flex items-center justify-center text-[10px] font-bold text-white"
          >
            HIT
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={throwBall}
        disabled={ballsLeft <= 0}
        className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
      >
        Throw at Bullseye Lever!
      </button>
    </div>
  );
};
