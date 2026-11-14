import React from 'react';
import { Music, Square, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { DANCE_LIST } from '../shared/catalog';
import type { DanceId } from '../shared/types';
import { useGameStore } from '../stores/useGameStore';

interface DanceMenuProps {
  onClose: () => void;
}

export const DanceMenu: React.FC<DanceMenuProps> = ({ onClose }) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const activeDance = room && localPlayerId ? room.players[localPlayerId]?.dance || 'none' : 'none';

  const selectDance = (id: DanceId) => {
    soundEngine.playClick();
    socketClient.setDance(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.68)' }}>
      <div
        role="dialog"
        aria-label="Dance and Emote Menu"
        className="w-full max-w-lg rounded-2xl border border-amber-200 shadow-2xl p-6 text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-red-600" />
            <div>
              <h2 className="font-display text-xl font-bold">Dance &amp; Emotes</h2>
              <p className="text-xs text-slate-600">Keys 1–4 trigger quick dances anytime! Everyone sees your moves.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Dance Menu"
            className="p-2 rounded-xl hover:bg-amber-100 text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {DANCE_LIST.map((d) => {
            const isActive = activeDance === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDance(d.id)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-white hover:bg-amber-50 text-slate-900 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{d.label}</span>
                  {d.hotkey && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num font-bold ${
                        isActive ? 'bg-black/25 text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {d.hotkey}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] mt-1 ${isActive ? 'text-amber-100' : 'text-slate-500'}`}>
                  {d.category === 'dance' ? 'Looping Dance' : 'Social Emote'}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-5 pt-3 border-t border-amber-200">
          <button
            type="button"
            onClick={() => selectDance('none')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-bold"
          >
            <Square className="w-3.5 h-3.5" />
            Stop Dancing
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
