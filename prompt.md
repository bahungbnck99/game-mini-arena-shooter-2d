You are a senior game engineer and AI coding agent.

Build the following confirmed game immediately. Do not ask for another confirmation unless a requirement is technically impossible in the current environment.

GOAL
Create a complete, runnable 2D Top-down Multiplayer Arena Shooter game with server-side Bot AI, real-time networking (LAN bind 0.0.0.0 & Localtunnel public internet exposing), room lobby system with customizable max human player limits, Web Audio API sound synthesis, a large map, HUD Mini-map overlay, customizable bot counts, match timer options, responsive UI layout with vertical overflow scrolls, and automatic Windows Firewall UAC automation.

GAME BUILD CONTRACT
- Game title: Arena Shooter 2D Multiplayer
- Genre: 2D Top-down Realtime Multiplayer Shooter
- Runtime/platform: Node.js server (using Express, ws, and localtunnel libraries) and HTML5 Canvas client (using pure JS & CSS).
- Output files:
  - package.json
  - server.js
  - server/Physics.js
  - server/RoomManager.js
  - server/GameRoom.js
  - server/BotAI.js
  - public/index.html
  - public/css/style.css
  - public/js/audio.js
  - public/js/game.js
  - .gitignore
  - README.md
- Run method: npm install && node server.js. Serve on port 3000. Open browser at http://localhost:3000.
- Visual style: Dark cyber/neon theme. Players, bots, obstacles, and bullets drawn procedurally using 2D canvas shapes/colors/glows. No external image assets.
- Asset policy: Completely zero external file assets. All visuals drawn via canvas API.
- Audio policy: Procedural sound synthesis using Web Audio API (sounds for shooting, hit impact, death, and countdown).
- Player objective: Eliminate opponents (players and bots) to reach the highest score in the match.
- Core loop: Choose name/skin/gun/perk -> Create/join room code -> Play in large arena -> HP reaches 0 causes death particle explosion, scoring for attacker -> Respawn after 3 seconds.
- Controls:
  - WASD: Move player circle
  - Mouse rotation: Aim weapon angle
  - Left Click: Shoot bullets
  - R key: Reload ammunition
  - Space key: Dash (boost speed forward briefly, 3s cooldown)
- Win condition: Reaching highest score within the arena.
- Loss/failure condition: HP reaches 0 (triggers death and 3s respawn).
- Score/progression: +1 score for each kill. Display leaderboard dynamically.
- Required screens/states:
  - Main Menu (Lobby list, create/join input, Name, Weapon select, Perk select, Skin color, Accessory type, Bot count N, Match duration select, Max Players select)
  - Match Lobby (Player list, Host start button, leave button - only for pvp/team modes)
  - In-game Canvas (HUD displaying HP/Shield bars, Ammo, Dash cooldown, Leaderboard, Killfeed, Timer, Death overlay, and Mini-map)
  - GameOver Overlay (Display result Victory/Defeat text, team scores or player rank, MVP cards for each team, detailed Blue vs Red scoreboards with K/D ratios, and "Back to Menu" button)

TECHNICAL IMPLEMENTATION REQUIREMENTS

1. LAN Binding, Windows Firewall UAC & Localtunnel Exposing:
   - Server must listen on PORT 3000 bound to IP '0.0.0.0' to accept external network requests (server.listen(PORT, '0.0.0.0')).
   - On Server Startup:
     * Run shell command to open port 3000 in Windows Firewall. If regular netsh command fails, run an elevated PowerShell script that triggers a Windows UAC elevation popup to prompt the user to approve:
       `powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -WindowStyle Hidden -Command \"New-NetFirewallRule -DisplayName \\\"2D Arena Shooter Port 3000\\\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Force\"' -Verb RunAs"`
     * Call `localtunnel({ port: 3000 })` to expose the server to the public internet. Catch errors gracefully if the localtunnel server is offline or network fails. Print the public URL clearly in the console.
   - On Server Shutdown/Exit:
     * Close the localtunnel instance.
     * Run an elevated PowerShell script using the same RunAs method to remove the firewall rule:
       `powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -WindowStyle Hidden -Command \"Remove-NetFirewallRule -DisplayName \\\"2D Arena Shooter Port 3000\\\"\"' -Verb RunAs"`
     * Ensure process exits (process.exit(0)) after clean up.

