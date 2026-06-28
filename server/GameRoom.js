// server/GameRoom.js
const Physics = require('./Physics');
const BotAI = require('./BotAI');
const RankingsManager = require('./RankingsManager');

const WEAPONS = {
    pistol: { fireRate: 0.4, reloadTime: 1.0, maxAmmo: 12, damage: 20, bulletSpeed: 600, range: 600, count: 1, spread: 0 },
    smg:    { fireRate: 0.1, reloadTime: 1.5, maxAmmo: 30, damage: 10, bulletSpeed: 750, range: 500, count: 1, spread: 0.1 },
    rifle:  { fireRate: 0.2, reloadTime: 1.4, maxAmmo: 25, damage: 15, bulletSpeed: 850, range: 700, count: 1, spread: 0.04 },
    shotgun:{ fireRate: 0.8, reloadTime: 2.0, maxAmmo: 5,  damage: 12, bulletSpeed: 600, range: 300, count: 5, spread: 0.35 },
    sniper: { fireRate: 1.5, reloadTime: 2.5, maxAmmo: 5,  damage: 75, bulletSpeed: 1400, range: 1000, count: 1, spread: 0 }
};

class GameRoom {
    constructor(code, hostId, config = {}) {
        this.code = code;
        this.hostId = hostId;
        this.originalHostId = hostId; // Record room creator
        this.gameMode = config.gameMode || 'vs_bot'; // vs_bot, coop, pvp, team
        this.botDifficulty = config.botDifficulty || 'medium'; // easy, medium, hard
        this.botCount = config.botCount || 4; // custom bot count
        this.matchDuration = config.matchDuration !== undefined ? parseInt(config.matchDuration) : 120; // in seconds
        const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';
        const isRanked = this.gameMode === 'ranked';
        if (isSurvival || isRanked) {
            this.matchDuration = 0;
        }
        this.matchTimer = this.matchDuration === 0 ? 0 : this.matchDuration;
        this.countdownTimer = 5.0;
        this.maxPlayers = parseInt(config.maxPlayers) || 8;
        this.squadCount = parseInt(config.squadCount) || 4;
        this.survivalSafeZoneDuration = config.survivalSafeZoneDuration !== undefined ? parseInt(config.survivalSafeZoneDuration) : 180.0;
        this.survivalShrinkDuration = config.survivalShrinkDuration !== undefined ? parseInt(config.survivalShrinkDuration) : 30.0;
        this.state = 'lobby'; // lobby, playing, gameover
        this.mapWidth = isSurvival ? 20000 : (isRanked ? 8000 : 2400);
        this.mapHeight = isSurvival ? 20000 : (isRanked ? 8000 : 1800);

        this.players = new Map(); // wsId -> player object
        this.bots = [];           // array of bot objects
        this.bullets = [];        // array of bullet objects
        this.items = [];          // array of dropped buff items
        this.nextBulletId = 1;
        this.nextBotId = 1000;
        this.nextItemId = 1;

        // Vòng bo an toàn
        this.safeZone = {
            x: this.mapWidth / 2,
            y: this.mapHeight / 2,
            radius: Math.max(this.mapWidth, this.mapHeight) / 2,
            targetX: this.mapWidth / 2,
            targetY: this.mapHeight / 2,
            targetRadius: Math.max(this.mapWidth, this.mapHeight) / 2,
            timer: 180.0,       // 3 phút đếm ngược cho mỗi lần co bo
            stage: 0,
            shrinkingTimer: 0.0  // thời gian co bo (0 -> 30 giây)
        };

        this.crates = [];
        this.nextCrateId = 1;

        if (isSurvival || isRanked) {
            this.generateSurvivalObstaclesAndCrates();
        } else {
            this.initMapObstacles();
        }

        // Loop interval
        this.loopInterval = null;
        this.lastTime = Date.now();
    }

    /**
     * Set up standard map obstacles for a larger 2400x1800 arena.
     */
    initMapObstacles() {
        this.obstacles = [
            // Trung tâm bản đồ
            { x: 1150, y: 850, w: 100, h: 100 },
            
            // Khu vực trung tâm xung quanh
            { x: 900, y: 600, w: 200, h: 40 },
            { x: 1300, y: 600, w: 200, h: 40 },
            { x: 900, y: 1160, w: 200, h: 40 },
            { x: 1300, y: 1160, w: 200, h: 40 },
            
            { x: 750, y: 750, w: 40, h: 300 },
            { x: 1610, y: 750, w: 40, h: 300 },
            
            // Khu vực góc Tây Bắc (North-West)
            { x: 300, y: 300, w: 300, h: 40 },
            { x: 450, y: 340, w: 40, h: 200 },
            
            // Khu vực góc Đông Bắc (North-East)
            { x: 1800, y: 300, w: 300, h: 40 },
            { x: 1910, y: 340, w: 40, h: 200 },

            // Khu vực góc Tây Nam (South-West)
            { x: 300, y: 1460, w: 300, h: 40 },
            { x: 450, y: 1260, w: 40, h: 200 },

            // Khu vực góc Đông Nam (South-East)
            { x: 1800, y: 1460, w: 300, h: 40 },
            { x: 1910, y: 1260, w: 40, h: 200 },

            // Khối chắn ở các cạnh biên
            { x: 1180, y: 200, w: 40, h: 250 },
            { x: 1180, y: 1350, w: 40, h: 250 },
            { x: 200, y: 880, w: 250, h: 40 },
            { x: 1950, y: 880, w: 250, h: 40 }
        ];
    }

    /**
     * Helper to randomly generate obstacles and loot crates on a massive survival map.
     */
    generateSurvivalObstaclesAndCrates() {
        this.obstacles = [];
        this.crates = [];

        const isRanked = this.gameMode === 'ranked';
        const obstacleCount = isRanked ? 150 : 800;
        const crateCount = isRanked ? 80 : 300;
        const centerClearDist = isRanked ? 300 : 1000;

        // 1. Generate random obstacles
        for (let i = 0; i < obstacleCount; i++) {
            const w = Math.floor(Math.random() * 120) + 80;
            const h = Math.floor(Math.random() * 120) + 80;
            const x = Math.random() * (this.mapWidth - (isRanked ? 400 : 1000)) + (isRanked ? 200 : 500);
            const y = Math.random() * (this.mapHeight - (isRanked ? 400 : 1000)) + (isRanked ? 200 : 500);
            
            // Keep center clear for clean drop area
            const distToCenter = Math.hypot(x - this.mapWidth / 2, y - this.mapHeight / 2);
            if (distToCenter < centerClearDist) continue;

            this.obstacles.push({ x: Math.round(x), y: Math.round(y), w, h });
        }

        // 2. Generate random crates containing buffs
        for (let i = 0; i < crateCount; i++) {
            const x = Math.random() * (this.mapWidth - 400) + 200;
            const y = Math.random() * (this.mapHeight - 400) + 200;

            let overlap = false;
            for (const obs of this.obstacles) {
                if (x + 40 > obs.x && x < obs.x + obs.w && y + 40 > obs.y && y < obs.y + obs.h) {
                    overlap = true;
                    break;
                }
            }
            if (overlap) {
                continue; // Skip this index, random distribution is fine
            }

            this.crates.push({
                id: this.nextCrateId++,
                x: Math.round(x),
                y: Math.round(y),
                w: 40,
                h: 40,
                hp: 50,
                maxHp: 50
            });
        }
    }

    /**
     * Add a player to the room.
     */
    addPlayer(wsId, name, loadout) {
        if (this.players.size >= this.maxPlayers) return false;

        const team = this.assignTeamForNewPlayer();
        const player = {
            id: wsId,
            name: name || 'Player_' + wsId.substring(0, 4),
            x: Math.random() * (this.mapWidth - 100) + 50,
            y: Math.random() * (this.mapHeight - 100) + 50,
            radius: 20,
            angle: 0,
            team: team,
            skin: loadout.skin || 'default',
            accessory: loadout.accessory || 'none',
            gunType: loadout.gunType || 'rifle',
            perk: loadout.perk || 'none',
            maxHp: loadout.perk === 'extra_health' ? 150 : 100,
            hp: loadout.perk === 'extra_health' ? 150 : 100,
            maxShield: loadout.perk === 'shield' ? 30 : 0,
            shield: loadout.perk === 'shield' ? 30 : 0,
            shieldRegenTimer: 0,
            speed: loadout.perk === 'speed_boost' ? 240 : 200,
            ammo: WEAPONS[loadout.gunType || 'rifle'].maxAmmo,
            maxAmmo: WEAPONS[loadout.gunType || 'rifle'].maxAmmo,
            isReloading: false,
            reloadTimer: 0,
            shootCooldownTimer: 0,
            dashCooldownTimer: 0,
            dashDurationTimer: 0,
            dashAngle: 0,
            dashSpeed: 550,
            score: 0,
            deaths: 0,
            respawnTimer: 0,
            isBot: false,
            damageMultiplier: 1.0,
            speedMultiplier: 1.0,
            critChance: 0.1,         // 10% base crit chance
            lifesteal: 0.0,          // 0% base lifesteal
            armorPenetration: 0.0,   // 0% base armor penetration
            damageReduction: 0.0,    // 0% base damage reduction
            buffs: { damage: 0, speed: 0, crit: 0, vamp: 0, pierce: 0, defense: 0 },
            healingPacks: 0,
            invincibleTimer: 0,
            inLobby: true,
            // input state
            input: { w: false, a: false, s: false, d: false, space: false, r: false, shooting: false, mouseAngle: 0, useHeal: false }
        };

        this.players.set(wsId, player);
        this.broadcastLobbyUpdate();
        return true;
    }

