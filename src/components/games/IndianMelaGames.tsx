import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import type { ArcadeGameId } from '../../shared/types';

interface GameProps {
  onFinish: (gameId: ArcadeGameId, score: number, won: boolean) => void;
}

// 12. Matka Phod (Dahi Handi Indian Clay Pot Smash)
export const MatkaPhodGame: React.FC<GameProps> = ({ onFinish }) => {
  const [throwsLeft, setThrowsLeft] = useState(6);
  const [score, setScore] = useState(0);
  const [potX, setPotX] = useState(50);
  const [broken, setBroken] = useState(false);
  const [msg, setMsg] = useState('Sling upward as the decorated Dahi Handi swings across center!');
  const doneRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      setPotX(50 + Math.sin(t * 2.7) * 35);
    }, 30);
    return () => clearInterval(id);
  }, []);

  const sling = () => {
    if (doneRef.current || throwsLeft <= 0) return;
    const hit = Math.abs(potX - 50) <= 13;
    let nextScore = score;
    if (hit) {
      soundEngine.playPotBreak();
      nextScore += 250;
      setScore(nextScore);
      setBroken(true);
      setMsg('CRACK! Handi Phod! Curd & Laddoos shower down! +250');
      window.setTimeout(() => setBroken(false), 550);
    } else {
      soundEngine.playClick();
      setMsg('Missed the swinging rope pot!');
    }
    const nextThrows = throwsLeft - 1;
    setThrowsLeft(nextThrows);
    if (nextThrows <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('matka_phod', nextScore, nextScore >= 750), 600);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Throws: {throwsLeft}</span>
        <span className="text-amber-700">{msg}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-52 rounded-2xl bg-gradient-to-b from-amber-100 to-orange-200 border-2 border-amber-400 overflow-hidden">
        <div
          style={{ left: `${potX}%`, transform: 'translateX(-50%)' }}
          className="absolute top-0 flex flex-col items-center"
        >
          <div className="w-0.5 h-12 bg-amber-900" />
          <div
            className={`w-16 h-16 rounded-full border-4 border-yellow-300 flex items-center justify-center text-2xl shadow-lg ${
              broken ? 'scale-125 bg-yellow-300' : 'bg-amber-800'
            }`}
          >
            {broken ? '💥' : '🏺'}
          </div>
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-2 border-dashed border-red-600 flex items-center justify-center text-[10px] font-bold text-red-700">
          AIM
        </div>
      </div>
      <button
        type="button"
        onClick={sling}
        disabled={throwsLeft <= 0}
        className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
      >
        Break the Matka! 🏺
      </button>
    </div>
  );
};