2. Responsive UI/UX Design & Scrollable Wrappers:
   - Wrap Main Menu and Match Lobby panels in `.menu-wrapper` and `.lobby-wrapper` classes with `margin: auto; max-width: 95%;` styles.
   - Set `.screen` and menu screens to `position: fixed; width: 100vw; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; padding: 40px 0 100px 0;`. This ensures if viewport height is too small, menu content will scroll vertically with an bottom padding buffer instead of being cropped off.
   - Set `.audio-mute-btn` position to `left: 30px` to avoid text clipping on the left edge.
   - In css/style.css, use `@media` query rules to support screens under 900px and 768px:
     * Shift `.menu-container` and Match Lobby layout from two columns to a single-column layout (`grid-template-columns: 1fr;`).
     * When screens are small, the GameOver overlay elements (`#goMvpContainer` and `#goTeamsScoreboard`) must switch to vertical columns (`flex-direction: column; width: 100%;`).
     * Adjust in-game HUD placements (Hp/shield bar, ammo, scoreboard, timer, killfeed) to shrink text sizes and fit narrow touchscreens. Hide ingame-instructions on mobile.

3. Limit Room Max Human Players:
   - Add a Max Players dropdown (`maxPlayersSelect`) on the Main Menu under room config panel offering 2, 4, 6, or 8 players. Show only when gameMode is NOT 'vs_bot'.
   - Send maxPlayers inside the config object of the 'create_room' packet.
   - Server reads maxPlayers config in GameRoom constructor (`this.maxPlayers = parseInt(config.maxPlayers) || 8`).
   - On client 'join_room' request, check if room is full: `if (room.players.size >= room.maxPlayers) { send join_error }`. Client displays alert on 'join_error' packets.

4. Customizable Bot Counts:
   - Provide an input field for Bot count (N) on Main Menu (min=1, max=10, default=4). Show only when gameMode is 'vs_bot' or 'coop'.
   - Send botCount inside the config object of the 'create_room' packet.
   - Server handles Bot Spawning inside GameRoom.js based on Game Mode:
     * 'vs_bot' (Solo): Spawns N bots on Red team (opponents).
     * 'coop' (Co-op): Spawns N bots on Red team (opponents), and N - 1 bots on Blue team (allies).
     * Other modes ('pvp', 'team') balance or spawn standard bots.

5. Match Timer & Game Over:
   - Provide a Match duration dropdown on the Main Menu: 60s, 120s (default), 180s, 300s. Send matchDuration in create_room config.
   - Server tracks matchTimer inside GameRoom.js, decrementing it using deltaTime.
   - Send matchTimer inside the game_state packet. Client renders this as MM:SS at the top center of the HUD.
   - When matchTimer <= 0, server changes state to 'gameover', calculates Blue team vs Red team kills (or ranks players for FFA), broadcasts a 'game_over' packet containing winnerTeam, blueScore, redScore, and the sorted scoreboard of all players & bots, and stops the room game loop.

6. Game Over Overlay with MVP and Split Team Stats:
   - Client displays a full-screen blurred Overlay when receiving 'game_over', showing VICTORY / DEFEAT / DRAW.
   - For team modes ('team', 'coop', 'vs_bot'):
     * Calculate MVP for Blue and Red teams dynamically on client-side (highest score/kills, tiebroken by lowest deaths).
     * Display MVP cards at the top of the overlay (e.g., "👑 MVP Phe Xanh: Player_Name (K/D Info)").
     * Render a two-column scoreboard representing Phe Xanh (Blue) and Phe Đỏ (Red) side-by-side.
     * List all entities on their respective team columns sorted by score. Each row must show Name (with a (BOT) label if it is a bot, a (BẠN) label for the local player, and a 👑 icon if they are the team MVP), and stats formatted as "X K / Y D (K/D: Z)".
   - For free-for-all modes: Render a single sorted scoreboard (top 5) with a crown 👑 on the champion.

7. Room Auto-Start Control:
   - When creating a room with Bot modes ('vs_bot' or 'coop'), the server must automatically trigger room.startGame() immediately, bypassing the lobby screen, sending the host straight into the gameplay canvas.
   - For multiplayer modes ('pvp', 'team'), enter the Lobby screen to wait for other human players.

8. WebSocket Connection Setup & LAN Welcome:
   - On WebSocket connection open, server must immediately send a 'welcome' packet containing the client's unique connection ID (wsId).
   - Client stores this ID as its myId to identify its own entity (resolving identity collision issues on LAN).

9. Exit Match & Host Controls:
   - Add an in-game "Exit Match" button (🚪) on the Canvas screen overlay.
   - Clicking "Exit Match" sends a 'leave_room' event to the server.
   - If the player leaving is the Host, the server must dissolve the room completely, notify all other clients via a 'room_closed' packet (forcing them to return to the Main Menu with an alert), destroy the game loop, and delete the room from the manager.
   - If it is a normal player, only remove that player.

