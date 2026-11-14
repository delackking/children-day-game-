import { useEffect, useRef, useState } from 'react';
import { ArcadeHubModal } from './components/ArcadeHubModal';
import { AvatarCustomizerModal } from './components/AvatarCustomizerModal';
import { ChatPanel } from './components/ChatPanel';
import { DanceMenu } from './components/DanceMenu';
import { DjPlayerBar } from './components/DjPlayerBar';
import { FoodStallModal } from './components/FoodStallModal';
import { GameHud } from './components/GameHud';
import { HostDashboardModal } from './components/HostDashboardModal';
import { InventoryModal } from './components/InventoryModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { MelaGameHud } from './components/MelaGameHud';
import { PauseSettingsModal } from './components/PauseSettingsModal';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { ZoneMapModal } from './components/ZoneMapModal';
import { CarnivalEngine } from './engine/carnivalEngine';
import { socketClient } from './net/socketClient';
import { useGameStore } from './stores/useGameStore';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CarnivalEngine | null>(null);

  const screen = useGameStore((s) => s.screen);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const activeStall = useGameStore((s) => s.activeStall);
  const activeMelaGame = useGameStore((s) => s.activeMelaGame);
  const setOverlay = useGameStore((s) => s.setOverlay);

  const [preJoinAvatarOpen, setPreJoinAvatarOpen] = useState(false);

  // Mount Three.js WebGLRenderer once outside re-rendering React HUD state
  useEffect(() => {
    socketClient.connect();
    const el = canvasMountRef.current;
    if (!el || engineRef.current) return;
    const engine = new CarnivalEngine(el);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const closeOverlay = () => setOverlay('none');

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#14243B]">
      {/* Dedicated isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        data-testid="carnival-canvas-mount"
        className="absolute inset-0 w-full h-full"
      />

      {screen === 'title' && (
        <>
          <WelcomeOverlay onOpenAvatarBeforeJoin={() => setPreJoinAvatarOpen(true)} />
          {preJoinAvatarOpen && (
            <AvatarCustomizerModal onClose={() => setPreJoinAvatarOpen(false)} />
          )}
        </>
      )}

      {screen === 'playing' && (
        <>
          {!activeMelaGame && (
            <GameHud
              onInteract={() => engineRef.current?.triggerInteract()}
              onJump={() => engineRef.current?.triggerJump()}
              onKick={() => engineRef.current?.triggerKickOrThrow()}
              onJoystickMove={(x, y) => engineRef.current?.setMobileJoystick(x, y)}
            />
          )}
          {activeMelaGame && (
            <MelaGameHud
              game={activeMelaGame}
              onAction={() => engineRef.current?.triggerMelaAction()}
              onPickDuck={(n) => engineRef.current?.pickMelaDuck(n)}
              onReplay={(id) => engineRef.current?.enterMela3DBooth(id)}
              onExit={() => engineRef.current?.exitMela3DGame()}
            />
          )}
          <DjPlayerBar />

          {activeOverlay === 'avatar' && <AvatarCustomizerModal onClose={closeOverlay} />}
          {activeOverlay === 'food_stall' && activeStall && (
            <FoodStallModal stall={activeStall} onClose={closeOverlay} />
          )}
          {activeOverlay === 'inventory' && <InventoryModal onClose={closeOverlay} />}
          {activeOverlay === 'chat' && <ChatPanel onClose={closeOverlay} />}
          {activeOverlay === 'dance' && <DanceMenu onClose={closeOverlay} />}
          {activeOverlay === 'arcade' && <ArcadeHubModal onClose={closeOverlay} />}
          {activeOverlay === 'leaderboard' && <LeaderboardModal onClose={closeOverlay} />}
          {activeOverlay === 'host' && <HostDashboardModal onClose={closeOverlay} />}
          {activeOverlay === 'zone_map' && <ZoneMapModal onClose={closeOverlay} />}
          {activeOverlay === 'pause' && <PauseSettingsModal onClose={closeOverlay} />}
        </>
      )}
    </main>
  );
}