    /**
     * Remove player from room.
     */
    removePlayer(wsId) {
        const player = this.players.get(wsId);
        if (player) {
            this.players.delete(wsId);
            console.log(`Player ${player.name} left room ${this.code}`);
            
            // If host left, dissolve the room completely
            if (this.hostId === wsId) {
                console.log(`Host left. Dissolving room ${this.code}`);
                this.broadcast({
                    type: 'room_closed',
                    message: 'Chủ phòng đã rời đi. Phòng chơi đã bị giải tán!'
                });
                this.players.clear();
                this.destroy();
            } else {
                if (this.state === 'playing') {
                    // Notify other players that a player left
                    this.broadcast({
                        type: 'death_event',
                        victimName: player.name,
                        killerName: 'Hệ thống',
                        x: player.x,
                        y: player.y,
                        team: player.team
                    });
                } else {
                    this.broadcastLobbyUpdate();
                }
            }
        }
    }

    /**
     * Handle loadout updates in lobby.
     */
    updatePlayerLoadout(wsId, loadout) {
        const player = this.players.get(wsId);
        if (player && this.state === 'lobby') {
            player.skin = loadout.skin || 'default';
            player.accessory = loadout.accessory || 'none';
            player.gunType = loadout.gunType || 'rifle';
            player.perk = loadout.perk || 'none';
            player.maxHp = loadout.perk === 'extra_health' ? 150 : 100;
            player.hp = player.maxHp;
            player.maxShield = loadout.perk === 'shield' ? 30 : 0;
            player.shield = player.maxShield;
            player.speed = loadout.perk === 'speed_boost' ? 240 : 200;
            player.ammo = WEAPONS[player.gunType].maxAmmo;
            player.maxAmmo = WEAPONS[player.gunType].maxAmmo;

            this.broadcastLobbyUpdate();
        }
    }

    /**
     * Change player team in lobby (only for team mode).
     */
    changePlayerTeam(wsId, team) {
        if (this.state !== 'lobby') return;
        const player = this.players.get(wsId);
        if (!player) return;

        if (this.gameMode === 'team' && (team === 'blue' || team === 'red')) {
            player.team = team;
            console.log(`Player ${player.name} changed team to ${team}`);
            this.broadcastLobbyUpdate();
        } else if (this.gameMode === 'survival_team') {
            const squadNum = parseInt(team.split('_')[1]);
            if (squadNum >= 1 && squadNum <= this.squadCount) {
                // Check if squad is full (max 5 players)
                let count = 0;
                this.players.forEach(p => { if (p.team === team) count++; });
                if (count >= 5) return;

                player.team = team;
                console.log(`Player ${player.name} changed squad to ${team}`);
                this.broadcastLobbyUpdate();
            }
        }
    }

    /**
     * Assign team based on game mode.
     */
    assignTeamForNewPlayer() {
        if (this.gameMode === 'survival_team') {
            const squads = [];
            let squadCounts = {};
            for (let i = 1; i <= this.squadCount; i++) {
                const sq = `squad_${i}`;
                squads.push(sq);
                squadCounts[sq] = 0;
            }
            
            this.players.forEach(p => {
                if (squadCounts[p.team] !== undefined) {
                    squadCounts[p.team]++;
                }
            });

            let bestSquad = 'squad_1';
            let minPlayers = 999;
            for (const sq of squads) {
                if (squadCounts[sq] < minPlayers && squadCounts[sq] < 5) {
                    minPlayers = squadCounts[sq];
                    bestSquad = sq;
                }
            }
            return bestSquad;
        } else if (this.gameMode === 'team') {
            // Balance red vs blue
            let redCount = 0;
            let blueCount = 0;
            this.players.forEach(p => {
                if (p.team === 'red') redCount++;
                else if (p.team === 'blue') blueCount++;
            });
            return redCount < blueCount ? 'red' : 'blue';
        } else if (this.gameMode === 'coop') {
            return 'blue'; // Co-op: all players on blue team vs bots on red team
        } else if (this.gameMode === 'vs_bot') {
            return 'blue'; // Solo vs Bots: player on blue, bots on red
        }
        return 'none'; // PvP Free For All / Survival Solo
    }

