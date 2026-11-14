import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import { socketClient } from '../net/socketClient';
import { ALL_STALLS, INITIAL_BALLS, TRAMPOLINE_PADS } from '../shared/catalog';
import { AUTO_BITE_INTERVAL_MS, clampWorldPosition, detectZoneAt, MAX_CONSUME_DURATION_MS } from '../shared/rules';
import type { BallState, FireworkEffectType, TimeOfDay } from '../shared/types';
import { useGameStore } from '../stores/useGameStore';
import {
  animateAvatarRig,
  createAvatarRig,
  disposeAvatarRig,
  updateAvatarAppearanceAndState,
  type AvatarRig,
} from './avatarBuilder';
import type { Mela3DGameId } from '../shared/mela3d';
import { computeMelaRewardCoins } from '../shared/mela3d';
import { MelaGames3DManager } from './melaGames3D';
import { NpcManager } from './npcManager';
import { SportsPhysicsEngine } from './physics';
import { buildCarnivalWorld, type BoxCollider2D, type WorldHandles } from './worldBuilder';

// Scratch vectors allocated once outside the 60fps loop (Zero-GC)
const _camAnchor = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _dummyMatrix = new THREE.Matrix4();
const _dummyColor = new THREE.Color();
const _ferrisWorldPos = new THREE.Vector3();
const _todBgColor = new THREE.Color();
const _todHemiSky = new THREE.Color();
const _todHemiGround = new THREE.Color();
const _todSunColor = new THREE.Color();

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: number;
}

interface ActivePyroEmitter {
  effect: FireworkEffectType;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  age: number;
  maxAge: number;
  stepAccum: number;
  subIndex: number;
  burstColor?: number;
  rocketMesh?: THREE.Mesh;
  shockRing?: THREE.Mesh;
  detonated?: boolean;
}

