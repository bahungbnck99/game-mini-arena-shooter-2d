# System Prompt: Rebuild the 2D Arena Shooter Multiplayer Game from Scratch

**Instructions for the AI Agent:**
You are Antigravity, a world-class Game Developer and UX/UI Designer. Your goal is to write a complete, production-ready, and highly polished multiplayer 2D top-down arena shooter game with server-side Bot AI, real-time WebSocket synchronization, Web Audio API sound synthesis, and an advanced responsive cyberpunk-themed frontend.

Provide the complete code for each file requested. Do not use placeholders or skip implementation details.

---

## 1. Project Directory Structure

Create and implement the following files exactly:
```
├── server.js
├── server/
│   ├── RoomManager.js
│   ├── GameRoom.js
│   ├── Physics.js
│   └── BotAI.js
└── public/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── game.js
        └── audio.js
```

---

## 2. Technical Specification & Implementation Guide

### File 1: `server.js`
- Initialize an Express application and HTTP server listening on `process.env.PORT || 3000`.
- Serve static files from the `public` directory.
- Create a `ws` WebSocket Server bound to the HTTP server.
- Manage connections by assigning a unique ID to each socket (`wsId = crypto.randomBytes(8).toString('hex')`).
- Send a `{ type: 'welcome', id: wsId }` packet to client immediately on connection.
- Track active clients in a `clients` Map and keep references globally.
- Clean up empty rooms every 30 seconds via `roomManager.cleanupRooms()`.
- Listen for inbound WebSocket messages, parse them safely, and route to `RoomManager` handlers:
  - `get_lobby_list`: send back active lobby rooms list.
  - `create_room`: create a new room with configuration (`gameMode`, `botDifficulty`, `botCount`, `matchDuration`, `maxPlayers`) and add the host.
  - `join_room`: validate room existence, state ('lobby'), and player count limits before joining.
  - `change_team`: switch host/player team between `'blue'` and `'red'`.
  - `start_game`: start the match if requested by the room host.
  - `input`: pass inputs to room physics update loop.
  - `leave_room`/`close`: remove player from current room and delete the room if empty or if host leaves.
- Automate Windows Firewall opening on start: run `netsh advfirewall firewall add rule name="2D Arena Shooter Port 3000" dir=in action=allow protocol=TCP localport=3000`. On SIGINT/SIGTERM, remove it.
- Spawn a Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) and print the public URL to console.

### File 2: `server/RoomManager.js`
- Maintain a `rooms` Map (`code -> GameRoom`).
- Generate unique 4-character uppercase random alphanumeric codes (e.g. `4SS5`) ensuring no duplicates.
- Implement helper methods: `createRoom(hostId, config)`, `getRoom(code)`, `deleteRoom(code)`, and `cleanupRooms()` (deletes playing/empty rooms without active real players).

### File 3: `server/Physics.js`
- Provide accurate mathematical collision checking:
  - `checkCircleRectCollision(cx, cy, radius, rx, ry, rw, rh)`: Return true if a circle collides with an axis-aligned bounding box (AABB) obstacle.
  - `resolveCircleRectCollision(circle, rect)`: Push the circle out of the rectangle bounds along the axis of minimum penetration.
  - `checkCircleCircleCollision(c1x, c1y, c1r, c2x, c2y, c2r)`: Return true if two circles intersect.

### File 4: `server/BotAI.js`
- Create a server-side intelligence script for bots.
- In each room update frame, update each bot's action:
  - If dead, do nothing.
  - Search the players list for the closest enemy player/bot belonging to the opposite team (or any player in FFA mode).
  - If a target is found, calculate the angle towards them: `bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x)`.
  - Rotate and move towards the target. Check distance: if within weapon range and line-of-sight is not blocked by static obstacles, set `bot.input.shooting = true`.
  - Automatically pathfind around obstacles: if moving forward collides with an obstacle, temporarily steer orthogonal to the collision normal to slide around it.
  - Automatically reload when ammo clip is empty.

