import React, { useEffect, useRef, useState } from 'react';
import { Flag, Send, Smile, X } from 'lucide-react';
import { socketClient } from '../net/socketClient';
import { useGameStore } from '../stores/useGameStore';

interface ChatPanelProps {
  onClose: () => void;
}

const QUICK_EMOJIS = ['🎉', '🥳', '🍔', '⚽', '💃', '🏆', '😄', '🌟'];

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const room = useGameStore((s) => s.room);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const pushToast = useGameStore((s) => s.pushToast);

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.chat.length]);

  if (!room || !localPlayerId) return null;
  const localPlayer = room.players[localPlayerId];
  const disabledForMe = (room.chatDisabled && !localPlayer?.isHost) || Boolean(localPlayer?.muted);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setError(null);
    setSending(true);
    const res = await socketClient.sendChat(text);
    setSending(false);
    if (!res.ok) {
      setError(res.error || 'Could not send message.');
      return;
    }
    setText('');
  };

  const handleReport = async (targetId: string, targetName: string) => {
    await socketClient.reportPlayer(targetId, 'Unkind or inappropriate chat message');
    pushToast(`Reported ${targetName} to the room Host for review.`, 'info');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-3 sm:p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}>
      <div
        role="dialog"
        aria-label="Global Party Chat"
        className="w-full max-w-lg rounded-2xl border border-amber-200 shadow-2xl overflow-hidden text-slate-900 flex flex-col max-h-[82vh]"
        style={{ backgroundColor: '#FFFBF2' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div>
            <h2 className="font-display text-base font-bold">Carnival Party Chat</h2>
            <p className="text-[11px] text-slate-300">
              Messages also pop up as speech bubbles above your avatar!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Chat"
            className="p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[240px]">
          {room.chat.map((msg) => {
            const isMine = msg.playerId === localPlayerId;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={msg.id}
                className={`rounded-xl px-3.5 py-2 text-xs ${
                  msg.kind === 'announcement'
                    ? 'bg-amber-100 border border-amber-300 text-amber-950'
                    : msg.kind === 'system'
                      ? 'bg-slate-100 text-slate-600'
                      : isMine
                        ? 'bg-sky-50 border border-sky-200 text-slate-900'
                        : 'bg-white border border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-bold text-slate-900">
                    {msg.playerName}
                    {msg.isHost && msg.playerId !== 'system' ? ' (Host)' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-num text-slate-500">{time}</span>
                    {msg.kind === 'chat' && !isMine && msg.playerId !== 'system' && (
                      <button
                        type="button"
                        onClick={() => handleReport(msg.playerId, msg.playerName)}
                        aria-label={`Report message from ${msg.playerName}`}
                        title="Report to Host"
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Flag className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-800 break-words">{msg.text}</p>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Emoji Bar */}
        <div className="px-4 py-2 border-t border-amber-200 bg-amber-50/70 flex items-center gap-1.5 overflow-x-auto">
          <Smile className="w-4 h-4 text-amber-600 shrink-0 mr-1" />
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              disabled={disabledForMe}
              onClick={() => setText((prev) => `${prev}${em}`)}
              className="px-2 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-sm"
            >
              {em}
            </button>
          ))}
        </div>

        {error && (
          <p className="px-4 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border-t border-red-200">
            {error}
          </p>
        )}

        <form onSubmit={send} className="p-3 border-t border-amber-200 bg-white flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            maxLength={160}
            disabled={disabledForMe}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              localPlayer?.muted
                ? 'You are muted by the host'
                : room.chatDisabled && !localPlayer?.isHost
                  ? 'Chat paused by host'
                  : 'Say hi to friends nearby...'
            }
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={disabledForMe || sending || !text.trim()}
            aria-label="Send chat message"
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-45 text-white text-sm font-bold flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