export class CarnivalEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private isSoftwareGl: boolean;
  private world!: WorldHandles;
  private melaGames!: MelaGames3DManager;
  private npcManager: NpcManager;
  private physics: SportsPhysicsEngine;

  private localRig: AvatarRig | null = null;
  private remoteRigs = new Map<string, { rig: AvatarRig; targetX: number; targetY: number; targetZ: number; targetRotY: number }>();

  // Local player physics state
  private px = 0;
  private py = 0;
  private pz = 54;
  private pvx = 0;
  private pvy = 0;
  private pvz = 0;
  private pRotY = Math.PI; // Facing North (-Z) through Grand Entrance Arch -> Central Plaza & Ferris Wheel!
  private grounded = true;
  private stepAccum = 0;

  // Camera orbit state (yaw=0 places rear camera at +Z behind player looking North -Z)
  private camYaw = 0;
  private camPitch = 0.24;
  private camDist = 6.2;
  private camPosCurrent = new THREE.Vector3(0, 4.2, 60.5);
  private camLookCurrent = new THREE.Vector3(0, 1.5, 50);
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private hasLastHover = false;
  private lastHoverX = 0;
  private lastHoverY = 0;
  private lastLowGraphics = false;
  private envRT: THREE.WebGLRenderTarget | null = null;

  // Input state
  private keys = new Set<string>();
  private leftMouseHeld = false;
  private pointerLocked = false;
  private mobileMoveX = 0;
  private mobileMoveY = 0;
  private lastTeleportNonce = 0;
  private lastFireworkSeen = 0;
  private lastZoneReported = '';
  private lastPromptKey = '';
  private lastGoalScoredAt = 0;
  private trampCombo = 0;
  private lastTrampBounceAt = 0;
  private ridingFerrisIndex = -1;
  private consumeStepAccum = 0;
  private lastConsumeKey = '';
  private activePyros: ActivePyroEmitter[] = [];
  private cameraShakeTime = 0;
  private recentThrownBalls = new Map<string, number>();
  private lastLocalKickAt = 0;
  private lastBallsRef: BallState[] | null = null;
  private livePlayersScratch: Record<string, { x: number; y: number; z: number; rotY: number }> = {};
  private currentTod: TimeOfDay = 'day';
  private todBlend = 1;

  // Pooled particles (Zero-GC ring buffer)
  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#BFE2FF');
    this.scene.fog = new THREE.FogExp2('#BFE2FF', 0.0042);

    this.camera = new THREE.PerspectiveCamera(
      58,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.15,
      300,
    );

    // Mandatory studio environment map for metallic brass/gold reflections (dispose RoomEnvironment immediately!)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.envRT = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    envScene.dispose();
    pmrem.dispose();

    // Warm golden key light + cool sky/ground hemisphere fill
    this.hemiLight = new THREE.HemisphereLight('#93C5FD', '#785C3E', 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#FFE4B5', 1.65);
    this.sunLight.position.set(38, 52, 34);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(512, 512);
      this.sunLight.shadow.camera.near = 5;
      this.sunLight.shadow.camera.far = 160;
      const d = 55;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sunLight);

    this.npcManager = new NpcManager();
    this.world = buildCarnivalWorld(this.scene, this.renderer.capabilities.getMaxAnisotropy(), this.npcManager);
    this.melaGames = new MelaGames3DManager(
      this.scene,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.world.colliders,
      this.world.cameraOccluders,
      {
        onHudChange: (snap) => useGameStore.getState().setActiveMelaGame(snap),
        onCompleteGame: async (gameId, score) => {
          const res = await socketClient.submitArcadeScore(gameId, score, score >= 350);
          return res.rewardCoins ?? computeMelaRewardCoins(score);
        },
        onParticles: (x, y, z, count, color) => this.spawnParticleBurst(x, y, z, count, color),
      },
    );
    this.npcManager.spawnRoamers(this.scene);

    // Pooled Fireworks & Celebration Particle Ring Buffer (200 particles for low RAM/VRAM)
    const pCount = 200;
    const pGeo = new THREE.SphereGeometry(0.16, 5, 5);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, pCount);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < pCount; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        color: 0xfacc15,
      });
      _dummyMatrix.makeTranslation(0, -50, 0);
      this.particleMesh.setMatrixAt(i, _dummyMatrix);
      this.particleMesh.setColorAt(i, _dummyColor.setHex(0xfacc15));
    }
    this.scene.add(this.particleMesh);

    this.physics = new SportsPhysicsEngine();
    this.physics.init(INITIAL_BALLS);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.updateCamera(0.016, 0);
    this.renderer.render(this.scene, this.camera);
    this.startLoop();
  }

  private bindEvents(): void {
    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.render(this.scene, this.camera);
    };
    this.resizeObserver = new ResizeObserver(onResize);
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', onResize);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearInputs);
    document.addEventListener('visibilitychange', this.clearInputs);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onPointerLeave = () => {
    this.hasLastHover = false;
  };

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.pointerLocked = locked;
    useGameStore.getState().setPointerLocked(locked);
    if (!locked) {
      this.leftMouseHeld = false;
      this.isDragging = false;
      this.hasLastHover = false;
    }
  };

  private clearInputs = () => {
    this.keys.clear();
    this.isDragging = false;
    this.leftMouseHeld = false;
    this.hasLastHover = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

    const st = useGameStore.getState();
    if (st.screen !== 'playing') return;

    const code = e.code;

    if (code === 'KeyT' && st.activeOverlay === 'none' && !st.quickChatOpen) {
      e.preventDefault();
      this.clearInputs();
      if (document.pointerLockElement) document.exitPointerLock?.();
      st.setQuickChatOpen(true);
      return;
    }

    if (st.quickChatOpen) {
      if (code === 'Escape') st.setQuickChatOpen(false);
      return;
    }

    this.keys.add(code);

    // Live 3D In-World Mela Game Controls
    if (this.melaGames.isActive()) {
      if (code === 'Escape') {
        e.preventDefault();
        this.exitMela3DGame();
        return;
      }
      if (code === 'Space' || code === 'Enter') {
        e.preventDefault();
        this.melaGames.onPrimaryAction();
        return;
      }
      if (code >= 'Digit1' && code <= 'Digit6') {
        this.melaGames.pickDuck(Number(code.replace('Digit', '')));
        return;
      }
      this.keys.add(code);
      return;
    }

    if (code === 'F5') {
      e.preventDefault();
      st.cycleCameraMode();
      return;
    }
    if (code === 'Escape') {
      if (st.activeOverlay !== 'none') {
        st.setOverlay('none');
      } else {
        st.setOverlay('pause');
      }
      return;
    }
    if (code === 'KeyV') {
      st.setOverlay(st.activeOverlay === 'dance' ? 'none' : 'dance');
      return;
    }
    if (code === 'KeyB') {
      st.setOverlay(st.activeOverlay === 'inventory' ? 'none' : 'inventory');
      return;
    }
    if (code === 'KeyG' && st.activeOverlay === 'none') {
      const me = st.localPlayerId ? st.room?.players[st.localPlayerId] : null;
      const fw = me?.inventory.find((i) => i.category === 'firework');
      if (fw) {
        const lx = this.px + Math.sin(this.pRotY) * 4.5;
        const lz = this.pz + Math.cos(this.pRotY) * 4.5;
        socketClient.igniteFirework(fw.instanceId, lx, lz);
      } else {
        st.pushToast('No fireworks in bag! Visit Patakha Bazaar near Plaza.', 'info');
      }
      return;
    }
    if (code === 'KeyE') {
      this.triggerInteract();
      return;
    }
    if (code === 'KeyF') {
      this.triggerKickOrThrow();
      return;
    }

    // 1-4 Quick Dances
    if (st.activeOverlay === 'none') {
      if (code === 'Digit1') socketClient.setDance('normal_dance');
      if (code === 'Digit2') socketClient.setDance('funny_dance');
      if (code === 'Digit3') socketClient.setDance('celebration');
      if (code === 'Digit4') socketClient.setDance('jump_dance');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    const st = useGameStore.getState();
    if (st.screen !== 'playing' || st.activeOverlay !== 'none' || st.quickChatOpen) return;

    if (document.activeElement instanceof HTMLElement && document.activeElement !== this.renderer.domElement) {
      document.activeElement.blur();
    }

    if (this.melaGames.isActive()) {
      if (e.button === 0) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.melaGames.onPrimaryAction(e.clientX, e.clientY, this.camera, rect);
      }
      return;
    }

    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.lastHoverX = e.clientX;
    this.lastHoverY = e.clientY;
    this.hasLastHover = true;
    if (e.button === 0) {
      this.leftMouseHeld = true;
    }

    // Lock cursor on canvas click during gameplay so mouse-look + LMB move work smoothly
    if (!this.pointerLocked && this.renderer.domElement.requestPointerLock) {
      try {
        const res = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch {
        // Ignore browsers blocking pointer lock without gesture
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const st = useGameStore.getState();
    if (st.screen !== 'playing' || st.activeOverlay !== 'none' || st.quickChatOpen) {
      this.hasLastHover = false;
      return;
    }

    if (this.melaGames.isActive()) {
      this.hasLastHover = false;
      if (e.target === this.renderer.domElement) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.melaGames.onPointerMove(e.clientX, e.clientY, this.camera, rect);
      }
      return;
    }

    if (this.pointerLocked) {
      const mx = Math.max(-180, Math.min(180, e.movementX));
      const my = Math.max(-180, Math.min(180, e.movementY));
      this.camYaw -= mx * 0.0028;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + my * 0.0022, -0.55, 1.05);
      return;
    }

    const dxRaw = this.hasLastHover ? e.clientX - this.lastHoverX : 0;
    const dyRaw = this.hasLastHover ? e.clientY - this.lastHoverY : 0;
    this.lastHoverX = e.clientX;
    this.lastHoverY = e.clientY;
    this.hasLastHover = true;

    const isMoving =
      this.keys.has('KeyW') ||
      this.keys.has('KeyS') ||
      this.keys.has('KeyA') ||
      this.keys.has('KeyD') ||
      this.keys.has('ArrowUp') ||
      this.keys.has('ArrowDown');

    if (!this.isDragging && !isMoving) return;

    const dx = this.isDragging ? e.clientX - this.lastPointerX : Math.max(-120, Math.min(120, dxRaw));
    const dy = this.isDragging ? e.clientY - this.lastPointerY : Math.max(-120, Math.min(120, dyRaw));
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    const sensX = this.isDragging ? 0.0055 : 0.0042;
    const sensY = this.isDragging ? 0.004 : 0.003;
    this.camYaw -= dx * sensX;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sensY, -0.55, 1.05);
  };

  private onPointerUp = (e: PointerEvent) => {
    this.isDragging = false;
    if (e.button === 0) this.leftMouseHeld = false;
  };

  private onWheel = (e: WheelEvent) => {
    this.camDist = THREE.MathUtils.clamp(this.camDist + e.deltaY * 0.005, 3.0, 12.5);
  };

  setMobileJoystick(x: number, y: number): void {
    this.mobileMoveX = x;
    this.mobileMoveY = y;
  }

  triggerJump(): void {
    if (this.grounded) {
      this.pvy = 8.4;
      this.grounded = false;
      soundEngine.playJump();
    }
  }

  triggerInteract(): void {
    const st = useGameStore.getState();
    const prompt = st.nearbyPrompt;
    if (!prompt) return;
    soundEngine.playClick();

    if (prompt.kind === 'stall') {
      const stall = ALL_STALLS.find((s) => s.id === prompt.id);
      if (stall) st.openStall(stall);
    } else if (prompt.kind === 'npc') {
      const npc = this.npcManager.npcs.find((n) => n.def.id === prompt.id);
      if (npc) {
        const line = npc.def.dialogue[npc.dialogueIndex % npc.def.dialogue.length];
        npc.dialogueIndex += 1;
        st.setNpcDialogue({ name: npc.def.name, role: npc.def.role.replace('_', ' '), text: line });
        window.setTimeout(() => {
          if (useGameStore.getState().activeNpcDialogue?.name === npc.def.name) {
            useGameStore.getState().setNpcDialogue(null);
          }
        }, 4500);
      }
    } else if (prompt.kind === 'arcade') {
      st.setOverlay('arcade');
    } else if (prompt.kind === 'mela_3d') {
      this.enterMela3DBooth(prompt.id as Mela3DGameId);
    } else if (prompt.kind === 'ferris') {
      if (this.ridingFerrisIndex >= 0) {
        this.dismountFerris();
      } else {
        this.ridingFerrisIndex = 0;
        st.pushToast('Riding Giant Ferris Wheel! Press E or Space to hop off.', 'success');
      }
    } else if (prompt.kind === 'dj') {
      st.setOverlay('dance');
    } else if (prompt.kind === 'stage') {
      st.setOverlay('leaderboard');
    } else if (prompt.kind === 'treasure') {
      socketClient.claimTreasure(prompt.id).then((res) => {
        if (res.ok) {
          soundEngine.playCoin();
          this.spawnParticleBurst(this.px, 1.4, this.pz, 18, 0xfacc15);
          st.pushToast(`Found ${res.label}! +${res.rewardCoins} coins`, 'success');
        } else if (res.error) {
          st.pushToast(res.error, 'warning');
        }
      });
    } else if (prompt.kind === 'ball') {
      const me = st.localPlayerId ? st.room?.players[st.localPlayerId] : null;
      if (me?.heldBallId === prompt.id) {
        this.triggerKickOrThrow();
      } else {
        socketClient.pickupBall(prompt.id).then((res) => {
          if (res.ok) {
            st.pushToast('Picked up ball in hands! Press E or F to throw!', 'success');
          } else if (res.error) {
            st.pushToast(res.error, 'warning');
          }
        });
      }
    }
  }

  public enterMela3DBooth(gameId: Mela3DGameId): void {
    this.clearInputs();
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (this.melaGames.startGame(gameId)) {
      const b = this.melaGames.getActiveBooth();
      if (b) {
        this.px = b.standX;
        this.py = 0;
        this.pz = b.standZ;
        this.pvx = 0;
        this.pvy = 0;
        this.pvz = 0;
        this.pRotY = b.standRotY;
        this.grounded = true;
      }
    }
  }

  public triggerMelaAction(): void {
    this.melaGames.onPrimaryAction();
  }

  public pickMelaDuck(num: number): void {
    this.melaGames.pickDuck(num);
  }

  public exitMela3DGame(): void {
    this.melaGames.exitGame();
  }

  triggerKickOrThrow(): void {
    const st = useGameStore.getState();
    const room = st.room;
    const me = st.localPlayerId ? room?.players[st.localPlayerId] : null;
    if (!room || !me) return;

    // Check held ball or nearest ball within 2.5m
    let targetBall = me.heldBallId ? room.balls.find((b) => b.id === me.heldBallId) : null;
    if (!targetBall) {
      let bestD = 2.6;
      for (const b of room.balls) {
        const bm = this.world.ballMeshes.get(b.id);
        const bx = bm ? bm.position.x : b.x;
        const bz = bm ? bm.position.z : b.z;
        const d = Math.hypot(bx - this.px, bz - this.pz);
        if (d < bestD && !b.holderId) {
          bestD = d;
          targetBall = b;
        }
      }
    }
    if (!targetBall) return;

    soundEngine.playKick();
    const dirX = Math.sin(this.pRotY);
    const dirZ = Math.cos(this.pRotY);
    const isThrow = Boolean(me.heldBallId === targetBall.id);
    const power = isThrow ? 15 : 18;
    const lift = isThrow ? 8.5 : 5.2;

    const bm = this.world.ballMeshes.get(targetBall.id);
    const startX = isThrow ? this.px + dirX * 0.72 : (bm ? bm.position.x : this.px + dirX * 0.8);
    const startY = isThrow ? this.py + 1.08 : (bm ? Math.max(0.45, bm.position.y) : 0.6);
    const startZ = isThrow ? this.pz + dirZ * 0.72 : (bm ? bm.position.z : this.pz + dirZ * 0.8);

    const now = Date.now();
    this.recentThrownBalls.set(targetBall.id, now);
    this.lastLocalKickAt = now;
    this.physics.kickBall(targetBall.id, startX, startY, startZ, dirX * power, lift, dirZ * power);
    socketClient.kickBall({
      ballId: targetBall.id,
      x: startX,
      y: startY,
      z: startZ,
      vx: dirX * power,
      vy: lift,
      vz: dirZ * power,
    });
  }

  spawnParticleBurst(x: number, y: number, z: number, count: number, colorHex: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.65;
      const spd = 4 + Math.random() * 8;
      slot.vx = Math.cos(theta) * Math.sin(phi) * spd;
      slot.vy = Math.cos(phi) * spd + 3;
      slot.vz = Math.sin(theta) * Math.sin(phi) * spd;
      slot.life = 0;
      slot.maxLife = 0.9 + Math.random() * 0.6;
      slot.color = colorHex;
    }
  }

  private resolveCollisions(nx: number, nz: number): { x: number; z: number } {
    let x = nx;
    let z = nz;
    const r = 0.48;
    const cols: BoxCollider2D[] = this.world.colliders;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const closestX = Math.max(c.minX, Math.min(x, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = r - dist;
          x += (dx / dist) * push;
          z += (dz / dist) * push;
        } else {
          z += r;
        }
      }
    }
    return clampWorldPosition(x, z);
  }

  private updateLocalPlayer(dt: number, elapsed: number): void {
    const st = useGameStore.getState();

    // Check teleports triggered by Zone Map or Host
    if (st.teleportNonce && st.teleportNonce.nonce !== this.lastTeleportNonce) {
      this.lastTeleportNonce = st.teleportNonce.nonce;
      this.ridingFerrisIndex = -1;
      this.px = st.teleportNonce.x;
      this.pz = st.teleportNonce.z;
      this.py = 0;
      this.pvy = 0;
      this.grounded = true;
      this.camPosCurrent.set(this.px, 3.8, this.pz + 6.2);
      this.camLookCurrent.set(this.px, 1.45, this.pz);
    }

    const overlayBlocksMove = st.activeOverlay !== 'none' || st.quickChatOpen;
    if (overlayBlocksMove) {
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.leftMouseHeld = false;
    }

    const activeBooth = this.melaGames.getActiveBooth();
    if (activeBooth) {
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.px = activeBooth.standX;
      this.py = 0;
      this.pz = activeBooth.standZ;
      this.pvx = 0;
      this.pvy = 0;
      this.pvz = 0;
      this.pRotY = activeBooth.standRotY;
      this.grounded = true;
      let aimDx = 0;
      let aimDy = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) aimDx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) aimDx += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) aimDy += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) aimDy -= 1;
      if (aimDx !== 0 || aimDy !== 0) {
        this.melaGames.onAimDelta(aimDx * dt * 1.6, aimDy * dt * 1.6);
      }
    } else if (this.ridingFerrisIndex >= 0) {
      const gondola = this.world.ferrisGondolas[this.ridingFerrisIndex];
      if (gondola) {
        gondola.getWorldPosition(_ferrisWorldPos);
        this.px = _ferrisWorldPos.x;
        this.py = Math.max(0.4, _ferrisWorldPos.y - 0.9);
        this.pz = _ferrisWorldPos.z;
        this.pvx = 0;
        this.pvy = 0;
        this.pvz = 0;
        this.grounded = true;
      }
      if (!overlayBlocksMove && this.keys.has('Space')) {
        this.keys.delete('Space');
        this.dismountFerris();
      }
    } else {
      let inX = 0;
      let inZ = 0;
      let running = false;

      if (!overlayBlocksMove) {
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inZ -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inZ += 1;
        if (this.keys.has('KeyA')) inX -= 1;
        if (this.keys.has('KeyD')) inX += 1;

        // Smooth keyboard steering when pressing W + A/D (when not mouse-aiming) or ArrowLeft/ArrowRight or Q
        if (this.keys.has('ArrowLeft') || this.keys.has('KeyQ')) {
          this.camYaw += dt * 2.1;
          if (!this.keys.has('KeyW') && !this.keys.has('ArrowUp')) inX -= 0.4;
        }
        if (this.keys.has('ArrowRight')) {
          this.camYaw -= dt * 2.1;
          if (!this.keys.has('KeyW') && !this.keys.has('ArrowUp')) inX += 0.4;
        }
        if ((this.keys.has('KeyW') || this.keys.has('ArrowUp')) && !this.pointerLocked && !this.isDragging) {
          if (this.keys.has('KeyA')) this.camYaw += dt * 1.45;
          if (this.keys.has('KeyD')) this.camYaw -= dt * 1.45;
        }

        // Hold Left Mouse Button when cursor is locked to walk forward smoothly!
        if (this.pointerLocked && this.leftMouseHeld) inZ -= 1;

        inX += this.mobileMoveX;
        inZ += this.mobileMoveY;
        running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

        if (this.keys.has('Space') && this.grounded) {
          this.triggerJump();
        }
      }

      const len = Math.hypot(inX, inZ);
      const maxSpeed = running ? 9.6 : 6.0;
      if (len > 0.05) {
        const nx = inX / Math.max(1, len);
        const nz = inZ / Math.max(1, len);
        // Move relative to camera yaw
        const sinY = Math.sin(this.camYaw);
        const cosY = Math.cos(this.camYaw);
        const worldDirX = nx * cosY + nz * sinY;
        const worldDirZ = -nx * sinY + nz * cosY;

        this.pvx = worldDirX * maxSpeed;
        this.pvz = worldDirZ * maxSpeed;
        const targetRot = Math.atan2(worldDirX, worldDirZ);
        let diff = targetRot - this.pRotY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.pRotY += diff * Math.min(1, dt * 12);
      } else {
        const friction = Math.exp(-14 * dt);
        this.pvx *= friction;
        this.pvz *= friction;
      }

      const nextPos = this.resolveCollisions(this.px + this.pvx * dt, this.pz + this.pvz * dt);
      this.px = nextPos.x;
      this.pz = nextPos.z;

      // Trampoline Super-Bounce Check
      for (const pad of TRAMPOLINE_PADS) {
        const d = Math.hypot(this.px - pad.x, this.pz - pad.z);
        if (d <= pad.radius + 0.12 && this.py <= 0.65 && this.pvy <= 1.2) {
          const now = Date.now();
          this.trampCombo = now - this.lastTrampBounceAt < 3500 ? Math.min(4, this.trampCombo + 1) : 1;
          this.lastTrampBounceAt = now;
          this.pvy = Math.min(21.0, 18.0 + (this.trampCombo - 1) * 1.1);
          this.py = 0.55;
          this.grounded = false;
          this.world.triggerTrampolineBounce(pad.id);
          soundEngine.playTrampolineBoing(this.trampCombo);
          this.spawnParticleBurst(pad.x, 0.75, pad.z, 14, 0xfacc15);
          if (this.trampCombo >= 2) {
            st.pushToast(`Trampoline x${this.trampCombo} Super Bounce!`, 'success');
          }
          break;
        }
      }

      // Vertical jump & gravity
      if (!this.grounded) {
        this.pvy -= 22 * dt;
        this.py += this.pvy * dt;
        if (this.py <= 0) {
          this.py = 0;
          this.pvy = 0;
          this.grounded = true;
        }
      }

      const horizSpeedFoot = Math.hypot(this.pvx, this.pvz);
      if (horizSpeedFoot > 1.2 && this.grounded) {
        this.stepAccum += horizSpeedFoot * dt;
        if (this.stepAccum > 2.3) {
          this.stepAccum = 0;
          soundEngine.playFootstep(running);
        }
      }
    }
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const horizSpeed = Math.hypot(this.pvx, this.pvz);
    void running;

    const zone = detectZoneAt(this.px, this.pz);
    if (zone !== this.lastZoneReported) {
      this.lastZoneReported = zone;
      st.setCurrentZone(zone);
    }

    const localPlayer = st.localPlayerId ? st.room?.players[st.localPlayerId] : null;

    // Auto-progress eating/drinking so snacks never get stuck forever
    if (localPlayer?.consuming) {
      const cKey = `${localPlayer.consuming.itemId}_${localPlayer.consuming.startedAt}`;
      if (cKey !== this.lastConsumeKey) {
        this.lastConsumeKey = cKey;
        this.consumeStepAccum = 0;
      }
      if (Date.now() - localPlayer.consuming.startedAt > MAX_CONSUME_DURATION_MS) {
        socketClient.stopConsuming();
        this.consumeStepAccum = 0;
      } else {
        this.consumeStepAccum += dt * 1000;
        if (this.consumeStepAccum >= AUTO_BITE_INTERVAL_MS) {
          this.consumeStepAccum = 0;
          if (localPlayer.consuming.visualType === 'bottle' || localPlayer.consuming.visualType === 'cup') {
            soundEngine.playDrinkSip();
          } else {
            soundEngine.playEatBite();
          }
          const matchingEntry = localPlayer.inventory.find((i) => i.itemId === localPlayer.consuming!.itemId);
          if (matchingEntry) {
            socketClient.consumeFoodBite(matchingEntry.instanceId);
          } else {
            socketClient.stopConsuming();
          }
        }
      }
    } else {
      this.lastConsumeKey = '';
      this.consumeStepAccum = 0;
    }

    if (!this.localRig && localPlayer) {
      this.localRig = createAvatarRig(localPlayer.avatar, localPlayer.name, localPlayer.isHost);
      this.scene.add(this.localRig.root);
    }

    if (this.localRig && localPlayer) {
      this.localRig.root.position.set(this.px, this.py, this.pz);
      this.localRig.root.rotation.y = this.pRotY;

      // Hide own head only in First-Person mode; hide floating nametag in FP or 3D Mela Booth so booth targets stay clear
      const isFP = st.cameraMode === 'first_person';
      this.localRig.headGroup.visible = !isFP;
      this.localRig.nameSprite.visible = !isFP && !this.melaGames.isActive();

      updateAvatarAppearanceAndState(this.localRig, {
        name: localPlayer.name,
        isHost: localPlayer.isHost,
        bubbleText: localPlayer.lastBubbleText,
        bubbleAt: localPlayer.lastBubbleAt,
        consuming: localPlayer.consuming,
        avatar: localPlayer.avatar,
      });

      animateAvatarRig(this.localRig, dt, elapsed, {
        speed: horizSpeed,
        isJumping: !this.grounded,
        dance: horizSpeed > 0.4 ? 'none' : localPlayer.dance,
        hasConsuming: Boolean(localPlayer.consuming),
        holdingBall: Boolean(localPlayer.heldBallId),
      });
    }

    socketClient.sendMove({
      x: this.px,
      y: this.py,
      z: this.pz,
      rotY: this.pRotY,
      speed: horizSpeed,
      isJumping: !this.grounded,
    });
  }

  private updateRemotePlayersAndProps(dt: number, elapsed: number): void {
    const st = useGameStore.getState();
    const room = st.room;
    if (!room) return;

    // Fireworks trigger check
    if (room.fireworksBurstAt && room.fireworksBurstAt !== this.lastFireworkSeen) {
      this.lastFireworkSeen = room.fireworksBurstAt;
      soundEngine.playFirework();
      const colors = [0xfacc15, 0xec4899, 0x38bdf8, 0x22c55e, 0xf97316];
      for (let i = 0; i < 4; i++) {
        this.spawnParticleBurst(30 + (i - 1.5) * 4, 11 + (i % 2) * 3, -34, 22, colors[i % colors.length]);
      }
    }

    // Remote Players
    const activeIds = new Set<string>();
    for (const player of Object.values(room.players)) {
      if (player.id === st.localPlayerId || !player.online) continue;
      activeIds.add(player.id);
      let entry = this.remoteRigs.get(player.id);
      if (!entry) {
        const rig = createAvatarRig(player.avatar, player.name, player.isHost);
        rig.root.position.set(player.x, player.y, player.z);
        this.scene.add(rig.root);
        entry = { rig, targetX: player.x, targetY: player.y, targetZ: player.z, targetRotY: player.rotY };
        this.remoteRigs.set(player.id, entry);
      }
      entry.targetX = player.x;
      entry.targetY = player.y;
      entry.targetZ = player.z;
      entry.targetRotY = player.rotY;

      const lerpAlpha = 1 - Math.exp(-12 * dt);
      entry.rig.root.position.x = THREE.MathUtils.lerp(entry.rig.root.position.x, entry.targetX, lerpAlpha);
      entry.rig.root.position.y = THREE.MathUtils.lerp(entry.rig.root.position.y, entry.targetY, lerpAlpha);
      entry.rig.root.position.z = THREE.MathUtils.lerp(entry.rig.root.position.z, entry.targetZ, lerpAlpha);
      entry.rig.root.rotation.y = THREE.MathUtils.lerp(entry.rig.root.rotation.y, entry.targetRotY, lerpAlpha);

      updateAvatarAppearanceAndState(entry.rig, {
        name: player.name,
        isHost: player.isHost,
        bubbleText: player.lastBubbleText,
        bubbleAt: player.lastBubbleAt,
        consuming: player.consuming,
        avatar: player.avatar,
      });

      animateAvatarRig(entry.rig, dt, elapsed, {
        speed: player.speed,
        isJumping: player.isJumping,
        dance: player.dance,
        hasConsuming: Boolean(player.consuming),
        holdingBall: Boolean(player.heldBallId),
      });
    }

    for (const [id, entry] of this.remoteRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.rig.root);
        disposeAvatarRig(entry.rig);
        this.remoteRigs.delete(id);
      }
    }

    // Treasure nodes visibility & bobbing
    for (const [tid, tg] of this.world.treasureMeshes.entries()) {
      const node = room.treasureHunt.active
        ? room.treasureHunt.nodes.find((n) => n.id === tid && !n.claimedBy)
        : undefined;
      if (node) {
        tg.visible = true;
        tg.position.set(node.x, Math.sin(elapsed * 3 + node.x) * 0.14, node.z);
        tg.rotation.y += dt * 1.4;
      } else {
        tg.visible = false;
      }
    }

    // Build live player transforms so held balls stay pinned to live hands (not stale spawn coords)
    const nowMs = Date.now();
    for (const key of Object.keys(this.livePlayersScratch)) {
      delete this.livePlayersScratch[key];
    }
    if (st.localPlayerId) {
      this.livePlayersScratch[st.localPlayerId] = {
        x: this.px,
        y: this.py,
        z: this.pz,
        rotY: this.pRotY,
      };
    }
    for (const [pid, player] of Object.entries(room.players)) {
      if (pid === st.localPlayerId) continue;
      const remoteEntry = this.remoteRigs.get(pid);
      this.livePlayersScratch[pid] = remoteEntry
        ? {
            x: remoteEntry.rig.root.position.x,
            y: remoteEntry.rig.root.position.y,
            z: remoteEntry.rig.root.position.z,
            rotY: remoteEntry.rig.root.rotation.y,
          }
        : { x: player.x, y: player.y, z: player.z, rotY: player.rotY };
    }

    if (room.balls !== this.lastBallsRef) {
      this.lastBallsRef = room.balls;
      const syncList = room.balls.filter((b) => {
        if (b.holderId) return false;
        const thrownAt = this.recentThrownBalls.get(b.id);
        if (thrownAt && nowMs - thrownAt < 450) return false;
        if (b.lastKickerId === st.localPlayerId && nowMs - this.lastLocalKickAt < 2500) return false;
        return true;
      });
      if (syncList.length > 0) {
        this.physics.applyNetworkSync(syncList);
      }
    }

    let ballsForStep = room.balls;
    if (this.recentThrownBalls.size > 0) {
      for (const [bid, ts] of this.recentThrownBalls.entries()) {
        if (nowMs - ts >= 450) this.recentThrownBalls.delete(bid);
      }
      if (this.recentThrownBalls.size > 0) {
        ballsForStep = room.balls.map((b) =>
          this.recentThrownBalls.has(b.id) ? { ...b, holderId: null } : b,
        );
      }
    }

    // Physics balls step
    const stepped = this.physics.step(dt, ballsForStep, this.livePlayersScratch);
    for (const [bid, bState] of stepped.entries()) {
      const mesh = this.world.ballMeshes.get(bid);
      if (mesh) {
        mesh.position.set(bState.x, bState.y, bState.z);
        mesh.rotation.x += bState.vz * dt * 1.4;
        mesh.rotation.z -= bState.vx * dt * 1.4;
      }
      // Goal & Hoop scoring detection (local kicker only, debounced 3s)
      const ballObj = room.balls.find((b) => b.id === bid);
      if (
        ballObj?.lastKickerId === st.localPlayerId &&
        Date.now() - this.lastGoalScoredAt > 3000
      ) {
        const inNorthGoal = Math.abs(bState.x - 36) < 3.0 && bState.z < -8.8 && bState.z > -10.5 && bState.y < 2.8;
        const inSouthGoal = Math.abs(bState.x - 36) < 3.0 && bState.z > 20.8 && bState.z < 22.5 && bState.y < 2.8;
        const inBasketballHoop =
          bid === 'ball_basketball_1' &&
          Math.hypot(bState.x - 53.45, bState.z + 8) < 0.7 &&
          Math.abs(bState.y - 3.15) < 0.55;

        if (inNorthGoal || inSouthGoal || inBasketballHoop) {
          this.lastGoalScoredAt = Date.now();
          soundEngine.playGoalCheer();
          this.spawnParticleBurst(bState.x, bState.y + 1, bState.z, 20, 0x22c55e);
          socketClient.recordGoal(inBasketballHoop ? 'basketball' : 'football').then((res) => {
            if (res.ok) {
              st.pushToast(
                `${inBasketballHoop ? 'Swish! Basket!' : 'GOOOAAAL!'} +${res.rewardCoins} coins`,
                'success',
              );
            }
          });
        }
      }
    }

    // Proximity Interact Prompt Detection
    let found: { kind: 'stall' | 'npc' | 'arcade' | 'mela_3d' | 'ferris' | 'ball' | 'treasure' | 'dj' | 'stage'; id: string; label: string; subtitle?: string } | null = null;
    let bestD = 4.2;

    if (this.ridingFerrisIndex >= 0) {
      found = {
        kind: 'ferris',
        id: 'ferris_exit',
        label: 'Hop Off Giant Ferris Wheel',
        subtitle: 'Press E or Space',
      };
    }

    if (room.treasureHunt.active && !found) {
      for (const n of room.treasureHunt.nodes) {
        if (n.claimedBy) continue;
        const d = Math.hypot(n.x - this.px, n.z - this.pz);
        if (d < 3.2 && d < bestD) {
          bestD = d;
          found = { kind: 'treasure', id: n.id, label: `Collect ${n.label}`, subtitle: `+${n.rewardCoins} Coins` };
        }
      }
    }

    if (!found) {
      const fDist = Math.hypot(this.world.ferrisBoardPos.x - this.px, this.world.ferrisBoardPos.z - this.pz);
      if (fDist < 3.6) {
        bestD = fDist;
        found = {
          kind: 'ferris',
          id: 'ferris',
          label: 'Ride Giant Ferris Wheel',
          subtitle: 'Sky-High View!',
        };
      }
    }

    for (const s of ALL_STALLS) {
      if (this.ridingFerrisIndex >= 0) break;
      const d = Math.hypot(s.x - this.px, s.z - this.pz);
      if (d < 4.8 && d < bestD + 0.6) {
        bestD = d;
        found = {
          kind: 'stall',
          id: s.id,
          label: s.id === 'patakha_bazaar' ? `Buy Fireworks at ${s.name}` : `Order at ${s.name}`,
          subtitle: s.vendorName,
        };
      }
    }

    for (const bp of this.melaGames.boothInteractPoints) {
      if (this.ridingFerrisIndex >= 0 || this.melaGames.isActive()) break;
      const d = Math.hypot(bp.booth.standX - this.px, bp.booth.standZ - this.pz);
      if (d < 3.6 && d < bestD) {
        bestD = d;
        found = {
          kind: 'mela_3d',
          id: bp.booth.id,
          label: `Play 3D ${bp.booth.name}`,
          subtitle: 'Live In-World Mela Game',
        };
      }
    }

    for (const ap of this.world.arcadePositions) {
      if (this.ridingFerrisIndex >= 0) break;
      const d = Math.hypot(ap.x - this.px, ap.z - this.pz);
      if (d < 3.5 && d < bestD) {
        bestD = d;
        found = { kind: 'arcade', id: 'arcade', label: 'Play 2D Arcade & Mela Games', subtitle: '25 Mini-Games' };
      }
    }

    for (const b of room.balls) {
      if (this.ridingFerrisIndex >= 0) break;
      const bm = this.world.ballMeshes.get(b.id);
      const bx = bm ? bm.position.x : b.x;
      const bz = bm ? bm.position.z : b.z;
      const d = Math.hypot(bx - this.px, bz - this.pz);
      if (d < 2.6 && d < bestD) {
        bestD = d;
        const holding = room.players[st.localPlayerId || '']?.heldBallId === b.id;
        found = {
          kind: 'ball',
          id: b.id,
          label: holding ? 'Throw / Pass Ball (E or F)' : `Pick Up ${b.kind} (E) · Kick (F)`,
        };
      }
    }

    for (const npc of this.npcManager.npcs) {
      if (this.ridingFerrisIndex >= 0 || npc.isVendor) continue;
      const d = Math.hypot(npc.group.position.x - this.px, npc.group.position.z - this.pz);
      if (d < 3.4 && d < bestD) {
        bestD = d;
        found = { kind: 'npc', id: npc.def.id, label: `Talk to ${npc.def.name}` };
      }
    }

    const djDist = Math.hypot(this.world.djBoothPos.x - this.px, this.world.djBoothPos.z - this.pz);
    if (djDist < 4.8 && !found && this.ridingFerrisIndex < 0) {
      found = { kind: 'dj', id: 'dj', label: 'Open Dance Menu', subtitle: 'DJ & Dance Arena' };
    }

    const stageDist = Math.hypot(
      this.world.celebrationStagePos.x - this.px,
      this.world.celebrationStagePos.z - this.pz,
    );
    if (stageDist < 5.5 && !found && this.ridingFerrisIndex < 0) {
      found = { kind: 'stage', id: 'stage', label: 'View Carnival Leaderboard', subtitle: 'Celebration Stage' };
    }

    const key = found ? `${found.kind}_${found.id}_${found.label}` : 'none';
    if (key !== this.lastPromptKey) {
      this.lastPromptKey = key;
      st.setNearbyPrompt(found);
    }
  }

  private updateCamera(dt: number, elapsed: number): void {
    const st = useGameStore.getState();

    // Title screen: Live World Camera Tour orbiting over illuminated Central Plaza & Ferris Wheel
    if (st.screen === 'title') {
      const a = elapsed * 0.14;
      this.camera.position.set(Math.sin(a) * 34, 14 + Math.sin(elapsed * 0.4) * 1.5, Math.cos(a) * 34 + 6);
      this.camera.lookAt(0, 3.2, -4);
      return;
    }

    const framing = this.melaGames.getCameraFraming();
    if (framing) {
      const melaDamp = 1 - Math.exp(-10 * dt);
      this.camPosCurrent.lerp(framing.pos, melaDamp);
      this.camLookCurrent.lerp(framing.look, melaDamp);
      this.camera.position.copy(this.camPosCurrent);
      this.camera.lookAt(this.camLookCurrent);
      return;
    }

    const mode = st.cameraMode;
    const damp = 1 - Math.exp(-16 * dt);

    if (mode === 'first_person') {
      _camAnchor.set(this.px, this.py + 1.52, this.pz);
      _camDesired.set(
        this.px + Math.sin(this.camYaw) * -3,
        this.py + 1.52 - Math.sin(this.camPitch) * 2.5,
        this.pz + Math.cos(this.camYaw) * -3,
      );
      this.camera.position.lerp(_camAnchor, 0.85);
      this.camera.lookAt(_camDesired);
      return;
    }

    // Rear Third-Person OR Front Selfie Third-Person
    const skyTilt = Math.max(0, -this.camPitch) * 5.2;
    _camAnchor.set(this.px, this.py + 1.45 + skyTilt, this.pz);
    const yaw = mode === 'third_front' ? this.pRotY : this.camYaw;

    const horizDist = Math.cos(this.camPitch) * this.camDist;
    const vertDist = Math.sin(this.camPitch) * this.camDist + 1.0;

    _camDesired.set(
      _camAnchor.x + Math.sin(yaw) * horizDist,
      Math.max(0.75, _camAnchor.y + vertDist - skyTilt * 0.7),
      _camAnchor.z + Math.cos(yaw) * horizDist,
    );

    // Camera wall pull-in raycast so camera never clips inside stalls or stages
    _camDir.subVectors(_camDesired, _camAnchor);
    const maxLen = _camDir.length();
    if (maxLen > 0.2) {
      _camDir.normalize();
      _raycaster.set(_camAnchor, _camDir);
      _raycaster.far = maxLen;
      const hits = _raycaster.intersectObjects(this.world.cameraOccluders, false);
      if (hits.length > 0 && hits[0].distance > 0.7) {
        _camDesired.copy(_camAnchor).addScaledVector(_camDir, hits[0].distance - 0.35);
      }
    }

    this.camPosCurrent.lerp(_camDesired, damp);
    this.camLookCurrent.lerp(_camAnchor, damp);
    this.camera.position.copy(this.camPosCurrent);
    if (this.cameraShakeTime > 0) {
      this.cameraShakeTime = Math.max(0, this.cameraShakeTime - dt);
      const amp = (this.cameraShakeTime / 0.35) * 0.24;
      this.camera.position.x += Math.sin(elapsed * 58) * amp;
      this.camera.position.y += Math.cos(elapsed * 71) * amp * 0.7;
    }
    this.camera.lookAt(this.camLookCurrent);
  }

  private dismountFerris(): void {
    this.ridingFerrisIndex = -1;
    this.px = this.world.ferrisBoardPos.x;
    this.py = 0;
    this.pz = this.world.ferrisBoardPos.z + 1.4;
    this.pvy = 0;
    this.grounded = true;
    useGameStore.getState().pushToast('Stepped off Giant Ferris Wheel!', 'info');
  }

  private launchSkyshotRocket(x: number, z: number, vx: number, vy: number, vz: number, maxAge: number, burstColor?: number): void {
    soundEngine.playSkyshotLaunch();
    const rocket = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 1.05, 8),
      new THREE.MeshBasicMaterial({ color: burstColor ?? 0xf97316 }),
    );
    rocket.position.set(x, 0.9, z);
    this.scene.add(rocket);
    this.activePyros.push({
      effect: 'skyshot',
      x,
      y: 0.9,
      z,
      vx,
      vy,
      vz,
      age: 0,
      maxAge,
      stepAccum: 0,
      subIndex: 0,
      burstColor,
      rocketMesh: rocket,
    });
  }

  private updatePyroEmitters(dt: number): void {
    const palette = [0xff9933, 0xffffff, 0x138808, 0xfacc15, 0xec4899, 0x38bdf8, 0xa855f7];
    const events = useGameStore.getState().drainFireworkEvents();
    for (const ev of events) {
      if (ev.effect === 'skyshot') {
        this.launchSkyshotRocket(ev.x, ev.z, 0, 19, 0, 1.05);
      } else if (ev.effect === 'skyshot_multi') {
        this.activePyros.push({
          effect: ev.effect,
          x: ev.x,
          y: 0.6,
          z: ev.z,
          age: 0,
          maxAge: 2.2,
          stepAccum: 0.36,
          subIndex: 0,
        });
      } else if (ev.effect === 'fountain') {
        soundEngine.playFountainSparkle();
        this.activePyros.push({
          effect: ev.effect,
          x: ev.x,
          y: 0.25,
          z: ev.z,
          age: 0,
          maxAge: 4.2,
          stepAccum: 0,
          subIndex: 0,
        });
      } else if (ev.effect === 'chakra') {
        soundEngine.playFountainSparkle();
        this.activePyros.push({
          effect: ev.effect,
          x: ev.x,
          y: 0.16,
          z: ev.z,
          age: 0,
          maxAge: 4.0,
          stepAccum: 0,
          subIndex: 0,
        });
      } else if (ev.effect === 'sutli') {
        soundEngine.playSutliBomb();
        const bombMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 0.38, 10),
          new THREE.MeshStandardMaterial({ color: '#16A34A', roughness: 0.75 }),
        );
        const cap = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.18, 8),
          new THREE.MeshBasicMaterial({ color: '#DC2626' }),
        );
        cap.position.y = 0.26;
        bombMesh.add(cap);
        bombMesh.position.set(ev.x, 0.19, ev.z);
        this.scene.add(bombMesh);
        this.activePyros.push({
          effect: 'sutli',
          x: ev.x,
          y: 0.19,
          z: ev.z,
          age: 0,
          maxAge: 1.65,
          stepAccum: 0,
          subIndex: 0,
          rocketMesh: bombMesh,
          detonated: false,
        });
      } else {
        soundEngine.playCrackerPop();
        this.activePyros.push({
          effect: 'crackers',
          x: ev.x,
          y: 0.2,
          z: ev.z,
          age: 0,
          maxAge: 3.2,
          stepAccum: 0.2,
          subIndex: 0,
        });
      }
    }

    for (let i = this.activePyros.length - 1; i >= 0; i--) {
      const py = this.activePyros[i];
      py.age += dt;
      py.stepAccum += dt;

      if (py.effect === 'skyshot' && py.rocketMesh) {
        py.x += (py.vx ?? 0) * dt;
        py.y += (py.vy ?? 19) * dt;
        py.z += (py.vz ?? 0) * dt;
        py.rocketMesh.position.set(py.x, py.y, py.z);
        if (py.stepAccum > 0.025) {
          py.stepAccum = 0;
          this.spawnParticleBurst(py.x, py.y - 0.45, py.z, 5, 0xfacc15);
        }
        if (py.age >= py.maxAge) {
          soundEngine.playFirework();
          if (py.burstColor !== undefined) {
            this.spawnParticleBurst(py.x, py.y, py.z, 36, py.burstColor);
            this.spawnParticleBurst(py.x, py.y + 0.4, py.z, 18, 0xfacc15);
          } else {
            this.spawnParticleBurst(py.x, py.y, py.z, 28, 0xff9933);
            this.spawnParticleBurst(py.x, py.y + 0.6, py.z, 24, 0xffffff);
            this.spawnParticleBurst(py.x, py.y - 0.5, py.z, 24, 0x22c55e);
          }
          this.scene.remove(py.rocketMesh);
          py.rocketMesh.geometry.dispose();
          (py.rocketMesh.material as THREE.Material).dispose();
          this.activePyros.splice(i, 1);
        }
      } else if (py.effect === 'skyshot_multi') {
        if (py.stepAccum >= 0.36 && py.subIndex < 5) {
          py.stepAccum = 0;
          const spreadX = (py.subIndex - 2) * 2.1;
          const spreadZ = ((py.subIndex % 2) - 0.5) * 2.2;
          const bCol = palette[(py.subIndex + 3) % palette.length];
          this.launchSkyshotRocket(
            py.x + (py.subIndex - 2) * 0.4,
            py.z,
            spreadX,
            21 + (py.subIndex % 3) * 2.4,
            spreadZ,
            1.0 + (py.subIndex % 2) * 0.18,
            bCol,
          );
          py.subIndex++;
        }
        if (py.age >= py.maxAge) this.activePyros.splice(i, 1);
      } else if (py.effect === 'sutli') {
        if (!py.detonated) {
          if (py.stepAccum >= 0.06) {
            py.stepAccum = 0;
            this.spawnParticleBurst(py.x, 0.45, py.z, 5, 0xf97316);
          }
          if (py.rocketMesh) {
            py.rocketMesh.rotation.z = Math.sin(py.age * 42) * 0.08;
          }
          if (py.age >= 0.9) {
            py.detonated = true;
            if (py.rocketMesh) {
              this.scene.remove(py.rocketMesh);
              py.rocketMesh.traverse((child) => {
                const m = child as THREE.Mesh;
                if (m.isMesh) {
                  m.geometry.dispose();
                  (m.material as THREE.Material).dispose();
                }
              });
              py.rocketMesh = undefined;
            }
            this.spawnParticleBurst(py.x, 0.65, py.z, 50, 0xfacc15);
            this.spawnParticleBurst(py.x, 0.9, py.z, 35, 0xf97316);
            this.spawnParticleBurst(py.x, 0.45, py.z, 25, 0xffffff);
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(0.35, 0.72, 24),
              new THREE.MeshBasicMaterial({
                color: 0xfef08a,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95,
              }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(py.x, 0.14, py.z);
            this.scene.add(ring);
            py.shockRing = ring;
            this.cameraShakeTime = 0.35;
          }
        } else if (py.shockRing) {
          const t = Math.min(1, (py.age - 0.9) / (py.maxAge - 0.9));
          py.shockRing.scale.setScalar(1 + t * 14);
          (py.shockRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - t));
        }
        if (py.age >= py.maxAge) {
          if (py.shockRing) {
            this.scene.remove(py.shockRing);
            py.shockRing.geometry.dispose();
            (py.shockRing.material as THREE.Material).dispose();
          }
          this.activePyros.splice(i, 1);
        }
      } else if (py.effect === 'fountain') {
        if (py.stepAccum >= 0.07) {
          py.stepAccum = 0;
          for (let k = 0; k < 4; k++) {
            const slot = this.particles[this.particleCursor];
            this.particleCursor = (this.particleCursor + 1) % this.particles.length;
            slot.active = true;
            slot.x = py.x + (Math.random() - 0.5) * 0.25;
            slot.y = 0.25;
            slot.z = py.z + (Math.random() - 0.5) * 0.25;
            slot.vx = (Math.random() - 0.5) * 2.6;
            slot.vy = 6.5 + Math.random() * 4.5;
            slot.vz = (Math.random() - 0.5) * 2.6;
            slot.life = 0;
            slot.maxLife = 0.75 + Math.random() * 0.35;
            slot.color = k % 2 === 0 ? 0xfacc15 : 0xf97316;
          }
          if (Math.random() < 0.3) soundEngine.playFountainSparkle();
        }
        if (py.age >= py.maxAge) this.activePyros.splice(i, 1);
      } else if (py.effect === 'chakra') {
        if (py.stepAccum >= 0.05) {
          py.stepAccum = 0;
          const ang = py.age * 16;
          for (let arm = 0; arm < 2; arm++) {
            const a = ang + arm * Math.PI;
            const slot = this.particles[this.particleCursor];
            this.particleCursor = (this.particleCursor + 1) % this.particles.length;
            slot.active = true;
            slot.x = py.x + Math.cos(a) * 0.35;
            slot.y = 0.18;
            slot.z = py.z + Math.sin(a) * 0.35;
            slot.vx = Math.cos(a) * 6.5;
            slot.vy = 0.9 + Math.random() * 0.8;
            slot.vz = Math.sin(a) * 6.5;
            slot.life = 0;
            slot.maxLife = 0.55;
            slot.color = arm === 0 ? 0x06b6d4 : 0xfacc15;
          }
          if (Math.random() < 0.25) soundEngine.playFountainSparkle();
        }
        if (py.age >= py.maxAge) this.activePyros.splice(i, 1);
      } else if (py.effect === 'crackers') {
        if (py.stepAccum >= 0.18) {
          py.stepAccum = 0;
          const ox = py.x + (Math.random() - 0.5) * 2.4;
          const oz = py.z + (Math.random() - 0.5) * 2.4;
          soundEngine.playCrackerPop();
          this.spawnParticleBurst(ox, 0.45, oz, 16, palette[Math.floor(Math.random() * palette.length)]);
        }
        if (py.age >= py.maxAge) this.activePyros.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummyMatrix.makeTranslation(0, -50, 0);
        this.particleMesh.setMatrixAt(i, _dummyMatrix);
        continue;
      }
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const scale = Math.max(0.1, 1 - p.life / p.maxLife);
      _dummyMatrix.makeTranslation(p.x, p.y, p.z);
      _dummyMatrix.scale(_camDir.set(scale, scale, scale));
      this.particleMesh.setMatrixAt(i, _dummyMatrix);
      this.particleMesh.setColorAt(i, _dummyColor.setHex(p.color));
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    let polls = 0;
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      polls++;
      const status = sync ? gl.clientWaitSync(sync, 0, 0) : gl.ALREADY_SIGNALED;
      if (status === gl.TIMEOUT_EXPIRED && polls < 25) {
        this.frameId = window.setTimeout(poll, 20);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 100);
      }
    };
    this.frameId = window.setTimeout(poll, 20);
  }

  private updateLightingForTimeOfDay(tod: TimeOfDay, dt: number): void {
    if (tod !== this.currentTod) {
      this.currentTod = tod;
      this.todBlend = 0;
    }
    if (this.todBlend >= 1) return;
    this.todBlend = this.isSoftwareGl ? 1 : Math.min(1, this.todBlend + dt * 2.4);
    const alpha = this.isSoftwareGl ? 1 : Math.min(1, dt * 6.0);

    const cfg =
      tod === 'night'
        ? {
            bg: '#060A1B',
            fogDensity: 0.0055,
            hemiSky: '#2563EB',
            hemiGround: '#0F172A',
            hemiInt: 0.28,
            sunCol: '#60A5FA',
            sunInt: 0.18,
            envInt: 0.36,
            exposure: 1.12,
          }
        : tod === 'sunset'
          ? {
              bg: '#FB923C',
              fogDensity: 0.0048,
              hemiSky: '#FDBA74',
              hemiGround: '#581C87',
              hemiInt: 0.72,
              sunCol: '#F97316',
              sunInt: 1.15,
              envInt: 0.65,
              exposure: 1.05,
            }
          : {
              bg: '#BFE2FF',
              fogDensity: 0.0042,
              hemiSky: '#93C5FD',
              hemiGround: '#785C3E',
              hemiInt: 0.95,
              sunCol: '#FFE4B5',
              sunInt: 1.65,
              envInt: 1.0,
              exposure: 1.1,
            };

    _todBgColor.set(cfg.bg);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(_todBgColor, alpha);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.lerp(_todBgColor, alpha);
      this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, cfg.fogDensity, alpha);
    }
    _todHemiSky.set(cfg.hemiSky);
    _todHemiGround.set(cfg.hemiGround);
    _todSunColor.set(cfg.sunCol);
    this.hemiLight.color.lerp(_todHemiSky, alpha);
    this.hemiLight.groundColor.lerp(_todHemiGround, alpha);
    this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, cfg.hemiInt, alpha);
    this.sunLight.color.lerp(_todSunColor, alpha);
    this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, cfg.sunInt, alpha);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(this.scene.environmentIntensity, cfg.envInt, alpha);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
      this.renderer.toneMappingExposure,
      cfg.exposure,
      alpha,
    );
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const rawDt = this.clock.getDelta();
      if (document.hidden) {
        if (!this.isSoftwareGl) {
          this.frameId = requestAnimationFrame(tick);
        } else {
          this.frameId = window.setTimeout(tick, 180);
        }
        return;
      }

      const dt = Math.min(rawDt, 0.05);
      const elapsed = this.clock.elapsedTime;
      const st = useGameStore.getState();

      if (st.lowGraphics !== this.lastLowGraphics) {
        this.lastLowGraphics = st.lowGraphics;
        if (!this.isSoftwareGl) {
          this.renderer.setPixelRatio(st.lowGraphics ? 1 : Math.min(window.devicePixelRatio, 1.5));
          this.renderer.shadowMap.enabled = !st.lowGraphics;
        }
      }

      if (st.screen === 'playing') {
        this.updateLocalPlayer(dt, elapsed);
        this.updateRemotePlayersAndProps(dt, elapsed);
        this.world.updateZoneCulling(this.px, this.pz, st.lowGraphics);
        this.melaGames.rootGroup.visible =
          this.melaGames.isActive() || Math.hypot(this.px + 15.5, this.pz + 24.2) < (st.lowGraphics ? 46 : 64);
      } else if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }

      const tod = st.room?.timeOfDay ?? 'day';
      this.updateLightingForTimeOfDay(tod, dt);
      this.npcManager.update(dt, elapsed, this.px, this.pz);
      this.world.updateDynamicWorld(
        elapsed,
        dt,
        Boolean(st.room?.dj.isPlaying),
        st.room?.dj.lightingMode || 'festive',
        tod,
      );
      this.updatePyroEmitters(dt);
      this.melaGames.update(dt, elapsed);
      this.updateParticles(dt);
      this.updateCamera(dt, elapsed);

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 40);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearInputs);
    document.removeEventListener('visibilitychange', this.clearInputs);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    for (const py of this.activePyros) {
      if (py.rocketMesh) {
        this.scene.remove(py.rocketMesh);
        py.rocketMesh.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
      }
      if (py.shockRing) {
        this.scene.remove(py.shockRing);
        py.shockRing.geometry.dispose();
        (py.shockRing.material as THREE.Material).dispose();
      }
    }
    this.activePyros = [];
    if (this.localRig) disposeAvatarRig(this.localRig);
    for (const entry of this.remoteRigs.values()) disposeAvatarRig(entry.rig);
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.envRT?.dispose();
    this.melaGames.dispose();
    this.world.disposeWorld();
    this.physics.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