    /**
     * Broadcast lobby info to all players.
     */
    broadcastLobbyUpdate() {
        const playersList = Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            team: p.team,
            skin: p.skin,
            accessory: p.accessory,
            gunType: p.gunType,
            perk: p.perk,
            isHost: p.id === this.hostId
        }));

        this.broadcast({
            type: 'lobby_update',
            code: this.code,
            hostId: this.hostId,
            state: this.state,
            gameMode: this.gameMode,
            botDifficulty: this.botDifficulty,
            squadCount: this.squadCount,
            players: playersList
        });
    }

    /**
     * Handle single player returning to the lobby and migrating host if appropriate.
     */
    playerReturnToLobby(wsId) {
        const player = this.players.get(wsId);
        if (!player) return;

        player.inLobby = true;

        // If the game room hasn't transitioned back to lobby state yet
        if (this.state === 'playing' || this.state === 'countdown' || this.state === 'gameover') {
            if (this.loopInterval) {
                clearInterval(this.loopInterval);
                this.loopInterval = null;
            }

            this.state = 'lobby';
            this.bullets = [];
            this.bots = [];
            this.items = [];

            // If the original creator is the one returning, keep/give them host. Otherwise, assign temporary host.
            if (wsId === this.originalHostId) {
                this.hostId = this.originalHostId;
            } else {
                this.hostId = wsId;
            }

            this.players.forEach(p => {
                p.score = 0;
                p.deaths = 0;
                p.hp = p.maxHp;
                p.shield = p.maxShield;
                p.ammo = p.maxAmmo;
                p.isReloading = false;
                p.respawnTimer = 0;
                p.shootCooldownTimer = 0;
                p.dashDurationTimer = 0;
                p.damageMultiplier = 1.0;
                p.speedMultiplier = 1.0;
                p.critChance = 0.1;
                p.lifesteal = 0.0;
                p.armorPenetration = 0.0;
                p.damageReduction = 0.0;
                p.buffs = { damage: 0, speed: 0, crit: 0, vamp: 0, pierce: 0, defense: 0 };
                p.invincibleTimer = 0;
                if (p.id !== wsId) {
                    p.inLobby = false; // reset other players who haven't clicked yet
                }
            });

            console.log(`Room ${this.code} returned to lobby. Host: ${player.name} (${wsId})`);
        } else if (this.state === 'lobby') {
            // If the original host joins later, reclaim host privileges automatically!
            if (wsId === this.originalHostId) {
                this.hostId = this.originalHostId;
                console.log(`Original Host returned to lobby. Reclaiming host for: ${player.name} (${wsId})`);
            } else {
                // If temporary host or current host is not in lobby, migrate
                const currentHost = this.players.get(this.hostId);
                if (!currentHost || !currentHost.inLobby) {
                    this.hostId = wsId;
                    console.log(`Host AFK. Migrating host of room ${this.code} to: ${player.name} (${wsId})`);
                }
            }
        }

        this.broadcastLobbyUpdate();
    }

    /**
     * Send packet to all players in this room.
     */
    broadcast(packet) {
        const data = JSON.stringify(packet);
        this.players.forEach((p, wsId) => {
            const clientWs = global.clients?.get(wsId);
            if (clientWs && clientWs.readyState === 1) { // OPEN
                clientWs.send(data);
            }
        });
    }

    /**
     * Start the game match.
     */
    startGame(isAutoSpectate = false) {
        if (this.state !== 'lobby') return;
        this.isAutoSpectate = isAutoSpectate || false;

        this.state = 'countdown';
        this.countdownTimer = 5.0;
        this.bullets = [];
        this.bots = [];
        this.items = [];

        // Regenerate map obstacles and crates for a clean 100% new game
        const isSurvivalMode = this.gameMode === 'survival' || this.gameMode === 'survival_team';
        const isRankedMode = this.gameMode === 'ranked';
        if (isSurvivalMode || isRankedMode) {
            this.generateSurvivalObstaclesAndCrates();
        } else {
            this.initMapObstacles();
            this.crates = [];
        }

        // Reset Safe Zone for the new match (if Survival mode)
        const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';
        
        let initialRadius = Math.max(this.mapWidth, this.mapHeight) / 2;
        let targetRadius = initialRadius;
        let targetX = this.mapWidth / 2;
        let targetY = this.mapHeight / 2;

        if (isSurvival) {
            targetRadius = initialRadius * 0.60; // Shrink to 60% for first circle target
            const maxOffset = initialRadius - targetRadius;
            if (maxOffset > 0) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * maxOffset;
                targetX = (this.mapWidth / 2) + Math.cos(angle) * dist;
                targetY = (this.mapHeight / 2) + Math.sin(angle) * dist;
            }
        }

        this.safeZone = {
            x: this.mapWidth / 2,
            y: this.mapHeight / 2,
            radius: initialRadius,
            targetX: Math.round(targetX),
            targetY: Math.round(targetY),
            targetRadius: Math.round(targetRadius),
            timer: this.survivalSafeZoneDuration,
            stage: 0,
            shrinkingTimer: 0.0
        };

        // Reset all player stats & buffs to default
        this.players.forEach(player => {
            this.resetPlayerStatsForMatch(player);
            // If in auto-spectate mode, host doesn't play directly (placed as spectator: dead)
            if (this.isAutoSpectate && player.id === this.hostId) {
                player.hp = 0;
                player.deaths = 1;
            }
        });

        // Spawn Bots based on game mode
        this.spawnBotsForMatch();

        // If auto spectate, create a high-performance bot clone representing the Host Player
        if (this.isAutoSpectate) {
            const hostPlayer = this.players.get(this.hostId);
            if (hostPlayer) {
                // Find safe spawn coords
                let rx = Math.random() * (this.mapWidth - 100) + 50;
                let ry = Math.random() * (this.mapHeight - 100) + 50;
                let found = false;
                let attempts = 0;
                while (!found && attempts < 100) {
                    attempts++;
                    rx = Math.random() * (this.mapWidth - 100) + 50;
                    ry = Math.random() * (this.mapHeight - 100) + 50;
                    let collides = false;
                    for (let obs of this.obstacles) {
                        if (Physics.checkCircleRectCollision(rx, ry, 40, obs.x, obs.y, obs.w, obs.h)) {
                            collides = true;
                            break;
                        }
                    }
                    if (!collides) found = true;
                }

                // Determine Difficulty - one level higher than room botDifficulty setting
                let hostBotDiff = this.botDifficulty;
                if (this.botDifficulty === 'easy') hostBotDiff = 'medium';
                else if (this.botDifficulty === 'medium') hostBotDiff = 'hard';
                else if (this.botDifficulty === 'hard') hostBotDiff = 'expert';
                else if (this.botDifficulty === 'expert') hostBotDiff = 'nightmare';
                else if (this.botDifficulty === 'nightmare') hostBotDiff = 'nightmare';

                const maxHp = hostPlayer.perk === 'health_boost' ? 130 : 100;
                const maxShield = hostPlayer.perk === 'shield' ? 30 : 0;
                
                const isExpert = hostBotDiff === 'expert';
                const isNightmare = hostBotDiff === 'nightmare';
                const statMultiplier = isNightmare ? 1.3 : (isExpert ? 1.2 : 1.0);
                const finalMaxHp = Math.round(maxHp * statMultiplier);
                const finalMaxShield = Math.round(maxShield * statMultiplier);

                const hostBotClone = {
                    id: 'host_bot_clone_' + hostPlayer.id,
                    name: hostPlayer.name, // Matches Host name
                    x: Math.round(rx),
                    y: Math.round(ry),
                    angle: 0,
                    radius: 20,
                    team: hostPlayer.team,
                    skin: hostPlayer.skin,
                    accessory: hostPlayer.accessory,
                    gunType: hostPlayer.gunType,
                    perk: hostPlayer.perk,
                    maxHp: finalMaxHp,
                    hp: finalMaxHp,
                    maxShield: finalMaxShield,
                    shield: finalMaxShield,
                    shieldRegenTimer: 0,
                    speed: hostPlayer.perk === 'speed_boost' ? 240 : 200,
                    ammo: WEAPONS[hostPlayer.gunType].maxAmmo,
                    maxAmmo: WEAPONS[hostPlayer.gunType].maxAmmo,
                    weaponStats: WEAPONS[hostPlayer.gunType],
                    isReloading: false,
                    reloadTimer: 0,
                    shootCooldownTimer: 0,
                    dashCooldownTimer: 0,
                    dashDurationTimer: 0,
                    dashAngle: 0,
                    dashSpeed: 550,
                    difficulty: hostBotDiff,
                    score: 0,
                    deaths: 0,
                    respawnTimer: 0,
                    isBot: true,
                    isHostBot: true, // Marked as host bot clone
                    survivalRank: 1,
                    damageMultiplier: isNightmare ? 1.3 : (isExpert ? 1.2 : 1.0),
                    speedMultiplier: isNightmare ? 1.15 : (isExpert ? 1.1 : 1.0),
                    critChance: isNightmare ? 0.25 : (isExpert ? 0.2 : 0.1),
                    lifesteal: 0.0,
                    armorPenetration: 0.0,
                    damageReduction: isNightmare ? 0.20 : (isExpert ? 0.15 : 0.0),
                    buffs: { damage: 0, speed: 0, crit: 0, vamp: 0, pierce: 0, defense: 0 },
                    healingPacks: 0,
                    invincibleTimer: 3.0
                };
                
                this.bots.push(hostBotClone);
            }
        }

        // Reposition players and bots to spawn locations
        if (this.gameMode === 'survival_team') {
            const squadCenters = {};
            const squads = [];
            for (let i = 1; i <= this.squadCount; i++) {
                squads.push(`squad_${i}`);
            }
            squads.forEach(sq => {
                squadCenters[sq] = {
                    x: Math.random() * (this.mapWidth - 4000) + 2000,
                    y: Math.random() * (this.mapHeight - 4000) + 2000
                };
            });

            const positionSquadEntity = (entity) => {
                const center = squadCenters[entity.team];
                if (!center) {
                    this.respawnEntity(entity);
                    return;
                }
                let found = false;
                for (let attempt = 0; attempt < 50; attempt++) {
                    const rx = center.x + (Math.random() * 400 - 200);
                    const ry = center.y + (Math.random() * 400 - 200);
                    let colliding = false;
                    for (let obs of this.obstacles) {
                        if (Physics.checkCircleRectCollision(rx, ry, entity.radius, obs.x, obs.y, obs.w, obs.h)) {
                            colliding = true;
                            break;
                        }
                    }
                    if (!colliding) {
                        entity.x = rx;
                        entity.y = ry;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    this.respawnEntity(entity);
                }
            };

            this.players.forEach(player => {
                positionSquadEntity(player);
            });

            this.bots.forEach(bot => {
                positionSquadEntity(bot);
            });
        } else {
            this.players.forEach(player => {
                this.respawnEntity(player);
            });
        }

        // Final spectator override to make sure host player is dead and placed off-map
        if (this.isAutoSpectate) {
            const hostPlayer = this.players.get(this.hostId);
            if (hostPlayer) {
                hostPlayer.hp = 0;
                hostPlayer.deaths = 1;
                hostPlayer.x = -9999;
                hostPlayer.y = -9999;
            }
        }

        this.broadcast({
            type: 'game_start',
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
            obstacles: this.obstacles,
            gameMode: this.gameMode,
            botDifficulty: this.botDifficulty
        });

        // Start server update loop at ~30 FPS (33ms)
        this.matchTimer = this.matchDuration;
        this.lastTime = Date.now();
        this.loopInterval = setInterval(() => this.update(), 33);
        console.log(`Match started in room ${this.code}`);
    }

    /**
     * Spawn bots based on selected game mode and difficulty.
     */
    /**
     * Spawn a single bot into the match with optional difficulty override.
     */
    spawnSingleBot(team, index, difficultyOverride) {
        const gunTypes = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'];
        const perks = ['none', 'speed_boost', 'extra_health', 'faster_reload', 'bullet_damage_boost', 'shield'];
        const skins = ['default', 'scout', 'heavy', 'tactical', 'neon'];
        const accessories = ['helmet', 'backpack', 'visor', 'shoulder_pad', 'none'];

        const id = this.nextBotId++;
        const gun = gunTypes[Math.floor(Math.random() * gunTypes.length)];
        const perk = perks[Math.floor(Math.random() * perks.length)];
        const skin = skins[Math.floor(Math.random() * skins.length)];
        const accessory = accessories[Math.floor(Math.random() * accessories.length)];
        const isRanked = this.gameMode === 'ranked';
        const player = isRanked ? Array.from(this.players.values())[0] : null;
        const playerScore = player ? (player.score || 0) : 0;
        const upgradeCount = isRanked ? Math.floor(playerScore / 10) : 0;
        const statMultiplier = 1 + upgradeCount * 0.02; // +2% per upgrade

        const maxHp = perk === 'extra_health' ? 150 : 100;
        const maxShield = perk === 'shield' ? 30 : 0;
        
        const diff = difficultyOverride || this.botDifficulty;

        // In Ranked, HP and Shield are not scaled by difficulty
        const hpScale = isRanked ? 1.0 : (diff === 'nightmare' ? 1.3 : diff === 'expert' ? 1.2 : 1.0);
        const finalHp = Math.round(maxHp * hpScale);
        const finalShield = Math.round(maxShield * hpScale);

        // Customize weapon stats for stat scaling
        let weaponStats = JSON.parse(JSON.stringify(WEAPONS[gun]));
        if (isRanked) {
            weaponStats.bulletSpeed = Math.round(weaponStats.bulletSpeed * statMultiplier);
            weaponStats.cooldown = Math.max(50, Math.round(weaponStats.cooldown / statMultiplier));
        }

        const rawSpeed = perk === 'speed_boost' ? 240 : 200;
        const diffSpeedMult = diff === 'nightmare' ? 1.12 : diff === 'expert' ? 1.08 : 1.0;
        const finalSpeed = Math.round(rawSpeed * diffSpeedMult * (isRanked ? statMultiplier : 1.0));

        const bot = {
            id: id,
            name: `Bot_${team !== 'none' ? team.toUpperCase() + '_' : ''}${index + 1}`,
            x: 0,
            y: 0,
            radius: 20,
            angle: 0,
            team: team,
            skin: skin,
            accessory: accessory,
            gunType: gun,
            perk: perk,
            maxHp: finalHp,
            hp: finalHp,
            maxShield: finalShield,
            shield: finalShield,
            shieldRegenTimer: 0,
            speed: finalSpeed,
            ammo: weaponStats.maxAmmo,
            maxAmmo: weaponStats.maxAmmo,
            weaponStats: weaponStats,
            isReloading: false,
            reloadTimer: 0,
            shootCooldownTimer: 0,
            dashCooldownTimer: 0,
            dashDurationTimer: 0,
            dashAngle: 0,
            dashSpeed: 550,
            difficulty: diff,
            score: 0,
            deaths: 0,
            respawnTimer: 0,
            isBot: true,
            damageMultiplier: (diff === 'nightmare' ? 1.25 : diff === 'expert' ? 1.15 : 1.0) * (isRanked ? statMultiplier : 1.0),
            speedMultiplier: diffSpeedMult * (isRanked ? statMultiplier : 1.0),
            critChance: diff === 'nightmare' ? 0.22 : diff === 'expert' ? 0.15 : 0.1,
            lifesteal: 0.0,
            armorPenetration: 0.0,
            damageReduction: diff === 'nightmare' ? 0.18 : diff === 'expert' ? 0.10 : 0.0,
            buffs: { damage: 0, speed: 0, crit: 0, vamp: 0, pierce: 0, defense: 0 },
            healingPacks: 0,
            invincibleTimer: 0,
            survivalRank: 1
        };

        this.respawnEntity(bot);
        this.bots.push(bot);
        return bot;
    }

    /**
     * Spawn bots based on selected game mode and difficulty.
     */
    spawnBotsForMatch() {
        if (this.gameMode === 'ranked') {
            // Spawn exactly 10 bots, starting at 'easy' difficulty
            for (let i = 0; i < 10; i++) {
                this.spawnSingleBot('red', i, 'easy');
            }
        } else if (this.gameMode === 'survival') {
            // Fill up to maxPlayers with bots
            const realPlayersCount = this.players.size;
            const botsToSpawn = Math.max(0, this.maxPlayers - realPlayersCount);
            for (let i = 0; i < botsToSpawn; i++) {
                this.spawnSingleBot('none', i);
            }
        } else if (this.gameMode === 'survival_team') {
            const squads = [];
            for (let i = 1; i <= this.squadCount; i++) {
                squads.push(`squad_${i}`);
            }
            squads.forEach(sq => {
                let realCount = 0;
                this.players.forEach(p => { if (p.team === sq) realCount++; });
                const botsToSpawn = Math.max(0, 5 - realCount);
                for (let i = 0; i < botsToSpawn; i++) {
                    this.spawnSingleBot(sq, i);
                }
            });
        } else {
            // Standard Modes
            let blueBots = 0;
            let redBots = 0;

            const activePlayersSize = this.isAutoSpectate ? 0 : this.players.size;

            if (this.gameMode === 'vs_bot') {
                redBots = this.botCount;
                blueBots = this.isAutoSpectate ? 1 : 0; // Spawn 1 blue bot to represent player in auto-spectate
            } else if (this.gameMode === 'coop') {
                redBots = this.botCount;
                blueBots = Math.max(0, this.botCount - activePlayersSize);
            } else if (this.gameMode === 'pvp') {
                redBots = 3;
            } else if (this.gameMode === 'team') {
                let realBlue = 0;
                let realRed = 0;
                this.players.forEach(p => {
                    if (this.isAutoSpectate && p.id === this.hostId) return; // Spectating host doesn't count
                    if (p.team === 'blue') realBlue++;
                    else realRed++;
                });
                blueBots = Math.max(0, 4 - realBlue);
                redBots = Math.max(0, 4 - realRed);
            }

            for (let i = 0; i < redBots; i++) this.spawnSingleBot(this.gameMode === 'pvp' ? 'none' : 'red', i);
            for (let i = 0; i < blueBots; i++) this.spawnSingleBot('blue', i);
        }
    }

    /**
     * Respawn player or bot at a safe location.
     */
    respawnEntity(entity) {
        // Find a location not colliding with obstacles
        let found = false;
        let rx, ry;
        let attempts = 0;

        const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';
        let baseMinDist = isSurvival ? 1500 : 300;

        while (!found && attempts < 100) {
            attempts++;
            rx = Math.random() * (this.mapWidth - 100) + 50;
            ry = Math.random() * (this.mapHeight - 100) + 50;

            // Check obstacle collision
            let collides = false;
            for (let obs of this.obstacles) {
                if (Physics.checkCircleRectCollision(rx, ry, (entity.radius || 20) + 20, obs.x, obs.y, obs.w, obs.h)) {
                    collides = true;
                    break;
                }
            }

            // Gradually decrease minimum distance threshold if we can't find a spot
            const currentMinDist = baseMinDist * (1.0 - (attempts / 100));

            // Check distance to other active players/bots
            let tooClose = false;
            for (let p of this.players.values()) {
                if (p.id !== entity.id && p.hp > 0) {
                    if (Math.hypot(rx - p.x, ry - p.y) < currentMinDist) {
                        tooClose = true;
                        break;
                    }
                }
            }
            if (!tooClose) {
                for (let b of this.bots) {
                    if (b.id !== entity.id && b.hp > 0) {
                        if (Math.hypot(rx - b.x, ry - b.y) < currentMinDist) {
                            tooClose = true;
                            break;
                        }
                    }
                }
            }

            if (!collides && !tooClose) found = true;
        }

        entity.x = rx;
        entity.y = ry;
        entity.hp = entity.maxHp;
        entity.shield = entity.maxShield;
        entity.ammo = entity.maxAmmo;
        entity.isReloading = false;
        entity.respawnTimer = 0;
        entity.shootCooldownTimer = 0;
        entity.dashDurationTimer = 0;
        entity.damageMultiplier = 1.0;
        entity.speedMultiplier = 1.0;
        entity.critChance = 0.1;
        entity.lifesteal = 0.0;
        entity.armorPenetration = 0.0;
        entity.damageReduction = 0.0;
        entity.buffs = { damage: 0, speed: 0, crit: 0, vamp: 0, pierce: 0, defense: 0 };
        entity.healingPacks = 0;
        entity.invincibleTimer = 3.0; // 3 seconds spawn protection
    }

    /**
     * Reset all player stats & buffs to default when starting a match.
     */
    resetPlayerStatsForMatch(player) {
        player.maxHp = player.perk === 'health_boost' ? 130 : 100;
        player.maxShield = player.perk === 'shield' ? 30 : 0;
        player.hp = player.maxHp;
        player.shield = player.maxShield;
        player.ammo = WEAPONS[player.gunType].maxAmmo;
        player.isReloading = false;
        player.respawnTimer = 0;
        player.shootCooldownTimer = 0;
        player.dashDurationTimer = 0;
        player.damageMultiplier = 1.0;
        player.speedMultiplier = 1.0;
        player.critChance = 0.1;
        player.lifesteal = 0.0;
        player.armorPenetration = 0.0;
        player.damageReduction = 0.0;
        player.buffs = { damage: 0, speed: 0, crit: 0, vamp: 0, pierce: 0, defense: 0 };
        player.healingPacks = 0;
        player.invincibleTimer = 3.0; // 3 seconds spawn protection
        player.score = 0;
        player.deaths = 0;
        player.inLobby = false;
        player.survivalRank = 1;
    }

    /**
     * Handle incoming input from client.
     */
    handlePlayerInput(wsId, input) {
        const player = this.players.get(wsId);
        if (player && this.state === 'playing') {
            player.input = input;

            // Trigger healing item usage from storage
            if (input.useHeal && player.hp > 0 && player.hp < player.maxHp && (player.healingPacks || 0) > 0) {
                player.healingPacks--;
                player.hp = Math.min(player.maxHp, player.hp + 25);

                // Broadcast healing sound effect trigger
                this.broadcast({
                    type: 'pickup',
                    itemType: 'heal',
                    x: player.x,
                    y: player.y
                });
            }
        }
    }

    /**
     * Spawn a bullet on the server.
     */
    spawnBullet(owner, angle) {
        const gun = WEAPONS[owner.gunType];
        
        // Damage multiplier from Perk & Active Buffs
        let dmg = gun.damage;
        if (owner.perk === 'bullet_damage_boost') dmg = Math.round(dmg * 1.15);
        if (owner.damageMultiplier) dmg = Math.round(dmg * owner.damageMultiplier);

        if (gun.count === 1) {
            // Single shot
            const bullet = {
                id: this.nextBulletId++,
                ownerId: owner.id,
                ownerTeam: owner.team,
                ownerName: owner.name,
                x: owner.x + Math.cos(angle) * (owner.radius + 5),
                y: owner.y + Math.sin(angle) * (owner.radius + 5),
                vx: Math.cos(angle) * gun.bulletSpeed,
                vy: Math.sin(angle) * gun.bulletSpeed,
                radius: 4,
                damage: dmg,
                range: gun.range,
                distanceTraveled: 0,
                angle: angle
            };
            this.bullets.push(bullet);
        } else {
            // Multi shot (Shotgun)
            const spreadAngle = gun.spread;
            const startAngle = angle - (spreadAngle * (gun.count - 1)) / 2;

            for (let i = 0; i < gun.count; i++) {
                const bAngle = startAngle + i * spreadAngle + (Math.random() - 0.5) * 0.08;
                const bullet = {
                    id: this.nextBulletId++,
                    ownerId: owner.id,
                    ownerTeam: owner.team,
                    ownerName: owner.name,
                    x: owner.x + Math.cos(bAngle) * (owner.radius + 5),
                    y: owner.y + Math.sin(bAngle) * (owner.radius + 5),
                    vx: Math.cos(bAngle) * gun.bulletSpeed,
                    vy: Math.sin(bAngle) * gun.bulletSpeed,
                    radius: 3,
                    damage: dmg,
                    range: gun.range,
                    distanceTraveled: 0,
                    angle: bAngle
                };
                this.bullets.push(bullet);
            }
        }

        // Send a temporary visual event so clients can play muzzle flash / audio
        this.broadcast({
            type: 'audio_trigger',
            action: 'shoot',
            gunType: owner.gunType,
            x: owner.x,
            y: owner.y
        });
    }

    /**
     * Main Server Room Update Loop (30 FPS).
     */
    update() {
        const now = Date.now();
        const deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        if (this.state === 'countdown') {
            const oldSec = Math.ceil(this.countdownTimer);
            this.countdownTimer -= deltaTime;
            const newSec = Math.ceil(this.countdownTimer);
            
            if (newSec < oldSec && newSec > 0) {
                this.broadcast({
                    type: 'audio_trigger',
                    action: 'countdown_tick',
                    value: newSec
                });
            }

            if (this.countdownTimer <= 0) {
                this.state = 'playing';
                this.matchTimer = this.matchDuration;
                this.broadcast({
                    type: 'audio_trigger',
                    action: 'match_start'
                });
            }
            
            // Lock invincible during countdown
            this.players.forEach(p => { p.invincibleTimer = 3.0; });
            this.bots.forEach(b => { b.invincibleTimer = 3.0; });

            this.sendStateToClients();
            return;
        }

        if (this.state !== 'playing') return;

        const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team' || this.gameMode === 'ranked';
        if (isSurvival) {
            this.updateSurvivalSafeZone(deltaTime);
        }

        // Update match timer
        if (this.matchDuration > 0) {
            this.matchTimer = Math.max(0, this.matchTimer - deltaTime);
            if (this.matchTimer <= 0) {
                this.handleMatchEnd();
                return;
            }
        } else {
            // Infinite match duration: count up elapsed time
            this.matchTimer += deltaTime;
        }

        if (this.gameMode === 'ranked') {
            // Check win/loss: end match if the single player dies
            let playerAlive = false;
            this.players.forEach(p => { if (p.hp > 0) playerAlive = true; });
            if (!playerAlive && this.players.size > 0) {
                this.handleMatchEnd();
                return;
            }

            // Maintain dynamic count of bots with escalating difficulty based on score
            const player = Array.from(this.players.values())[0];
            const playerScore = player ? (player.score || 0) : 0;
            const upgradeCount = Math.floor(playerScore / 10);
            const maxBots = 10 + upgradeCount * 2;

            let currentDifficulty = 'easy';
            if (upgradeCount >= 4) currentDifficulty = 'nightmare';
            else if (upgradeCount === 3) currentDifficulty = 'expert';
            else if (upgradeCount === 2) currentDifficulty = 'hard';
            else if (upgradeCount === 1) currentDifficulty = 'medium';

            const aliveBots = this.bots.filter(b => b.hp > 0).length;
            if (aliveBots < maxBots) {
                const botsToSpawn = maxBots - aliveBots;
                for (let i = 0; i < botsToSpawn; i++) {
                    this.spawnSingleBot('red', this.bots.length + i, currentDifficulty);
                }
            }
        } else if (isSurvival) {
            this.checkSurvivalWinCondition();
        }

        // 1. Update Players
        this.players.forEach(player => {
            // Save last positions for bot speed prediction
            player.lastX = player.x;
            player.lastY = player.y;

            if (player.hp <= 0) {
                const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';
                // If it is survival OR host in auto-spectate mode, do not respawn
                if (isSurvival || (this.isAutoSpectate && player.id === this.hostId)) {
                    player.respawnTimer = 999999;
                    return;
                }
                player.respawnTimer += deltaTime;
                if (player.respawnTimer >= 3.0) {
                    this.respawnEntity(player);
                }
                return;
            }

            // Decrease spawn protection timer
            if (player.invincibleTimer > 0) {
                player.invincibleTimer = Math.max(0, player.invincibleTimer - deltaTime);
            }

            // Handle Dash duration
            if (player.dashDurationTimer > 0) {
                player.dashDurationTimer -= deltaTime;
                player.x += Math.cos(player.dashAngle) * player.dashSpeed * deltaTime;
                player.y += Math.sin(player.dashAngle) * player.dashSpeed * deltaTime;
                Physics.constrainToMap(player, this.mapWidth, this.mapHeight);
                this.obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(player, obs));
            } else {
                // Update cooldowns
                if (player.dashCooldownTimer > 0) player.dashCooldownTimer -= deltaTime;
                if (player.shootCooldownTimer > 0) player.shootCooldownTimer -= deltaTime;

                if (player.isReloading) {
                    player.reloadTimer -= deltaTime;
                    if (player.reloadTimer <= 0) {
                        player.isReloading = false;
                        player.ammo = player.maxAmmo;
                    }
                }

                // Parse input movement
                let dx = 0;
                let dy = 0;
                if (player.input.w) dy -= 1;
                if (player.input.s) dy += 1;
                if (player.input.a) dx -= 1;
                if (player.input.d) dx += 1;

                // Normalize movement vector
                if (dx !== 0 || dy !== 0) {
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const speed = player.speed * (player.speedMultiplier || 1.0);
                    const moveX = (dx / length) * speed * deltaTime;
                    const moveY = (dy / length) * speed * deltaTime;
                    
                    player.x += moveX;
                    player.y += moveY;

                    // Dash trigger
                    if (player.input.space && player.dashCooldownTimer <= 0) {
                        player.dashCooldownTimer = 3.0; // 3 seconds cooldown
                        player.dashDurationTimer = 0.15; // 150ms dash
                        player.dashAngle = Math.atan2(dy, dx);
                    }
                }

                player.angle = player.input.mouseAngle;

                // Resolve Collisions
                Physics.constrainToMap(player, this.mapWidth, this.mapHeight);
                this.obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(player, obs));

                // Shield Regeneration
                if (player.perk === 'shield' && player.shield < player.maxShield) {
                    player.shieldRegenTimer += deltaTime;
                    if (player.shieldRegenTimer >= 5.0) { // 5s no damage
                        player.shield = Math.min(player.maxShield, player.shield + 10 * deltaTime);
                    }
                }

                // Handle Reloading Manual trigger
                if (player.input.r && !player.isReloading && player.ammo < player.maxAmmo) {
                    player.isReloading = true;
                    let reloadMultiplier = player.perk === 'faster_reload' ? 0.5 : 1.0;
                    player.reloadTimer = WEAPONS[player.gunType].reloadTime * reloadMultiplier;
                }

                // Shooting trigger
                if (player.input.shooting && !player.isReloading && player.shootCooldownTimer <= 0) {
                    if (player.ammo > 0) {
                        this.spawnBullet(player, player.angle);
                        player.ammo--;
                        player.shootCooldownTimer = WEAPONS[player.gunType].fireRate;
                    } else {
                        // Auto reload
                        player.isReloading = true;
                        let reloadMultiplier = player.perk === 'faster_reload' ? 0.5 : 1.0;
                        player.reloadTimer = WEAPONS[player.gunType].reloadTime * reloadMultiplier;
                    }
                }
            }
        });

        // 2. Update Bots AI
        BotAI.updateBots(this, deltaTime);

        // Bots Respawn and Shield Regen
        this.bots.forEach(bot => {
            bot.lastX = bot.x;
            bot.lastY = bot.y;

            if (bot.hp <= 0) {
                const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';
                if (isSurvival) {
                    bot.respawnTimer = 999999;
                    return;
                }
                bot.respawnTimer += deltaTime;
                if (bot.respawnTimer >= 3.0) {
                    this.respawnEntity(bot);
                }
                return;
            }

            // Decrease spawn protection timer
            if (bot.invincibleTimer > 0) {
                bot.invincibleTimer = Math.max(0, bot.invincibleTimer - deltaTime);
            }

            if (bot.perk === 'shield' && bot.shield < bot.maxShield) {
                bot.shieldRegenTimer += deltaTime;
                if (bot.shieldRegenTimer >= 5.0) {
                    bot.shield = Math.min(bot.maxShield, bot.shield + 10 * deltaTime);
                }
            }
        });

        // 3. Update Bullets using Sub-stepping to prevent tunneling (bullets passing through walls/players)
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            const totalDx = bullet.vx * deltaTime;
            const totalDy = bullet.vy * deltaTime;
            const totalDist = Math.hypot(totalDx, totalDy);
            
            // Sub-step size limit to 12 pixels per tick
            const stepSize = 12;
            const steps = Math.ceil(totalDist / stepSize);
            const stepDx = steps > 0 ? totalDx / steps : 0;
            const stepDy = steps > 0 ? totalDy / steps : 0;
            
            let destroyed = false;
            let currentX = bullet.x;
            let currentY = bullet.y;

            for (let step = 0; step < steps; step++) {
                currentX += stepDx;
                currentY += stepDy;
                bullet.distanceTraveled += Math.hypot(stepDx, stepDy);

                // Check out of bounds or range limits
                if (currentX < 0 || currentX > this.mapWidth || currentY < 0 || currentY > this.mapHeight || bullet.distanceTraveled >= bullet.range) {
                    destroyed = true;
                    break;
                }

                // Check static obstacle collision at this sub-step
                for (let obs of this.obstacles) {
                    if (Physics.checkCircleRectCollision(currentX, currentY, bullet.radius, obs.x, obs.y, obs.w, obs.h)) {
                        destroyed = true;
                        break;
                    }
                }
                if (destroyed) break;

                // Check Crates collision at this sub-step (Survival Mode Loot Crates)
                if (isSurvival && this.crates.length > 0) {
                    let crateHit = null;
                    let crateHitIdx = -1;
                    for (let j = this.crates.length - 1; j >= 0; j--) {
                        const crate = this.crates[j];
                        if (Physics.checkCircleRectCollision(currentX, currentY, bullet.radius, crate.x, crate.y, crate.w, crate.h)) {
                            crateHit = crate;
                            crateHitIdx = j;
                            break;
                        }
                    }
                    if (crateHit) {
                        destroyed = true;
                        crateHit.hp -= bullet.damage;
                        
                        this.broadcast({
                            type: 'audio_trigger',
                            action: 'hit_crate',
                            x: crateHit.x,
                            y: crateHit.y
                        });

                        if (crateHit.hp <= 0) {
                            this.crates.splice(crateHitIdx, 1);
                            
                            this.broadcast({
                                type: 'audio_trigger',
                                action: 'break_crate',
                                x: crateHit.x,
                                y: crateHit.y
                            });

                            // Drop 1-2 random buffs (or 4-6 if it's a Large Airdrop)
                            const isLargeCrate = crateHit.isLarge || false;
                            const dropCount = isLargeCrate ? (Math.floor(Math.random() * 3) + 4) : (Math.random() < 0.3 ? 2 : 1);
                            
                            for (let d = 0; d < dropCount; d++) {
                                const randType = Math.random();
                                let itemType = 'heal';
                                if (randType < 0.20) itemType = 'heal';
                                else if (randType < 0.40) itemType = 'shield';
                                else if (randType < 0.52) itemType = 'damage';
                                else if (randType < 0.64) itemType = 'speed';
                                else if (randType < 0.73) itemType = 'crit';
                                else if (randType < 0.82) itemType = 'vamp';
                                else if (randType < 0.91) itemType = 'pierce';
                                else itemType = 'defense';

                                const offsetRange = isLargeCrate ? 50 : 20;
                                this.items.push({
                                    id: this.nextItemId++,
                                    x: crateHit.x + (crateHit.w || 40) / 2 + (Math.random() * offsetRange - offsetRange / 2),
                                    y: crateHit.y + (crateHit.h || 40) / 2 + (Math.random() * offsetRange - offsetRange / 2),
                                    type: itemType,
                                    radius: 15
                                });
                            }
                        }
                        break;
                    }
                }

                // Check Player collision at this sub-step
                for (let [wsId, player] of this.players.entries()) {
                    if (bullet.ownerId === player.id) continue;
                    const isTeammate = (this.gameMode === 'team' || this.gameMode === 'coop' || this.gameMode === 'survival_team') && bullet.ownerTeam === player.team;
                    if (isTeammate) continue;

                    if (player.hp > 0 && Physics.checkCircleCircleCollision(currentX, currentY, bullet.radius, player.x, player.y, player.radius)) {
                        this.damageEntity(player, bullet.damage, bullet.ownerId, bullet.ownerName);
                        destroyed = true;
                        break;
                    }
                }
                if (destroyed) break;

                // Check Bot collision at this sub-step
                for (let bot of this.bots) {
                    if (bullet.ownerId === bot.id) continue;
                    const isTeammate = (this.gameMode === 'team' || this.gameMode === 'coop' || this.gameMode === 'vs_bot' || this.gameMode === 'survival_team') && bullet.ownerTeam === bot.team;
                    if (isTeammate) continue;

                    if (bot.hp > 0 && Physics.checkCircleCircleCollision(currentX, currentY, bullet.radius, bot.x, bot.y, bot.radius)) {
                        this.damageEntity(bot, bullet.damage, bullet.ownerId, bullet.ownerName);
                        destroyed = true;
                        break;
                    }
                }
                if (destroyed) break;
            }

            // Sync final sub-step positions back to bullet
            bullet.x = currentX;
            bullet.y = currentY;

            if (destroyed) {
                this.bullets.splice(i, 1);
            }
        }

        // 4. Update items pickup collisions
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            let pickedUp = false;

            // Check players
            for (let [wsId, player] of this.players.entries()) {
                if (player.hp > 0 && Physics.checkCircleCircleCollision(player.x, player.y, player.radius, item.x, item.y, item.radius)) {
                    if (this.canPickupItem(player, item)) {
                        this.applyItemBuff(player, item);
                        pickedUp = true;
                        break;
                    }
                }
            }

            // Check bots
            if (!pickedUp) {
                for (let bot of this.bots) {
                    if (bot.hp > 0 && Physics.checkCircleCircleCollision(bot.x, bot.y, bot.radius, item.x, item.y, item.radius)) {
                        if (this.canPickupItem(bot, item)) {
                            this.applyItemBuff(bot, item);
                            pickedUp = true;
                            break;
                        }
                    }
                }
            }

            if (pickedUp) {
                this.items.splice(i, 1);
            }
        }

        // 5. Send State Update to Clients
        this.sendStateToClients();
    }

    /**
     * Determine if an entity can collect a dropped item.
     */
    canPickupItem(entity, item) {
        if (item.type === 'heal') {
            const hasInventoryRoom = (entity.healingPacks || 0) < 5;
            const needsHealing = entity.hp < entity.maxHp;
            return needsHealing || hasInventoryRoom;
        }
        return true;
    }

    /**
     * Apply dropped item buff to player or bot.
     */
    applyItemBuff(entity, item) {
        if (item.type === 'heal') {
            // Prioritize direct healing first. If HP is full, store in inventory (max 5)
            if (entity.hp < entity.maxHp) {
                entity.hp = Math.min(entity.maxHp, entity.hp + 25);
            } else if ((entity.healingPacks || 0) < 5) {
                entity.healingPacks = (entity.healingPacks || 0) + 1;
            }
        } else if (item.type === 'shield') {
            entity.maxShield = Math.max(100, entity.maxShield); // Ensure maxShield is set to at least 100 to allow visual display
            entity.shield = Math.min(entity.maxShield, entity.shield + 25);
        } else if (item.type === 'damage') {
            if (entity.buffs.damage < 5) {
                entity.buffs.damage++;
                entity.damageMultiplier += 0.2;
            }
        } else if (item.type === 'speed') {
            if (entity.buffs.speed < 5) {
                entity.buffs.speed++;
                entity.speedMultiplier += 0.15;
            }
        } else if (item.type === 'crit') {
            if (entity.buffs.crit < 5) {
                entity.buffs.crit++;
                entity.critChance = Math.min(0.6, entity.critChance + 0.1); // max 60% crit
            }
        } else if (item.type === 'vamp') {
            if (entity.buffs.vamp < 5) {
                entity.buffs.vamp++;
                entity.lifesteal = Math.min(0.4, entity.lifesteal + 0.08); // max 40% lifesteal
            }
        } else if (item.type === 'pierce') {
            if (entity.buffs.pierce < 5) {
                entity.buffs.pierce++;
                entity.armorPenetration = Math.min(0.5, entity.armorPenetration + 0.1); // max 50% armor penetration
            }
        } else if (item.type === 'defense') {
            if (entity.buffs.defense < 5) {
                entity.buffs.defense++;
                entity.damageReduction = Math.min(0.5, entity.damageReduction + 0.1); // max 50% damage reduction
            }
        }

        // Trigger pickup audio trigger
        this.broadcast({
            type: 'audio_trigger',
            action: 'pickup',
            itemType: item.type,
            x: entity.x,
            y: entity.y
        });
    }

    /**
     * Apply damage to an entity (player or bot).
     */
    damageEntity(entity, damage, attackerId, attackerName) {
        // Spawn protection check
        if (entity.invincibleTimer > 0) return;

        // Find attacker object
        const attacker = this.players.get(attackerId) || this.bots.find(b => b.id === attackerId);

        // 1. Calculate Critical Hit (2x damage)
        const critChance = attacker ? attacker.critChance : 0.1;
        const isCrit = Math.random() < critChance;
        let finalDamage = damage;
        if (isCrit) {
            finalDamage = Math.round(finalDamage * 2.0);
        }

        // Apply Damage Reduction mitigation (defense buff)
        const dmgRed = entity.damageReduction || 0.0;
        
        // Extra 25% damage mitigation if entity currently has shield left
        const shieldAbsorption = entity.shield > 0 ? 0.25 : 0.0;
        
        const totalMitigation = Math.min(0.75, dmgRed + shieldAbsorption); // cap max total mitigation at 75%
        finalDamage = Math.round(finalDamage * (1.0 - totalMitigation));

        // Save original HP & Shield to calculate actual damage dealt for lifesteal
        const oldHp = entity.hp;
        const oldShield = entity.shield;

        // Reset shield regen timer on damage
        entity.shieldRegenTimer = 0;

        // 2. Calculate Armor Penetration (bypass shield directly to HP)
        const armorPen = attacker ? attacker.armorPenetration : 0.0;
        let penDamage = 0;
        if (entity.shield > 0 && armorPen > 0) {
            penDamage = Math.round(finalDamage * armorPen);
            finalDamage = Math.max(0, finalDamage - penDamage);
        }

        // Apply armor pen damage to HP first
        if (penDamage > 0) {
            entity.hp = Math.max(0, entity.hp - penDamage);
        }

        // Apply remaining damage to shield first, then HP
        if (finalDamage > 0) {
            if (entity.shield > 0) {
                if (entity.shield >= finalDamage) {
                    entity.shield -= finalDamage;
                    finalDamage = 0;
                } else {
                    finalDamage -= entity.shield;
                    entity.shield = 0;
                }
            }

            if (finalDamage > 0) {
                entity.hp = Math.max(0, entity.hp - finalDamage);
            }
        }

        // Calculate actual damage dealt (to HP and Shield combined)
        const actualDmgDealt = (oldHp - entity.hp) + (oldShield - entity.shield);

        // 3. Calculate Lifesteal
        let lifestealHeal = 0;
        if (attacker && attacker.hp > 0 && attacker.lifesteal > 0) {
            lifestealHeal = Math.round(actualDmgDealt * attacker.lifesteal);
            if (lifestealHeal > 0) {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifestealHeal);
            }
        }

        // 4. Trigger audio and visual damage popup events
        this.broadcast({
            type: 'audio_trigger',
            action: 'hit',
            x: entity.x,
            y: entity.y
        });

        // Broadcast damage popup event to draw floating text
        this.broadcast({
            type: 'damage_pop',
            x: entity.x,
            y: entity.y - 12,
            amount: actualDmgDealt,
            isCrit: isCrit,
            healAmount: lifestealHeal,
            attackerId: attackerId
        });

        // Check if dead
        if (entity.hp <= 0) {
            entity.deaths++;
            this.handleDeath(entity, attackerId, attackerName);
        }
    }

    /**
     * Handle entity death.
     */
    handleDeath(victim, killerId, killerName) {
        console.log(`${victim.name} was killed by ${killerName || 'Unknown'}`);
        
        // Find killer and add score
        let killerFound = false;

        // Check players
        const playerKiller = this.players.get(killerId);
        if (playerKiller) {
            playerKiller.score++;
            killerFound = true;
        }

        // Check bots
        if (!killerFound) {
            const botKiller = this.bots.find(b => b.id === killerId);
            if (botKiller) {
                botKiller.score++;
            }
        }

        // Assign survivalRank if survival mode
        const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';
        if (isSurvival) {
            const aliveCount = Array.from(this.players.values()).filter(p => p.hp > 0).length + this.bots.filter(b => b.hp > 0).length;
            victim.survivalRank = Math.max(1, aliveCount + 1); // +1 because victim is already at <= 0 HP
        }

        // Broadcast death particle and sound event
        this.broadcast({
            type: 'death_event',
            victimName: victim.name,
            killerName: killerName || 'Unknown',
            x: victim.x,
            y: victim.y,
            team: victim.team
        });

        // Random item drop on death (50% drop rate)
        if (Math.random() < 0.5) {
            const randType = Math.random();
            let itemType = 'heal';
            if (randType < 0.22) {
                itemType = 'heal';
            } else if (randType < 0.44) {
                itemType = 'shield';
            } else if (randType < 0.56) {
                itemType = 'damage';
            } else if (randType < 0.68) {
                itemType = 'speed';
            } else if (randType < 0.76) {
                itemType = 'crit';
            } else if (randType < 0.84) {
                itemType = 'vamp';
            } else if (randType < 0.92) {
                itemType = 'pierce';
            } else {
                itemType = 'defense';
            }

            this.items.push({
                id: this.nextItemId++,
                x: Math.round(victim.x),
                y: Math.round(victim.y),
                type: itemType,
                radius: 15
            });
        }
    }

    /**
     * Package and broadcast current game state.
     */
    sendStateToClients() {
        const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';
        const state = {
            type: 'game_state',
            state: this.state,
            gameMode: this.gameMode,
            matchTimer: Math.ceil(this.matchTimer),
            countdownTimer: Math.ceil(this.countdownTimer),
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                x: Math.round(p.x),
                y: Math.round(p.y),
                angle: Number(p.angle.toFixed(2)),
                hp: Math.round(p.hp),
                maxHp: p.maxHp,
                shield: Math.round(p.shield),
                maxShield: p.maxShield,
                score: p.score,
                deaths: p.deaths,
                ammo: p.ammo,
                maxAmmo: p.maxAmmo,
                gunType: p.gunType,
                perk: p.perk,
                skin: p.skin,
                accessory: p.accessory,
                team: p.team,
                isReloading: p.isReloading,
                reloadProgress: p.isReloading ? Number(((WEAPONS[p.gunType].reloadTime * (p.perk === 'faster_reload' ? 0.5 : 1.0) - p.reloadTimer) / (WEAPONS[p.gunType].reloadTime * (p.perk === 'faster_reload' ? 0.5 : 1.0))).toFixed(2)) : 0,
                buffs: p.buffs,
                healingPacks: p.healingPacks || 0,
                invincible: p.invincibleTimer > 0
            })),
            bots: this.bots.map(b => ({
                id: b.id,
                name: b.name,
                x: Math.round(b.x),
                y: Math.round(b.y),
                angle: Number((b.angle || 0).toFixed(2)),
                hp: Math.round(b.hp),
                maxHp: b.maxHp,
                shield: Math.round(b.shield),
                maxShield: b.maxShield,
                score: b.score,
                deaths: b.deaths,
                ammo: b.ammo,
                maxAmmo: b.maxAmmo,
                gunType: b.gunType,
                perk: b.perk,
                skin: b.skin,
                accessory: b.accessory,
                team: b.team,
                isReloading: b.isReloading,
                reloadProgress: b.isReloading ? Number(((b.weaponStats.reloadTime * (b.perk === 'faster_reload' ? 0.5 : 1.0) - b.reloadTimer) / (b.weaponStats.reloadTime * (b.perk === 'faster_reload' ? 0.5 : 1.0))).toFixed(2)) : 0,
                buffs: b.buffs,
                healingPacks: b.healingPacks || 0,
                invincible: b.invincibleTimer > 0
            })),
            bullets: this.bullets.map(b => ({
                id: b.id,
                x: Math.round(b.x),
                y: Math.round(b.y),
                vx: Math.round(b.vx),
                vy: Math.round(b.vy),
                angle: Number(b.angle.toFixed(2)),
                ownerTeam: b.ownerTeam
            })),
            items: this.items.map(it => ({
                id: it.id,
                x: it.x,
                y: it.y,
                type: it.type
            })),
            safeZone: (this.gameMode === 'survival' || this.gameMode === 'survival_team') ? {
                x: Math.round(this.safeZone.x),
                y: Math.round(this.safeZone.y),
                radius: Math.round(this.safeZone.radius),
                timer: Math.ceil(this.safeZone.timer),
                stage: this.safeZone.stage,
                shrinkingTimer: Math.ceil(this.safeZone.shrinkingTimer)
            } : null,
            crates: this.crates.map(c => ({
                id: c.id,
                x: c.x,
                y: c.y,
                w: c.w || 40,
                h: c.h || 40,
                hp: c.hp,
                maxHp: c.maxHp,
                isLarge: c.isLarge || false
            })),
            aliveCount: Array.from(this.players.values()).filter(p => p.hp > 0).length + this.bots.filter(b => b.hp > 0).length,
            totalCount: this.players.size + this.bots.length
        };

        this.broadcast(state);
    }

    /**
     * Update ring status and apply poison ring damage in survival mode.
     */
    updateSurvivalSafeZone(deltaTime) {
        if (this.gameMode === 'ranked') return;
        const zone = this.safeZone;
        
        if (zone.shrinkingTimer > 0) {
            // Bo đang co
            zone.shrinkingTimer -= deltaTime;
            
            const totalShrinkDuration = this.survivalShrinkDuration || 30.0;
            const t = deltaTime / (zone.shrinkingTimer + deltaTime);
            zone.x += (zone.targetX - zone.x) * t;
            zone.y += (zone.targetY - zone.y) * t;
            zone.radius += (zone.targetRadius - zone.radius) * t;

            if (zone.shrinkingTimer <= 0) {
                // Đã co xong thực tế về targetRadius
                zone.x = zone.targetX;
                zone.y = zone.targetY;
                zone.radius = zone.targetRadius;
                
                // Chuyển sang vòng bo tiếp theo (stage++)
                zone.stage++;
                
                // Reset thời gian chờ bo co sau
                // Càng các stage sau, thời gian chờ bo có thể ngắn hơn (ví dụ: stage 1 = 180s, stage 2 = 120s, stage 3 = 90s, stage 4 = 60s)
                let nextWaitTime = this.survivalSafeZoneDuration;
                if (zone.stage === 1) nextWaitTime = Math.max(15, Math.round(this.survivalSafeZoneDuration * 0.75));
                else if (zone.stage === 2) nextWaitTime = Math.max(15, Math.round(this.survivalSafeZoneDuration * 0.5));
                else if (zone.stage >= 3) nextWaitTime = Math.max(15, Math.round(this.survivalSafeZoneDuration * 0.3));
                
                zone.timer = nextWaitTime;

                // Tính toán mục tiêu co bo tiếp theo (mỗi stage co nhỏ đi 60% của vòng trước)
                zone.targetRadius = zone.radius * 0.60;
                const maxOffset = zone.radius - zone.targetRadius;
                if (maxOffset > 0) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * maxOffset;
                    zone.targetX = zone.x + Math.cos(angle) * dist;
                    zone.targetY = zone.y + Math.sin(angle) * dist;
                } else {
                    zone.targetX = zone.x;
                    zone.targetY = zone.y;
                }
                // Spawn a Large Gift Crate (Airdrop) inside the new safe zone
                let foundAirdropPos = false;
                let ax = zone.x, ay = zone.y;
                let attempts = 0;
                while (!foundAirdropPos && attempts < 100) {
                    attempts++;
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * (zone.radius - 100);
                    ax = zone.x + Math.cos(angle) * dist;
                    ay = zone.y + Math.sin(angle) * dist;
                    
                    // Check collision with obstacles
                    let collides = false;
                    for (let obs of this.obstacles) {
                        if (Physics.checkCircleRectCollision(ax, ay, 40, obs.x, obs.y, obs.w, obs.h)) {
                            collides = true;
                            break;
                        }
                    }
                    if (!collides) foundAirdropPos = true;
                }
                
                this.crates.push({
                    id: this.nextCrateId++,
                    x: Math.round(ax - 35), // Centered w=70
                    y: Math.round(ay - 35),
                    w: 70,
                    h: 70,
                    hp: 200,
                    maxHp: 200,
                    isLarge: true
                });

                this.broadcast({
                    type: 'announcement',
                    text: `HỘP QUÀ LỚN (AIRDROP) ĐÃ XUẤT HIỆN TRONG VÒNG BO!`
                });
                
                this.broadcast({
                    type: 'announcement',
                    text: `VÒNG BO ĐÃ THU HẸP XONG! TIẾP TỤC CHUẨN BỊ CHO VÒNG TIẾP THEO.`
                });
            }
        } else {
            // Đang đếm ngược chờ co bo sau
            zone.timer = Math.max(0, zone.timer - deltaTime);
            if (zone.timer <= 0) {
                // Hết thời gian chờ, bắt đầu co bo!
                zone.shrinkingTimer = this.survivalShrinkDuration || 30.0;
                
                this.broadcast({
                    type: 'announcement',
                    text: `VÒNG BO BẮT ĐẦU CO LẠI! HÃY CHẠY VÀO TRONG BO.`
                });
                this.broadcast({
                    type: 'audio_trigger',
                    action: 'border_shrink'
                });
            }
        }

        // 3. Apply Poison Ring Damage to players and bots
        // Damage formula: 2% of maxHp per second, multiplied by (zone.stage + 1)
        const damageMultiplier = 0.02 * (zone.stage + 1);

        const dealZoneDamage = (entity) => {
            if (entity.hp <= 0) return;
            const dist = Math.hypot(entity.x - zone.x, entity.y - zone.y);
            if (dist > zone.radius) {
                const tickDamage = entity.maxHp * damageMultiplier * deltaTime;
                
                // Poison damage directly subtracts HP (ignores shield)
                entity.hp = Math.max(0, entity.hp - tickDamage);

                // Broadcast damage popup event
                this.broadcast({
                    type: 'damage_pop',
                    x: entity.x,
                    y: entity.y - 12,
                    amount: Math.round(tickDamage * 10) / 10,
                    isCrit: false,
                    isZone: true
                });

                if (entity.hp <= 0) {
                    entity.deaths++;
                    this.handleDeath(entity, 'zone', 'Vòng Bo');
                }
            }
        };

        this.players.forEach(dealZoneDamage);
        this.bots.forEach(dealZoneDamage);
    }

    /**
     * Check if a match winner can be declared in survival mode.
     */
    checkSurvivalWinCondition() {
        if (this.state !== 'playing') return;

        const isTeamSurvival = this.gameMode === 'survival_team';

        if (!isTeamSurvival) {
            // Solo survival win: 1 entity remains alive
            let aliveEntities = [];
            this.players.forEach(p => { if (p.hp > 0) aliveEntities.push(p); });
            this.bots.forEach(b => { if (b.hp > 0) aliveEntities.push(b); });

            if (aliveEntities.length <= 1) {
                this.handleMatchEnd();
            }
        } else {
            // Team survival win: 1 squad remains alive
            const activeSquads = new Set();
            
            this.players.forEach(p => {
                if (p.hp > 0 && p.team && p.team.startsWith('squad_')) {
                    activeSquads.add(p.team);
                }
            });

            this.bots.forEach(b => {
                if (b.hp > 0 && b.team && b.team.startsWith('squad_')) {
                    activeSquads.add(b.team);
                }
            });

            if (activeSquads.size <= 1) {
                this.handleMatchEnd();
            }
        }
    }

    /**
     * Handle match termination on timer depletion or survival win condition.
     */
    handleMatchEnd() {
        this.state = 'gameover';
        
        let winnerTeam = 'none'; // 'blue', 'red', 'none'
        let winnerName = '';     // for solo survival
        let blueScore = 0;
        let redScore = 0;

        const isSurvival = this.gameMode === 'survival' || this.gameMode === 'survival_team';

        if (!isSurvival) {
            // Standard modes: calculate team scores based on kills
            this.players.forEach(p => {
                if (p.team === 'blue') blueScore += p.score;
                else if (p.team === 'red') redScore += p.score;
            });

            this.bots.forEach(b => {
                if (b.team === 'blue') blueScore += b.score;
                else if (b.team === 'red') redScore += b.score;
            });

            if (blueScore > redScore) winnerTeam = 'blue';
            else if (redScore > blueScore) winnerTeam = 'red';
        } else {
            // Survival modes
            if (this.gameMode === 'survival') {
                // Find sole survivor
                this.players.forEach(p => { if (p.hp > 0) winnerName = p.name; });
                this.bots.forEach(b => { if (b.hp > 0) winnerName = b.name; });
                if (!winnerName) winnerName = 'Không ai cả (Bị bo tiêu diệt)';
            } else {
                // Team Survival: Determine which squad has alive players
                const activeSquads = new Set();
                this.players.forEach(p => {
                    if (p.hp > 0 && p.team && p.team.startsWith('squad_')) {
                        activeSquads.add(p.team);
                    }
                });
                this.bots.forEach(b => {
                    if (b.hp > 0 && b.team && b.team.startsWith('squad_')) {
                        activeSquads.add(b.team);
                    }
                });

                const winnerSquadList = Array.from(activeSquads);
                if (winnerSquadList.length > 0) {
                    winnerTeam = winnerSquadList[0];
                } else {
                    winnerTeam = 'none';
                }
            }
        }

        if (this.gameMode === 'ranked') {
            const player = Array.from(this.players.values())[0];
            const rankedScore = player ? (player.score || 0) : 0;
            const duration = Math.round(this.matchTimer);
            
            // Submit score and load updated day/week/month top 10 rankings
            const topRankings = player ? RankingsManager.submitScore(player.name, rankedScore, duration) : RankingsManager.getTopRankings();

            this.broadcast({
                type: 'game_over',
                gameMode: 'ranked',
                rankedScore: rankedScore,
                rankedDuration: duration,
                rankings: topRankings,
                scoreboard: []
            });
        } else {
            // Concat and sort players & bots by survivalRank (for survival) or score (for standard) to make final ranking
            const allEntities = Array.from(this.players.values()).concat(this.bots)
                .map(e => ({
                    id: e.id,
                    name: e.name,
                    score: e.score,
                    deaths: e.deaths,
                    team: e.team,
                    isBot: e.isBot || false,
                    survivalRank: e.survivalRank || 1
                }));

            if (isSurvival) {
                allEntities.sort((a, b) => a.survivalRank - b.survivalRank);
            } else {
                allEntities.sort((a, b) => b.score - a.score || a.deaths - b.deaths);
            }

            this.broadcast({
                type: 'game_over',
                winnerTeam: winnerTeam,
                winnerName: winnerName,
                gameMode: this.gameMode,
                blueScore: blueScore,
                redScore: redScore,
                scoreboard: allEntities
            });
        }

        this.destroy(); // Stop loop
    }

    /**
     * Stop game loop and clean up resources.
     */
    destroy() {
        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
        }
        console.log(`Room loop stopped: ${this.code}`);
    }
}

module.exports = GameRoom;