### File 5: `server/GameRoom.js`
- Manage match states: `'lobby'`, `'playing'`, `'gameover'`.
- Define weapons stats on server:
  - `pistol`: fireRate 0.4s, reload 1.0s, maxAmmo 12, damage 20, bulletSpeed 600, range 600.
  - `smg`: fireRate 0.1s, reload 1.5s, maxAmmo 30, damage 10, bulletSpeed 750, range 500.
  - `rifle`: fireRate 0.2s, reload 1.4s, maxAmmo 25, damage 15, bulletSpeed 850, range 700.
  - `shotgun`: fireRate 0.8s, reload 2.0s, maxAmmo 5, damage 12, bulletSpeed 600, range 300, counts 5 bullets per shot with 0.35rad spread.
  - `sniper`: fireRate 1.5s, reload 2.5s, maxAmmo 5, damage 75, bulletSpeed 1400, range 1000.
- Manage players, bullets, and bots arrays.
- Arena Map size is 2400x1800. Set up multiple large static block obstacles (`obstacles = [{ x, y, w, h }, ...]`).
- On `startGame()`, spawn bots based on configuration. For `'vs_bot'`, spawn N bots on the red team. For `'coop'`, fill player team to N with friendly bots and spawn N enemy bots. For `'pvp'`, spawn 3 FFA bots. For `'team'`, spawn bots to balance teams to 4 vs 4.
- Implement `respawnEntity(entity)`: Find a safe spawn position using random coordinates while checking circle-rect collisions against all obstacles. Reset HP, Shield, and Ammo.
- Physics Update Loop: Run at ~30 FPS (`setInterval` of 33ms).
  - Apply players movement input. If dashing, multiply speed by 2.75 for the dash duration.
  - Check map boundaries and resolve collisions against static obstacles.
  - Move bullets: `bullet.x += bullet.vx * dt`, check collision against obstacles (destroy bullet on hit) and players/bots.
  - Apply bullet damage: reduce HP (deduct from Shield first if active). On death, trigger respawn timer (3 seconds), increment killer score, increment victim deaths, and broadcast `{ type: 'death_event', victimName, killerName, x, y, team }`.
  - Update shoot cooldowns and reload timers.
- Compile and broadcast game state every frame:
  ```javascript
  {
      type: 'game_state',
      state: this.state,
      gameMode: this.gameMode,
      matchTimer: Math.ceil(this.matchTimer),
      players: [...], // id, name, x, y, angle, hp, maxHp, shield, score, deaths, ammo, maxAmmo, gunType, perk, skin, accessory, team, isReloading, reloadProgress
      bots: [...],    // same properties as players
      bullets: [...]  // id, x, y, vx, vy, angle, ownerTeam (CRITICAL: vx and vy must be sent to allow client extrapolation!)
  }
  ```

### File 6: `public/index.html`
- Build a responsive layout with a cyberpunk neon dark system.
- Include Google Fonts 'Orbitron' and 'Inter'.
- Structure:
  - **Screen 1: `#mainMenuScreen`**:
    - Header: Neon title "ARENA SHOOTER 2D" with glowing pulse effects.
    - Top-Right controls container (absolute positioned) containing fullscreen toggle, mute toggle, and exit game buttons.
    - Left Column (`.cyber-panel`): Player name input, Loadout Tabs (Súng, Perks, Trang phục, Phụ kiện), item cards with `data-type` and `data-value` attributes.
      - Bottom: **Community & Support panel** containing Zalo chat group link, phone support text, and two clickable QR thumbnail images (`zalo_qr.png` and `bank_qr.jpg`) triggering `openQrModal()`.
    - Right Column: Rooms list container (`#roomListContainer`), Quick Room Code join input, and Create Room panel (Game Mode select, Bot difficulty, Bot count slider, Match timer, Max players).
  - **Screen 2: `#roomLobbyScreen` (hidden by default)**:
    - Sảnh Chờ Lobby header containing room code display.
    - Players lists for Blue and Red teams.
    - Team Select Area (Phe Xanh / Phe Đỏ buttons) visible only during Team Battle mode.
    - Action Buttons: Ready, Leave, Start Game (Host only).
  - **Screen 3: `#gameScreen` (hidden by default)**:
    - A full-screen `<canvas id="gameCanvas">`.
    - HUD elements: HP & Shield bar overlays, Weapon stats, Ammo current/max, Dash cooldown ring.
    - Latency display (ms), leaderboard table (Top 5 scorers), Killfeed feed.
    - Death overlay with respawn timer countdown.
    - Match Timer overlay at the top center.
    - Game Over Overlay (`#hudGameOverOverlay`): Display MVP details, total kills/deaths, team scores, K/D analysis list, and back to menu button.
    - **Touch controls overlay (`#touchControlsOverlay`)**: Render virtual joysticks for mobile:
      - Left side: Movement joystick container and knob.
      - Right side: Dash (⚡) and Reload (R) action buttons placed higher up, plus Aiming/Shooting joystick container and knob.
  - **QR Lightbox Modal**: A hidden fixed overlay (`#qrModal`) displaying the enlarged QR image, title, and close button.

