# CARNIVAL — The Virtual Children's Day: Architecture, Deployment & Host Guide

## 1. Zero-Budget (₹0) Stack & Unavoidable Production Hosting Notes
- **Development & Testing Cost**: **₹0**
  - Frontend: React 19, TypeScript, Vite, Three.js, `@dimforge/rapier3d-compat` (WASM), Zustand, Tailwind CSS.
  - Backend: Node.js, Express, Socket.IO, atomic local JSON persistence (`data/carnival-rooms.json`) for zero-setup dev/testing, plus a production-ready PostgreSQL `prisma/schema.prisma`.
  - Assets & Audio: **100% original procedural 3D meshes**, **procedural HTML5 Canvas textures**, **Web Audio API sound effects & DJ beat synth**, and **official YouTube IFrame Player API** (zero paid models, zero copyright risk).
- **Production Free-Tier & Potential Costs**:
  - Small parties (7–20 kids) fit well inside free tiers on **Render / Railway / Fly.io** (Node + WebSockets) and **Neon / Supabase** (PostgreSQL free tier).
  - **Unavoidable production costs** arise only if scaling beyond free-tier quotas: custom `.com/.in` domain registration (~₹700–₹1,200/yr), always-on Node instances without cold-sleep (~₹400–₹700/mo), or >500 MB database storage / high bandwidth egress.

## 2. Installation & Local Development Commands
```bash
# Install dependencies
npm install

# Run full-stack development server (Express + Socket.IO + Vite on port 3000)
npm run dev

# Run automated unit & multiplayer server tests
npm test

# TypeScript check
npm run lint

# Build frontend for production
npm run build

# Start production server
npm start
```

## 3. PostgreSQL / Prisma Setup (Optional Production Database)
1. Provision a free PostgreSQL database (Neon, Supabase, or local Postgres).
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Push the schema in `prisma/schema.prisma`:
   ```bash
   npx prisma db push
   ```
Local development runs immediately out-of-the-box without requiring a PostgreSQL daemon via `server/persistence.ts`.

## 4. Testing Guide
- **Automated Tests (`npm test`)**:
  - `src/shared/rules.test.ts`: Validates all 15 food stalls, purchase balance guards, bite-by-bite consumption, chat PII/profanity filtering, YouTube URL extraction, arcade score clamping, and leaderboard fairness (food spending never boosts competition points).
  - `server/roomManager.test.ts`: Tests multi-player room joining, server-side wallet enforcement, forged `hostSecret` rejection, duplicate treasure claim prevention, chat muting, and PvP Tic Tac Toe.
- **Multi-Browser Manual Check**:
  1. Open `http://localhost:3000`, create a room as Host, and copy the `?room=CODE` invite link.
  2. Open a second browser/incognito tab with that invite link and join as a guest.
  3. Walk around together, send chat messages (verify speech bubbles), buy & eat food at Food Street, kick footballs, dance (`V` / `1-4`), and test Host Controls.

## 5. Host Administrator Instructions
- Only the player who creates a room receives the cryptographic `hostSecret` (verified server-side on every `host:*` Socket.IO event).
- Click **Host** in the top-right HUD to open the **Host Event Control Center**:
  - **Room & Teleport**: Lock/unlock room entry, disable guest chat, gather/teleport all friends to any of the 7 zones.
  - **Players & Safety**: View live zone/wallet/bag status, mute or kick disruptive guests, and resolve player safety reports.
  - **DJ & YouTube**: Play/pause/skip built-in festival synth tracks, adjust stage volume, paste a valid YouTube video URL/ID for synced IFrame playback, and switch party lighting (`festive`, `disco`, `golden`, `neon_party`).
  - **Coins & Log**: Grant or adjust virtual coins and inspect room transactions.
  - **Games & Ceremony**: Start/stop the 7-chest Treasure Hunt, launch Group Dance, change ceremony phase, and fire Grand Stage Fireworks!

## 6. Asset Attribution & Licensing
- All 3D architecture, characters, outfits, food items, sports equipment, and environments are original procedural Three.js geometries (`THREE.Group` compositions).
- All surface textures, stall signboards, sports markings, and name/speech tags are generated dynamically via HTML5 2D Canvas (`src/engine/textures.ts`).
- All UI icons use `lucide-react` (ISC License) and custom inline `<svg>` artwork.
- Sound effects and festival beats are synthesized live via the browser Web Audio API (`src/audio/soundEngine.ts`).
- YouTube playback uses the official YouTube IFrame Player API in compliance with YouTube Terms of Service (no downloading or ad-bypassing).
