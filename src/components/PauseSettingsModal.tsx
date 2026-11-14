import React from 'react';
import { LogOut, Sliders, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { useGameStore } from '../stores/useGameStore';

interface PauseSettingsModalProps {
  onClose: () => void;
}

export const PauseSettingsModal: React.FC<PauseSettingsModalProps> = ({ onClose }) => {
  const lowGraphics = useGameStore((s) => s.lowGraphics);
  const setLowGraphics = useGameStore((s) => s.setLowGraphics);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const setAudioMuted = useGameStore((s) => s.setAudioMuted);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}>
      <div
        role="dialog"
        aria-label="Pause and Settings"
        className="w-full max-w-md rounded-2xl border border-amber-200 shadow-2xl p-6 text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-600" />
            <h2 className="font-display text-xl font-bold">Pause &amp; Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Resume Carnival"
            className="p-2 rounded-xl hover:bg-amber-100 text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200">
            <div>
              <p className="text-sm font-bold">Sound Effects &amp; DJ Audio</p>
              <p className="text-xs text-slate-500">Toggle all carnival sound effects</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !audioMuted;
                setAudioMuted(next);
                soundEngine.setMuted(next);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${
                audioMuted ? 'bg-slate-200 text-slate-800' : 'bg-emerald-600 text-white'
              }`}
            >
              {audioMuted ? 'Muted' : 'Sound On'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200">
            <div>
              <p className="text-sm font-bold">Mobile / Low-Graphics Mode</p>
              <p className="text-xs text-slate-500">Optimise rendering for older phones</p>
            </div>
            <button
              type="button"
              onClick={() => setLowGraphics(!lowGraphics)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${
                lowGraphics ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {lowGraphics ? 'Battery Saver' : 'Standard'}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-slate-700 space-y-1">
            <p className="font-bold text-slate-900 mb-1">Keyboard &amp; Mouse Controls</p>
            <p><strong>Click World</strong>: Lock Cursor &amp; Look · <strong>Hold Left-Click / WASD</strong>: Walk</p>
            <p><strong>Shift</strong>: Run · <strong>Space</strong>: Jump · <strong>F5</strong>: Switch Camera · <strong>Esc</strong>: Unlock Cursor / Menu</p>
            <p><strong>E</strong>: Interact / Buy · <strong>F</strong>: Kick / Throw Ball · <strong>G</strong>: Light Firework</p>
            <p><strong>T</strong>: Quick Chat (Enter to Send) · <strong>V</strong>: Dance · <strong>B</strong>: Carnival Bag</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-amber-200">
          <button
            type="button"
            onClick={leaveRoom}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            Leave Room
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
          >
            Resume Carnival
          </button>
        </div>
      </div>
    </div>
  );
};