### File 7: `public/css/style.css`
- Apply dark futuristic styling: background `#08090f`, primary colors `--cyber-cyan: #00f0ff`, `--cyber-pink: #ff007f`, `--cyber-green: #39ff14`, `--cyber-yellow: #ffea00`.
- Create a grid pattern background using CSS linear-gradients.
- Cards styling: border `1px solid rgba(0, 240, 255, 0.1)`, glow effects using `box-shadow` on hover.
- Configure responsive virtual touch controllers for mobile devices:
  - `.joystick-container` positioned at the bottom left (`bottom: 100px`, `left: 80px`, size `180px` for movement) and bottom right (`bottom: 100px`, `right: 80px`, size `180px` for aiming).
  - Position touch action buttons (`#touchDashBtn`, `#touchReloadBtn`) higher up, above the aiming joystick, similar to popular MOBA games (e.g. Arena of Valor / Liên Quân Mobile).
- Configure responsive layout using CSS flexbox/grid. Hide panels gracefully on small mobile screens to keep layout clean.

### File 8: `public/js/audio.js`
- Create a synthesized sound system using Web Audio API inside `window.audioSystem`.
- Implement synthetic methods:
  - `playShoot(type)`: Synthesize gunshot sound based on gun type (e.g. short oscillator burst with decay and noise filter for SMG, deep loud low-pass sound for Shotgun, long high-pitched click for Sniper).
  - `playHit()`: Short, high-frequency white noise pop.
  - `playDash()`: Sweep frequency filter oscillator (swoosh effect).
  - `playDeath()`: Descending sine wave explosion.
  - `playGameStart()`: Synthesized retro synth chime sequence.
  - `toggleMute()`: Toggle master gain node volume between 0 and 1.

### File 9: `public/js/game.js`
- Connect to Server via `new WebSocket(wsUrl)` automatically choosing `wss:` or `ws:` depending on page HTTPS.
- Handle state synchronization packets in `handleServerPacket(packet)`:
  - `welcome`: Store player `myId`.
  - `lobby_update`: Update Lobby screen HUD, populate player names with their skins/weapons, toggle team selector visibility, and handle Host-only start button.
  - `game_start`: Set `gameActive = true`, reset positions, play start sound, and trigger client draw loop.
  - `game_state`: Store latest packet data.
  - `game_over`: Set `gameActive = false` and show the game-over leaderboard screen.
- **Client-Side Interpolation & Extrapolation Loop (`drawLoop`)**:
  - Keep a `lerpedPositions` Map tracking position and angle for every player and bot.
  - In each `drawLoop` frame:
    - Calculate Delta Time `dt`.
    - **Self-Player Lerp**: Find own player state in packet. Lerp extremely fast: `factor = 1 - Math.exp(-25 * dt)` to keep controls instant but smooth.
    - **Other Entities Lerp**: Lerp other players and bots: `factor = 1 - Math.exp(-18 * dt)`.
    - Smooth the angle rotations using a dedicated `lerpAngle(current, target, factor)` function that handles the 180-degree wrap-around boundaries (`-Math.PI` to `Math.PI`).
    - **Bullet Extrapolation**: For each bullet, extrapolate its position smoothly: `bullet.x += bullet.vx * dt`, `bullet.y += bullet.vy * dt` (only if `vx` and `vy` are present).
    - Center camera translation on the own player's lerped position.
    - Draw the grid floor, borders, obstacles, bullets, and interpolated players/bots.
