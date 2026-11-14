import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Disc3, ExternalLink, Pause, Play, Volume2, Youtube } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { DEFAULT_DJ_PLAYLIST } from '../shared/catalog';
import { extractYouTubeVideoId } from '../shared/rules';
import { useGameStore } from '../stores/useGameStore';

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          height?: string;
          width?: string;
          videoId?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onError?: () => void;
          };
        },
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (id: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  setVolume: (vol: number) => void;
  destroy: () => void;
}

const YT_PRESETS = [
  { label: 'Festive Lofi', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { label: 'Happy Pop Mix', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A' },
];

export const DjPlayerBar: React.FC = () => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const hostSecret = useGameStore((s) => s.hostSecret);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const localYoutubeId = useGameStore((s) => s.localYoutubeId);
  const localYoutubeTitle = useGameStore((s) => s.localYoutubeTitle);
  const setLocalYoutube = useGameStore((s) => s.setLocalYoutube);
  const pushToast = useGameStore((s) => s.pushToast);

  const ytMountRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const [ytEmbedError, setYtEmbedError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ytInput, setYtInput] = useState('');
  const lastLoadedYtId = useRef<string | null>(null);

  const dj = room?.dj;
  const localPlayer = room && localPlayerId ? room.players[localPlayerId] : null;
  const isHost = Boolean(localPlayer?.isHost && hostSecret);
  const activeYoutubeId = localYoutubeId || dj?.youtubeId || null;

  // Load Official YouTube IFrame Player API when a YouTube track is selected
  useEffect(() => {
    if (!activeYoutubeId) {
      setYtEmbedError(false);
      return;
    }

    if (window.YT?.Player) {
      setYtReady(true);
      return;
    }

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };
  }, [activeYoutubeId]);

  // Manage YouTube player playback synchronization
  useEffect(() => {
    if (!activeYoutubeId || !ytReady || !ytMountRef.current || !window.YT?.Player) {
      if (!activeYoutubeId && ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
        lastLoadedYtId.current = null;
      }
      return;
    }

    const shouldPlay = localYoutubeId ? true : Boolean(dj?.isPlaying);
    const vol = dj?.volume ?? 70;
    const offsetSec =
      !localYoutubeId && dj?.isPlaying
        ? dj.pausedOffsetSec + Math.max(0, (Date.now() - dj.startedAt) / 1000)
        : dj?.pausedOffsetSec || 0;

    if (!ytPlayerRef.current) {
      setYtEmbedError(false);
      lastLoadedYtId.current = activeYoutubeId;
      ytPlayerRef.current = new window.YT.Player(ytMountRef.current, {
        height: '100',
        width: '210',
        videoId: activeYoutubeId,
        playerVars: {
          autoplay: shouldPlay ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          start: Math.floor(offsetSec),
        },
        events: {
          onReady: (ev) => {
            ev.target.setVolume(audioMuted ? 0 : vol);
            if (shouldPlay) ev.target.playVideo();
            else ev.target.pauseVideo();
          },
          onError: () => {
            setYtEmbedError(true);
          },
        },
      });
    } else {
      const p = ytPlayerRef.current;
      if (lastLoadedYtId.current !== activeYoutubeId) {
        lastLoadedYtId.current = activeYoutubeId;
        setYtEmbedError(false);
        p.loadVideoById(activeYoutubeId, Math.floor(offsetSec));
      }
      p.setVolume(audioMuted ? 0 : vol);
      if (shouldPlay) p.playVideo();
      else p.pauseVideo();
    }
  }, [activeYoutubeId, localYoutubeId, dj?.isPlaying, dj?.volume, dj?.startedAt, dj?.pausedOffsetSec, ytReady, audioMuted]);

  // Procedural Web Audio DJ music when using built-in festival tracks (no YouTube ID active)
  useEffect(() => {
    if (!dj || activeYoutubeId || !dj.isPlaying || audioMuted) {
      soundEngine.stopDjSynth();
      return;
    }
    soundEngine.startDjSynth(dj.trackId, dj.volume);
    return () => {
      soundEngine.stopDjSynth();
    };
  }, [dj?.trackId, activeYoutubeId, dj?.isPlaying, dj?.volume, audioMuted]);

  if (!dj) return null;

  const handleLoadYoutube = async (rawInput: string) => {
    const vid = extractYouTubeVideoId(rawInput);
    if (!vid) {
      pushToast('Paste a valid YouTube link or 11-character video ID.', 'warning');
      return;
    }
    if (isHost) {
      setLocalYoutube(null, null);
      const res = await socketClient.hostUpdateDj({
        youtubeInput: rawInput.trim(),
        isPlaying: true,
      });
      if (res.ok) {
        pushToast('YouTube track synced to all Carnival players!', 'success');
        setYtInput('');
      }
    } else {
      setLocalYoutube(vid, `Personal YouTube (${vid})`);
      pushToast('Playing your chosen YouTube track!', 'success');
      setYtInput('');
    }
  };

  return (
    <div
      className="fixed top-24 left-3 sm:top-auto sm:bottom-20 sm:left-4 z-15 pointer-events-auto rounded-2xl border border-amber-300/40 px-3 py-2 text-white shadow-xl max-w-[250px] sm:max-w-xs"
      style={{ backgroundColor: 'rgba(30, 27, 75, 0.92)' }}
    >
      <div className="flex items-center gap-2">
        <Disc3 className={`w-4 h-4 text-amber-400 shrink-0 ${dj.isPlaying || localYoutubeId ? 'animate-spin' : ''}`} />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
          aria-label="Toggle DJ and YouTube Music Player"
        >
          <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
            <Youtube className="w-3 h-3 text-red-400" />
            {localYoutubeId ? 'Personal YT' : dj.isPlaying ? 'DJ & YouTube Live' : 'Music & YouTube'}
          </p>
          <p className="text-xs font-semibold truncate">{localYoutubeId ? localYoutubeTitle : dj.title}</p>
        </button>

        {isHost && (
          <button
            type="button"
            onClick={() => socketClient.hostUpdateDj({ isPlaying: !dj.isPlaying })}
            aria-label={dj.isPlaying ? 'Pause DJ music' : 'Play DJ music'}
            className="p-1.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300"
          >
            {dj.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse music drawer' : 'Expand music drawer'}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-200"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-white/15 space-y-2.5">
          {/* Built-in Festive Tracks */}
          {isHost && (
            <div className="flex flex-wrap gap-1">
              {DEFAULT_DJ_PLAYLIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setLocalYoutube(null, null);
                    socketClient.hostUpdateDj({ trackId: t.id, youtubeInput: null, isPlaying: true });
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    dj.trackId === t.id && !dj.youtubeId
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/10 text-slate-100 hover:bg-white/20'
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}

          {/* YouTube Link Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLoadYoutube(ytInput);
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={ytInput}
              onChange={(e) => setYtInput(e.target.value)}
              placeholder="Paste YouTube URL or ID..."
              aria-label="YouTube music URL"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-[11px] text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold shrink-0"
            >
              Play YT
            </button>
          </form>

          <div className="flex items-center justify-between gap-1 text-[10px]">
            <div className="flex items-center gap-1">
              {YT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleLoadYoutube(p.url)}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-sky-200 font-semibold"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {localYoutubeId && (
              <button
                type="button"
                onClick={() => setLocalYoutube(null, null)}
                className="text-amber-300 hover:underline font-semibold"
              >
                Use Room DJ
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-300">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              Volume {dj.volume}%
            </span>
            {isHost && (
              <input
                type="range"
                min={0}
                max={100}
                value={dj.volume}
                onChange={(e) => socketClient.hostUpdateDj({ volume: Number(e.target.value) })}
                aria-label="DJ Volume"
                className="w-24 accent-amber-400"
              />
            )}
          </div>
        </div>
      )}

      {activeYoutubeId && (
        <div className="mt-2">
          <div ref={ytMountRef} className="rounded-lg overflow-hidden" />
          {ytEmbedError && (
            <a
              href={dj.youtubeUrl || `https://www.youtube.com/watch?v=${activeYoutubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Open on YouTube
            </a>
          )}
        </div>
      )}
    </div>
  );
};
