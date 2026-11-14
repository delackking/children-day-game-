import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import {
  ACCESSORIES_CATALOG,
  HAIR_COLORS,
  HAIRSTYLES,
  OUTFIT_CATALOG,
  SKIN_TONES,
  TOP_COLOR_SWATCHES,
} from '../shared/catalog';
import type { AccessoryId, AvatarConfig } from '../shared/types';
import { useGameStore } from '../stores/useGameStore';

interface AvatarCustomizerModalProps {
  onClose: () => void;
}

export const AvatarCustomizerModal: React.FC<AvatarCustomizerModalProps> = ({ onClose }) => {
  const screen = useGameStore((s) => s.screen);
  const draftAvatar = useGameStore((s) => s.draftAvatar);
  const setDraftAvatar = useGameStore((s) => s.setDraftAvatar);
  const pushToast = useGameStore((s) => s.pushToast);

  const [preview, setPreview] = useState<AvatarConfig>({
    ...draftAvatar,
    accessories: [...draftAvatar.accessories],
  });
  const [tab, setTab] = useState<'traditional' | 'casual'>('traditional');
  const [saving, setSaving] = useState(false);

  const toggleAccessory = (id: AccessoryId) => {
    const has = preview.accessories.includes(id);
    setPreview({
      ...preview,
      accessories: has ? preview.accessories.filter((a) => a !== id) : [...preview.accessories, id],
    });
  };

  const handleSave = async () => {
    soundEngine.playClick();
    setDraftAvatar(preview);
    if (screen === 'playing') {
      setSaving(true);
      await socketClient.updateAvatar(preview);
      setSaving(false);
      pushToast('Outfit & look updated for everyone in the room!', 'success');
    }
    onClose();
  };

  const filteredOutfits = OUTFIT_CATALOG.filter((o) => o.category === tab);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}>
      <div
        role="dialog"
        aria-label="Avatar Wardrobe and Customisation"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-amber-200 shadow-2xl p-6 text-slate-900"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Avatar Wardrobe</h2>
            <p className="text-xs text-slate-600">Preview your Traditional &amp; Casual outfits before applying.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Wardrobe"
            className="p-2 rounded-xl hover:bg-amber-100 text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Live SVG Character Preview */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-900 p-5 text-white">
            <svg viewBox="0 0 160 220" className="w-40 h-56" aria-label="Avatar outfit preview">
              {/* Background Spotlight */}
              <circle cx="80" cy="110" r="72" fill="#1E3A5F" />
              {/* Legs */}
              <rect x="56" y="135" width="18" height="55" rx="6" fill={preview.bottomColor} />
              <rect x="86" y="135" width="18" height="55" rx="6" fill={preview.bottomColor} />
              {/* Shoes */}
              <rect x="53" y="184" width="24" height="12" rx="4" fill={preview.accessories.includes('sneakers') ? '#38BDF8' : '#334155'} />
              <rect x="83" y="184" width="24" height="12" rx="4" fill={preview.accessories.includes('sneakers') ? '#38BDF8' : '#334155'} />
              {/* Torso */}
              <rect x="48" y="76" width="64" height="64" rx="12" fill={preview.topColor} />
              {(preview.outfit === 'nehru_royal' || preview.outfit === 'sherwani_festive') && (
                <rect x="54" y="78" width="52" height="56" rx="8" fill={preview.outfit === 'sherwani_festive' ? '#92400E' : '#1E293B'} />
              )}
              {/* Arms */}
              <rect x="30" y="78" width="15" height="50" rx="7" fill={preview.topColor} />
              <rect x="115" y="78" width="15" height="50" rx="7" fill={preview.topColor} />
              {/* Watch & Bracelet */}
              {preview.accessories.includes('watch') && <rect x="30" y="114" width="15" height="5" fill="#FACC15" />}
              {preview.accessories.includes('bracelet') && <rect x="115" y="114" width="15" height="5" fill="#EC4899" />}
              {/* Head & Hair */}
              <circle cx="80" cy="48" r="24" fill={preview.skinTone} />
              <path d="M56,44 Q80,14 104,44 Z" fill={preview.hairColor} />
              {preview.hairstyle === 'festive_bun' && <circle cx="80" cy="18" r="9" fill={preview.hairColor} />}
              {preview.hairstyle === 'twin_braids' && (
                <>
                  <rect x="50" y="44" width="7" height="28" rx="3" fill={preview.hairColor} />
                  <rect x="103" y="44" width="7" height="28" rx="3" fill={preview.hairColor} />
                </>
              )}
              {/* Eyes / Sunglasses */}
              {preview.accessories.includes('sunglasses') ? (
                <>
                  <rect x="63" y="42" width="14" height="8" rx="2" fill="#0284C7" stroke="#0F172A" strokeWidth="2" />
                  <rect x="83" y="42" width="14" height="8" rx="2" fill="#0284C7" stroke="#0F172A" strokeWidth="2" />
                </>
              ) : (
                <>
                  <circle cx="71" cy="46" r="2.6" fill="#0F172A" />
                  <circle cx="89" cy="46" r="2.6" fill="#0F172A" />
                </>
              )}
              <path d="M72,56 Q80,62 88,56" fill="none" stroke="#991B1B" strokeWidth="2.4" strokeLinecap="round" />
              {preview.accessories.includes('cap') && (
                <>
                  <path d="M55,36 Q80,16 105,36 Z" fill="#DC2626" />
                  <rect x="62" y="34" width="44" height="5" rx="2" fill="#FACC15" />
                </>
              )}
            </svg>
            <p className="text-xs font-semibold text-amber-300 mt-2">
              {OUTFIT_CATALOG.find((o) => o.id === preview.outfit)?.name}
            </p>
          </div>

          {/* Customization Controls */}
          <div className="md:col-span-2 space-y-5">
            {/* Skin Tone & Hairstyle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">Skin Tone</p>
                <div className="flex items-center gap-2">
                  {SKIN_TONES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Skin tone ${s.name}`}
                      onClick={() => setPreview({ ...preview, skinTone: s.hex })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        preview.skinTone === s.hex ? 'border-slate-900 scale-110' : 'border-white'
                      }`}
                      style={{ backgroundColor: s.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">Hair Color</p>
                <div className="flex items-center gap-2">
                  {HAIR_COLORS.map((hc) => (
                    <button
                      key={hc}
                      type="button"
                      aria-label={`Hair color ${hc}`}
                      onClick={() => setPreview({ ...preview, hairColor: hc })}
                      className={`w-7 h-7 rounded-full border-2 ${
                        preview.hairColor === hc ? 'border-amber-500 scale-110' : 'border-white'
                      }`}
                      style={{ backgroundColor: hc }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="hairstyle-select" className="block text-xs font-bold text-slate-700 mb-1">
                Hairstyle
              </label>
              <select
                id="hairstyle-select"
                value={preview.hairstyle}
                onChange={(e) => setPreview({ ...preview, hairstyle: e.target.value as AvatarConfig['hairstyle'] })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium"
              >
                {HAIRSTYLES.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Outfits */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700">Clothing Category</p>
                <div className="flex gap-1 p-0.5 bg-amber-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTab('traditional')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold ${
                      tab === 'traditional' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Traditional
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('casual')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold ${
                      tab === 'casual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Casual
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredOutfits.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      setPreview({
                        ...preview,
                        outfit: o.id,
                        topColor: o.defaultTop,
                        bottomColor: o.defaultBottom,
                      })
                    }
                    className={`text-left p-2.5 rounded-xl border transition-colors ${
                      preview.outfit === o.id
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900">{o.name}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{o.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Outfit Color Swatches */}
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2">Kurta / Top Color</p>
              <div className="flex flex-wrap gap-2">
                {TOP_COLOR_SWATCHES.map((col) => (
                  <button
                    key={col}
                    type="button"
                    aria-label={`Outfit color ${col}`}
                    onClick={() => setPreview({ ...preview, topColor: col })}
                    className={`w-7 h-7 rounded-lg border-2 ${
                      preview.topColor === col ? 'border-slate-900 scale-110' : 'border-white'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Accessories */}
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2">Accessories</p>
              <div className="flex flex-wrap gap-2">
                {ACCESSORIES_CATALOG.map((acc) => {
                  const active = preview.accessories.includes(acc.id);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccessory(acc.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        active
                          ? 'bg-slate-900 text-amber-300 border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {acc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-amber-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Applying...' : 'Apply & Save Look'}
          </button>
        </div>
      </div>
    </div>
  );
};
