import React, { useState } from 'react';
import { Flame, Utensils, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { useGameStore } from '../stores/useGameStore';

interface InventoryModalProps {
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ onClose }) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const pushToast = useGameStore((s) => s.pushToast);
  const setOverlay = useGameStore((s) => s.setOverlay);

  const [busyId, setBusyId] = useState<string | null>(null);

  const player = room && localPlayerId ? room.players[localPlayerId] : null;
  if (!player) return null;

  const handleEat = async (instanceId: string) => {
    setBusyId(instanceId);
    const res = await socketClient.consumeFoodBite(instanceId);
    setBusyId(null);
    if (!res.ok) {
      pushToast(res.error || 'Could not consume item.', 'warning');
      return;
    }
    if (res.isDrink) soundEngine.playDrinkSip();
    else soundEngine.playEatBite();

    if (res.finished) {
      pushToast(`Finished ${res.itemName}! Delicious!`, 'success');
    } else {
      pushToast(
        `${res.isDrink ? 'Took a sip of' : 'Took a bite of'} ${res.itemName}!`,
        'info',
      );
    }
  };

  const handleIgnite = async (instanceId: string, name: string) => {
    setBusyId(instanceId);
    const res = await socketClient.igniteFirework(instanceId, player.x, player.z);
    setBusyId(null);
    if (!res.ok) {
      pushToast(res.error || 'Could not light firework.', 'warning');
      return;
    }
    pushToast(`Lit ${name}! Look at the celebration!`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}>
      <div
        role="dialog"
        aria-label="Carnival Bag and Inventory"
        className="w-full max-w-lg rounded-2xl border border-amber-200 shadow-2xl p-6 text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-3 mb-4">
          <div>
            <h2 className="font-display text-xl font-bold">My Carnival Bag</h2>
            <p className="text-xs text-slate-600">
              Eat snacks, sip drinks, or light Skyshots &amp; Firecrackers live for everyone!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Bag"
            className="p-2 rounded-xl hover:bg-amber-100 text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {player.consuming && (
          <div className="mb-3 flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-100 border border-amber-300 text-xs">
            <span className="font-semibold text-amber-950">
              Currently enjoying <strong>{player.consuming.name}</strong> ({player.consuming.bitesRemaining}/{player.consuming.maxBites})
            </span>
            <button
              type="button"
              onClick={() => socketClient.stopConsuming()}
              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold"
            >
              Put Away
            </button>
          </div>
        )}

        {player.inventory.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-700">Your carnival bag is empty right now.</p>
            <p className="text-xs text-slate-500">
              Visit Indian Food Street for snacks or Patakha Bazaar near Plaza for Skyshots &amp; Firecrackers!
            </p>
            <button
              type="button"
              onClick={() => setOverlay('zone_map')}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
            >
              Jump to Food Street / Bazaar
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {player.inventory.map((entry) => {
              const isFw = entry.category === 'firework';
              const pct = Math.round((entry.bitesRemaining / entry.maxBites) * 100);
              return (
                <div
                  key={entry.instanceId}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-200 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {entry.name}{' '}
                      {isFw && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-bold">
                          FIREWORK
                        </span>
                      )}
                    </p>
                    {isFw ? (
                      <p className="text-[11px] font-semibold text-orange-700 mt-1">
                        Ready to light &amp; burn! (Shortcut: G)
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-28 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono-num font-semibold text-slate-600">
                          {entry.bitesRemaining}/{entry.maxBites} {entry.isDrink ? 'sips' : 'bites'}
                        </span>
                      </div>
                    )}
                  </div>
                  {isFw ? (
                    <button
                      type="button"
                      disabled={busyId === entry.instanceId}
                      onClick={() => handleIgnite(entry.instanceId, entry.name)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shrink-0"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      Light &amp; Burn!
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === entry.instanceId}
                      onClick={() => handleEat(entry.instanceId)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      {entry.isDrink ? 'Take Sip' : 'Take Bite'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between mt-5 pt-3 border-t border-amber-200">
          <span className="text-xs font-semibold text-slate-600">
            Items enjoyed today: <strong className="font-mono-num text-slate-900">{player.stats.foodsEaten}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