// 13. Patang Kite Duel (Indian Makar Sankranti / Mela Kite Battle)
export const PatangKiteDuelGame: React.FC<GameProps> = ({ onFinish }) => {
  const [myY, setMyY] = useState(50);
  const [rivalY, setRivalY] = useState(30);
  const [rivalX, setRivalX] = useState(85);
  const [cuts, setCuts] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(22);
  const myYRef = useRef(50);
  const rivalRef = useRef({ x: 85, y: 30 });
  const scoreRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const tick = window.setInterval(() => {
      rivalRef.current.x -= 2.4;
      if (rivalRef.current.x < 10) {
        rivalRef.current.x = 92;
        rivalRef.current.y = 18 + Math.random() * 64;
      }
      setRivalX(rivalRef.current.x);
      setRivalY(rivalRef.current.y);
    }, 55);

    const timer = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          clearInterval(tick);
          if (!doneRef.current) {
            doneRef.current = true;
            onFinish('kite_duel', scoreRef.current, scoreRef.current >= 540);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      clearInterval(timer);
    };
  }, [onFinish]);

  const moveKite = (delta: number) => {
    const next = Math.max(12, Math.min(88, myYRef.current + delta));
    myYRef.current = next;
    setMyY(next);
  };

  const pullManjha = () => {
    if (doneRef.current) return;
    const dx = Math.abs(rivalRef.current.x - 28);
    const dy = Math.abs(rivalRef.current.y - myYRef.current);
    if (dx < 18 && dy < 18) {
      soundEngine.playCoin();
      scoreRef.current += 180;
      setScore(scoreRef.current);
      setCuts((c) => c + 1);
      rivalRef.current.x = 92;
      rivalRef.current.y = 18 + Math.random() * 64;
    } else {
      soundEngine.playClick();
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Kites Cut: {cuts}</span>
        <span>Time: {timeLeft}s</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-48 rounded-2xl bg-gradient-to-b from-sky-300 to-sky-100 border-2 border-orange-300 overflow-hidden">
        {/* Player Patang */}
        <div
          style={{ left: '28%', top: `${myY}%`, transform: 'translate(-50%, -50%) rotate(45deg)' }}
          className="absolute w-10 h-10 bg-orange-500 border-2 border-yellow-200 shadow-lg"
        />
        {/* Rival Patang */}
        <div
          style={{ left: `${rivalX}%`, top: `${rivalY}%`, transform: 'translate(-50%, -50%) rotate(45deg)' }}
          className="absolute w-9 h-9 bg-purple-600 border-2 border-white shadow-md"
        />
      </div>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => moveKite(-14)} className="px-4 py-2 rounded-xl bg-slate-200 font-bold text-xs">
          ↑ Fly Up
        </button>
        <button type="button" onClick={pullManjha} className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold text-sm">
          Kaat! Pull Manjha! 🪁
        </button>
        <button type="button" onClick={() => moveKite(14)} className="px-4 py-2 rounded-xl bg-slate-200 font-bold text-xs">
          ↓ Dip Down
        </button>
      </div>
    </div>
  );
};