- **Rate-Limited Input Sync (`syncInput`)**:
  - In the event listeners for continuous actions (`mousemove` and touch joysticks `touchmove`), update `inputState` local variables (e.g., `inputState.mouseAngle`, movement states) but **DO NOT** call `syncInput()`.
  - In event listeners for trigger events (`keydown`, `keyup`, `mousedown`, `mouseup`, `touchstart` for dash/reload), call `syncInput()` **immediately** to ensure zero delay.
  - Within `drawLoop()`, call `syncInput()` periodically every **`30ms`** (using a timestamps check `now - lastInputSentTime >= 30`) to keep the server updated regularly without flooding the WebSocket connection.
- **Draw Canvas Entities**:
  - Render player circles with accessory indicators rotating according to `entity.angle`:
    - helmet: front arc border.
    - visor: yellow glowing visor line.
    - shoulder_pad: two orthogonal side shoulder pads.
    - backpack: rectangle on the back opposite to the aiming angle.
  - Render detailed guns with specific barrel lengths/clips.
- **Minimap Rendering (`drawMinimap`)**:
  - Position the mini-map at the bottom left.
  - Render static obstacle blocks and players/bots as glowing dots.
  - Use `lerpedPositions` for all dot rendering to keep them moving smoothly on the mini-map.
- **Fullscreen & Lightbox Modals**:
  - Implement fullscreen request listeners for browser compatibility.
  - Provide `openQrModal(src, title)` and `closeQrModal()` functions to control the QR enlarge modal display.

---

## 3. Reference Implementations of Critical Mathematical Algorithms

To guarantee absolute physics and rendering correctness without code errors, implement these exact code blocks in your files:

### In `server/Physics.js` (Accurate sliding physics)
```javascript
// Check circle vs rectangle collision
function checkCircleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const distanceX = cx - closestX;
    const distanceY = cy - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (radius * radius);
}

// Resolve collision by pushing circle out along the shortest overlapping vector
function resolveCircleRectCollision(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) {
        // If center is exactly inside, push along the closest border edge
        const dl = circle.x - rect.x;
        const dr = (rect.x + rect.w) - circle.x;
        const dt = circle.y - rect.y;
        const db = (rect.y + rect.h) - circle.y;
        const minOverlap = Math.min(dl, dr, dt, db);
        if (minOverlap === dl) circle.x -= circle.radius;
        else if (minOverlap === dr) circle.x += circle.radius;
        else if (minOverlap === dt) circle.y -= circle.radius;
        else circle.y += circle.radius;
        return;
    }
    
    const overlap = circle.radius - dist;
    if (overlap > 0) {
        circle.x += (dx / dist) * overlap;
        circle.y += (dy / dist) * overlap;
    }
}

module.exports = { checkCircleRectCollision, resolveCircleRectCollision };
```

### In `public/js/game.js` (Seamless rotation interpolation)
```javascript
// Helper to interpolate angles smoothly avoiding the 180-degree wrap jump
function lerpAngle(current, target, factor) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * factor;
}
```

### In `public/js/audio.js` (Web Audio API Synthesizer)
```javascript
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }
    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    }
    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
    playShoot(type) {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'sniper') {
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'shotgun') {
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.22);
        } else {
            // Rifle / SMG / Pistol
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    }
    playHit() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(120, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
    }
    playDash() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.18);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
    }
    playDeath() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
    playGameStart() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const playTone = (freq, start, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
            osc.start(start);
            osc.stop(start + duration);
        };
        playTone(261.63, now, 0.2); // C4
        playTone(329.63, now + 0.15, 0.2); // E4
        playTone(392.00, now + 0.3, 0.2); // G4
        playTone(523.25, now + 0.45, 0.4); // C5
    }
}
window.audioSystem = new AudioSystem();
```