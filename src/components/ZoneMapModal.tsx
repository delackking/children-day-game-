import React from 'react';
import { MapPin, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { CARNIVAL_ZONES } from '../shared/catalog';
import { useGameStore } from '../stores/useGameStore';

interface ZoneMapModalProps {
  onClose: () => void;
}

export const ZoneMapModal: React.FC<ZoneMapModalProps> = ({ onClose }) => {
  const currentZone = useGameStore((s) => s.currentZone);
  const triggerLocalTeleport = useGameStore((s) => s.triggerLocalTeleport);
  const pushToast = useGameStore((s) => s.pushToast);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}>
      <div
        role="dialog"
        aria-label="Carnival Zone Quick Map"
        className="w-full max-w-xl rounded-2xl border border-amber-200 shadow-2xl p-6 text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-3 mb-4">
          <div>
            <h2 className="font-display text-xl font-bold">Carnival Map &amp; Quick Travel</h2>
            <p className="text-xs text-slate-600">Walk along the pathways or jump straight to any carnival zone.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Map"
            className="p-2 rounded-xl hover:bg-amber-100 text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARNIVAL_ZONES.map((z) => {
            const isHere = z.id === currentZone;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  triggerLocalTeleport(z.spawnX, z.spawnZ);
                  pushToast(`Arrived at ${z.name}!`, 'info');
                }}
                className={`text-left p-3.5 rounded-xl border transition-colors ${
                  isHere ? 'border-amber-500 bg-amber-50' : 'border-amber-200 bg-white hover:bg-amber-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" style={{ color: z.color }} />
                    {z.name}
                  </span>
                  {isHere && <span className="text-[11px] font-bold text-amber-700">Here</span>}
                </div>
                <p className="text-xs text-slate-600 mt-1">{z.subtitle}</p>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              triggerLocalTeleport(13, 18);
              pushToast('Arrived at Patakha & Skyshot Bazaar!', 'info');
            }}
            className="text-left p-3.5 rounded-xl border border-orange-300 bg-orange-50/60 hover:bg-orange-100/70 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-orange-600" />
                Patakha &amp; Skyshot Bazaar
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">Buy Skyshots, Anar Fountains, Chakras &amp; Firecrackers</p>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              triggerLocalTeleport(20, 12);
              pushToast('Arrived at Trampoline Jump Zone!', 'info');
            }}
            className="text-left p-3.5 rounded-xl border border-pink-300 bg-pink-50/60 hover:bg-pink-100/70 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-pink-600" />
                Trampoline Jump Zone
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">3 super-bouncy carnival trampolines with combo jumps</p>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              triggerLocalTeleport(16, -9.2);
              pushToast('Arrived at Giant Ferris Wheel Deck! Press E to Ride!', 'info');
            }}
            className="text-left p-3.5 rounded-xl border border-rose-300 bg-rose-50/60 hover:bg-rose-100/70 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-600" />
                Giant Ferris Wheel
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">Board the sky-high gondola ride overlooking Central Plaza</p>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              triggerLocalTeleport(-15.5, -18.5);
              pushToast('Arrived at 3D Mela Games Fairground! Walk up to any booth & press E!', 'info');
            }}
            className="text-left p-3.5 rounded-xl border border-purple-300 bg-purple-50/60 hover:bg-purple-100/70 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-purple-600" />
                Mela Games Fairground (3D)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">6 Live 3D Booths: Matka Phod, Ring Toss, Can Knockdown, High Striker, Duck Pond &amp; Balloons</p>
          </button>
        </div>
      </div>
    </div>
  );
};
