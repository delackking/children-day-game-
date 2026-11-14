import React, { useState } from 'react';
import { Coins, Flame, ShoppingBag, Utensils, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import type { FoodItem, FoodStallDef } from '../shared/types';
import { useGameStore } from '../stores/useGameStore';

interface FoodStallModalProps {
  stall: FoodStallDef;
  onClose: () => void;
}

const FoodIllustration: React.FC<{ item: FoodItem }> = ({ item }) => (
  <svg viewBox="0 0 80 80" className="w-16 h-16 shrink-0" aria-hidden="true">
    <rect x="4" y="4" width="72" height="72" rx="14" fill="#FFF7ED" stroke="#FDE68A" strokeWidth="2" />
    {item.visualType === 'plate' && (
      <>
        <ellipse cx="40" cy="48" rx="26" ry="12" fill="#E2E8F0" />
        <ellipse cx="40" cy="45" rx="20" ry="9" fill="#FFFFFF" />
        <circle cx="34" cy="42" r="9" fill={item.primaryColor} />
        <circle cx="48" cy="43" r="7" fill={item.secondaryColor} />
      </>
    )}
    {(item.visualType === 'bottle' || item.visualType === 'cup') && (
      <>
        <rect x="30" y="20" width="20" height="44" rx="5" fill={item.primaryColor} />
        <rect x="34" y="12" width="12" height="8" rx="2" fill={item.secondaryColor} />
        <rect x="32" y="34" width="16" height="14" rx="2" fill={item.secondaryColor} opacity="0.85" />
      </>
    )}
    {item.visualType === 'packet' && (
      <>
        <rect x="22" y="16" width="36" height="48" rx="4" fill={item.primaryColor} />
        <rect x="22" y="32" width="36" height="14" fill={item.secondaryColor} />
        <circle cx="40" cy="39" r="6" fill="#FFFFFF" />
      </>
    )}
    {(item.visualType === 'cone' || item.visualType === 'floss') && (
      <>
        <polygon points="30,42 50,42 40,68" fill={item.secondaryColor} />
        <circle cx="40" cy="34" r="14" fill={item.primaryColor} />
      </>
    )}
    {item.visualType === 'sweet' && (
      <>
        <circle cx="34" cy="44" r="11" fill={item.primaryColor} />
        <circle cx="47" cy="44" r="11" fill={item.secondaryColor} />
        <circle cx="40" cy="32" r="10" fill={item.primaryColor} />
      </>
    )}
    {item.visualType === 'firework' && (
      <>
        <polygon points="40,14 52,32 28,32" fill={item.primaryColor} />
        <rect x="33" y="32" width="14" height="28" rx="2" fill={item.secondaryColor} />
        <path d="M40 60 L36 68 M40 60 L44 68" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      </>
    )}
  </svg>
);

export const FoodStallModal: React.FC<FoodStallModalProps> = ({ stall, onClose }) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const pushToast = useGameStore((s) => s.pushToast);
  const setOverlay = useGameStore((s) => s.setOverlay);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const player = room && localPlayerId ? room.players[localPlayerId] : null;
  const coins = player?.coins ?? 0;

  const buyItem = async (item: FoodItem, useImmediately: boolean) => {
    setBusyId(item.id);
    setStatusNote(null);
    const res = await socketClient.purchaseFood(item.id, 1);
    if (!res.ok) {
      setStatusNote(res.error || 'Could not complete purchase.');
      setBusyId(null);
      return;
    }
    soundEngine.playCoin();
    pushToast(`Bought ${item.name}!`, 'success');

    if (useImmediately && res.player) {
      const newest = res.player.inventory[res.player.inventory.length - 1];
      if (newest) {
        if (item.category === 'firework') {
          const fx = stall.id === 'patakha_bazaar' ? 9.5 : (player?.x ?? 0) + Math.sin(player?.rotY ?? 0) * 4.5;
          const fz = stall.id === 'patakha_bazaar' ? 12.5 : (player?.z ?? 0) + Math.cos(player?.rotY ?? 0) * 4.5;
          const lit = await socketClient.igniteFirework(newest.instanceId, fx, fz);
          if (lit.ok) {
            pushToast(`Lit ${item.name}! Watch the sky!`, 'success');
            setBusyId(null);
            onClose();
            return;
          }
        } else {
          const eatRes = await socketClient.consumeFoodBite(newest.instanceId);
          if (eatRes.ok) {
            if (item.isDrink) soundEngine.playDrinkSip();
            else soundEngine.playEatBite();
            pushToast(
              `${item.isDrink ? 'Sipping' : 'Eating'} ${item.name}! Finishes automatically or press Put Away.`,
              'info',
            );
            setBusyId(null);
            onClose();
            return;
          }
        }
      }
    }
    setStatusNote(
      item.category === 'firework'
        ? `${stall.vendorName}: "Packed your ${item.name}! Press [G] or open Bag [B] to burn it!"`
        : `${stall.vendorName}: "Here is your fresh ${item.name}! Added to your Bag."`,
    );
    setBusyId(null);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}>
      <div
        role="dialog"
        aria-label={stall.name}
        className="w-full max-w-xl rounded-2xl border border-amber-300 shadow-2xl overflow-hidden text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 text-white"
          style={{ backgroundColor: stall.awningColorA }}
        >
          <div>
            <h2 className="font-display text-xl font-bold">{stall.name}</h2>
            <p className="text-xs text-amber-100">
              Vendor: {stall.vendorName} — &ldquo;{stall.greeting}&rdquo;
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stall menu"
            className="p-2 rounded-xl bg-black/20 hover:bg-black/35 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-100 border border-amber-200">
            <span className="text-xs font-bold text-slate-700">Your Carnival Wallet</span>
            <span className="flex items-center gap-1.5 font-mono-num font-bold text-base text-amber-800">
              <Coins className="w-4 h-4 text-amber-600" />
              {coins} Coins
            </span>
          </div>

          {statusNote && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
              {statusNote}
            </div>
          )}

          <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
            {stall.items.map((item) => {
              const canAfford = coins >= item.price;
              const busy = busyId === item.id;
              const isFw = item.category === 'firework';
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-200 bg-white"
                >
                  <div className="flex items-center gap-3.5">
                    <FoodIllustration item={item} />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                      <p className="text-xs text-slate-600">{item.description}</p>
                      <p className="text-xs font-mono-num font-bold text-amber-700 mt-1">
                        {item.price} Coins ·{' '}
                        {isFw ? 'Single Burn Show' : `${item.maxBites} ${item.isDrink ? 'Sips' : 'Bites'}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={!canAfford || busy}
                      aria-label={`Buy ${item.name}`}
                      onClick={() => buyItem(item, false)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-45 text-xs font-bold text-slate-800 whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Buy
                    </button>
                    <button
                      type="button"
                      disabled={!canAfford || busy}
                      aria-label={`Buy and ${isFw ? 'light' : item.isDrink ? 'sip' : 'eat'} ${item.name}`}
                      onClick={() => buyItem(item, true)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl disabled:opacity-45 text-xs font-bold text-white whitespace-nowrap ${
                        isFw ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {isFw ? <Flame className="w-3.5 h-3.5" /> : <Utensils className="w-3.5 h-3.5" />}
                      {isFw ? 'Buy & Light!' : item.isDrink ? 'Buy & Sip' : 'Buy & Eat'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-amber-200">
            <button
              type="button"
              onClick={() => setOverlay('inventory')}
              className="text-xs font-bold text-amber-700 hover:underline"
            >
              Open My Carnival Bag ({player?.inventory.length ?? 0} items)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Back to Carnival
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