10. Large Map & Obstacles:
   - Arena map dimensions: 2400 x 1800 pixels.
   - 18 static block obstacles (walls) placed in the map to block movement and bullets. Center block: 1150, 850, 100, 100. Perimeter walls placed strategically to allow tactical movement.
   - Server handles bullet creation, bullet collision testing, health depletion, and respawning.

11. Mini-map Overlay:
   - Render a HUD Mini-map overlay at the top-left corner (160 x 120 pixels).
   - Draw mini obstacles as translucent grey blocks.
   - Draw player dots based on positions relative to the 2400x1800 map size:
     * Self: Pulsing yellow dot (#ffea00).
     * Teammates (players/bots in team/coop mode): Blue dot (#00f0ff).
     * Enemies (opponents/players in PvP FFA): Red dot (#ff3366).

12. Weapons Config:
   - Pistol: fireRate 400ms, reload 1.0s, ammo 12, damage 20, speed 600, range 600.
   - SMG: fireRate 100ms, reload 1.5s, ammo 30, damage 10, speed 750, range 500.
   - Rifle: fireRate 200ms, reload 1.4s, ammo 25, damage 15, speed 850, range 700.
   - Shotgun: fireRate 800ms, reload 2.0s, ammo 5, damage 12, speed 600, range 300, count 5 (spreads 5 bullets).
   - Sniper: fireRate 1500ms, reload 2.5s, ammo 5, damage 75, speed 1400, range 1000.

13. Perks Config:
   - Speed boost: +20% base speed.
   - Extra health: +50 max HP.
   - Faster reload: -50% reload duration.
   - Bullet damage boost: +15% damage.
   - Shield: Gives 30 Shield points. Shield absorbs damage first. Regens +10 points/sec after 5 seconds of not taking damage.

14. Customize visual styles:
   - Skins: Default (Cyan), Scout (Green), Heavy (Orange), Tactical (Grey), Neon (Pink).
   - Accessories: Helmet (extra arc in front), Backpack (rectangle behind), Visor (colored lens bar in front), Shoulder pad (side circles).

15. Bot AI (Server-side update loop):
   - Bots target the nearest alive opponent.
   - Easy Bot: slow movement, inaccurate aim, slow shooting rate.
   - Medium Bot: follows target, walks sideways to dodge incoming bullets if close.
   - Hard Bot: keeps distance based on gun range, predicts target movement, uses Dash to dodge when bullets are heading towards it.

16. Web Audio API Synthesis:
   - Generate synth soundscapes for: Shoot, hit impact, death explosion, game start. Muted by default, toggleable.

17. Client Drawing Loop (requestAnimationFrame):
   - Clear canvas, shift camera context using translation relative to player position.
   - Draw boundary grids, obstacles, bullets, particles, and alive entities (players/bots).
   - Draw labels: Name, HP/Shield bars, and reload progress on top of each entity.
   - Render HUD overlays: HP/Shield bars (bottom-left), Weapon/Ammo (bottom-right), Room details/Ping (top-left), Scoreboard (top-right), Killfeed (top-center, shifted down to top: 85px to avoid timer), Timer (top-center, top: 25px).

VERIFICATION CHECKLIST
- Windows firewall rules are configured on node process launch and deleted on shutdown using UAC prompts if regular shell fails.
- Localtunnel starts on startup and outputs public internet address.
- Client connect correctly to Secure Websockets (wss) over localtunnel public link.
- Main menu dynamically shows Bot count input N and Max Players dropdown options.
- Bot rooms start immediately on creation. PvP rooms enter lobby.
- vs_bot mode spawns N Red enemies and hides Max Players select. coop mode spawns N Red enemies, N-1 Blue allies, and displays Max Players.
- Mini-map displays own position (yellow pulsing dot), allies (blue dot), and enemies (red dot).
- Normal players exiting does not crash match. Host exiting closes room immediately.
- Match countdown decrements smoothly, stops game, calculates winners.
- Game Over screen displays: Winner outcome text, Team MVPs with crown 👑 icons, side-by-side blue vs red scoreboards showing Kills, Deaths and K/D ratios.
- CSS layout automatically transitions to single columns on small screen width, and supports vertical scroll without clipping any menu headers or action buttons.

FINAL RESPONSE FORMAT
Return:
1. Files created/changed
2. How to run
3. Controls
4. Gameplay summary
5. Verification performed
6. Suggested next upgrades