// 14. Kancha (Indian Glass Marbles)
export const KanchaMarblesGame: React.FC<GameProps> = ({ onFinish }) => {
  const [shots, setShots] = useState(5);
  const [marbles, setMarbles] = useState([
    { id: 0, x: 38, knocked: false, color: '#06B6D4' },
    { id: 1, x: 46, knocked: false, color: '#EC4899' },
    { id: 2, x: 54, knocked: false, color: '#F59E0B' },
    { id: 3, x: 62, knocked: false, color: '#10B981' },
    { id: 4, x: 50, knocked: false, color: '#8B5CF6' },
  ]);
  const [aimX, setAimX] = useState(50);
  const [score, setScore] = useState(0);
  const doneRef = useRef(false);

  const flickStriker = () => {
    if (doneRef.current || shots <= 0) return;
    let hits = 0;
    const nextMarbles = marbles.map((m) => {
      if (!m.knocked && Math.abs(m.x - aimX) <= 10) {
        hits++;
        return { ...m, knocked: true };
      }
      return m;
    });
    const gained = hits * 200;
    const nextScore = score + gained;
    setMarbles(nextMarbles);
    setScore(nextScore);
    if (hits > 0) soundEngine.playPop();
    else soundEngine.playClick();

    const nextShots = shots - 1;
    setShots(nextShots);
    if ((nextMarbles.every((m) => m.knocked) || nextShots <= 0) && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('kancha_marbles', nextScore, nextMarbles.filter((m) => m.knocked).length >= 3), 500);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Shots: {shots}</span>
        <span className="text-teal-700">Aim your striker to knock glass kanchas out of the chalk ring!</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-44 rounded-2xl bg-amber-100 border-2 border-teal-400 flex items-center justify-center">
        <div className="w-56 h-32 rounded-full border-4 border-dashed border-white bg-amber-200/70 relative">
          {marbles.map((m) => (
            <div
              key={m.id}
              style={{ left: `${m.x}%`, top: m.id === 4 ? '62%' : '42%', transform: 'translate(-50%, -50%)', backgroundColor: m.color }}
              className={`absolute w-7 h-7 rounded-full border-2 border-white shadow transition-all ${
                m.knocked ? 'opacity-15 -translate-y-10 scale-75' : ''
              }`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 px-4">
        <span className="text-xs font-bold">Aim:</span>
        <input
          type="range"
          min={25}
          max={75}
          value={aimX}
          onChange={(e) => setAimX(Number(e.target.value))}
          className="flex-1 accent-teal-600"
        />
        <button
          type="button"
          onClick={flickStriker}
          disabled={shots <= 0}
          className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold"
        >
          Flick Kancha!
        </button>
      </div>
    </div>
  );
};

// 15. Gilli Danda (Two-Tap Timing)
export const GilliDandaGame: React.FC<GameProps> = ({ onFinish }) => {
  const [turns, setTurns] = useState(3);
  const [phase, setPhase] = useState<'ready' | 'rising'>('ready');
  const [gilliHeight, setGilliHeight] = useState(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Step 1: Tap POP GILLI, then smash it near the peak!');
  const heightRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const popGilli = () => {
    if (phase !== 'ready' || turns <= 0 || doneRef.current) return;
    soundEngine.playClick();
    setPhase('rising');
    setMsg('NOW! Tap SMASH GILLI near the green sweet spot!');
    const start = performance.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const h = Math.round(Math.sin(Math.min(1, elapsed / 1.1) * Math.PI) * 100);
      heightRef.current = h;
      setGilliHeight(h);
      if (elapsed >= 1.1) {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('ready');
        setGilliHeight(0);
        setTurns((t) => {
          const nt = t - 1;
          if (nt <= 0 && !doneRef.current) {
            doneRef.current = true;
            window.setTimeout(() => onFinish('gilli_danda', score, score >= 700), 500);
          }
          return nt;
        });
        setMsg('Too late — gilli dropped!');
      }
    }, 25);
  };

  const smashGilli = () => {
    if (phase !== 'rising' || doneRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const h = heightRef.current;
    const distMeters = Math.round(h * 1.4 + (h >= 78 ? 60 : 0));
    const pts = distMeters * 3;
    soundEngine.playKick();
    const nextScore = score + pts;
    setScore(nextScore);
    setPhase('ready');
    setGilliHeight(0);
    setMsg(`SMASH! Flew ${distMeters}m across the ground! (+${pts} pts)`);
    const nextTurns = turns - 1;
    setTurns(nextTurns);
    if (nextTurns <= 0 && !doneRef.current) {
      doneRef.current = true;
      window.setTimeout(() => onFinish('gilli_danda', nextScore, nextScore >= 700), 650);
    }
  };

  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-between text-xs font-bold text-slate-700">
        <span>Turns: {turns}</span>
        <span className="text-emerald-700">{msg}</span>
        <span>Score: {score}</span>
      </div>
      <div className="relative h-48 rounded-2xl bg-gradient-to-b from-sky-100 to-emerald-200 border-2 border-emerald-400 flex items-end justify-center pb-4 overflow-hidden">
        {/* Sweet spot band */}
        <div className="absolute top-4 left-6 right-6 h-10 rounded-lg bg-emerald-400/35 border border-dashed border-emerald-700 flex items-center justify-center text-[11px] font-bold text-emerald-900">
          SWEET SPOT (MAX DISTANCE)
        </div>
        <div
          style={{ bottom: `${16 + gilliHeight * 1.3}px` }}
          className="absolute w-12 h-3.5 rounded-full bg-amber-700 border-2 border-amber-300 shadow"
        />
      </div>
      <button
        type="button"
        onClick={phase === 'ready' ? popGilli : smashGilli}
        disabled={turns <= 0}
        className={`px-6 py-2.5 rounded-xl text-white text-sm font-bold ${
          phase === 'ready' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
        }`}
      >
        {phase === 'ready' ? '1. Pop Gilli Up!' : '2. SMASH WITH DANDA!'}
      </button>
    </div>
  );
};
