// server/GameRoom.js
const Physics = require('./Physics');
const BotAI = require('./BotAI');

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
        this.gameMode = config.gameMode || 'vs_bot'; // vs_bot, coop, pvp, team
        this.botDifficulty = config.botDifficulty || 'medium'; // easy, medium, hard
        this.botCount = config.botCount || 4; // custom bot count
        this.matchDuration = config.matchDuration || 120; // in seconds
        this.matchTimer = this.matchDuration;
        this.maxPlayers = parseInt(config.maxPlayers) || 8;
        this.state = 'lobby'; // lobby, playing, gameover

        this.mapWidth = 2400;
        this.mapHeight = 1800;

        this.players = new Map(); // wsId -> player object
        this.bots = [];           // array of bot objects
        this.bullets = [];        // array of bullet objects
        this.nextBulletId = 1;
        this.nextBotId = 1000;

        // Set up map obstacles for a larger 2400x1800 arena
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

        // Loop interval
        this.loopInterval = null;
        this.lastTime = Date.now();
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
            // input state
            input: { w: false, a: false, s: false, d: false, space: false, r: false, shooting: false, mouseAngle: 0 }
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
        if (this.state !== 'lobby' || this.gameMode !== 'team') return;
        const player = this.players.get(wsId);
        if (player && (team === 'blue' || team === 'red')) {
            player.team = team;
            console.log(`Player ${player.name} changed team to ${team}`);
            this.broadcastLobbyUpdate();
        }
    }

    /**
     * Assign team based on game mode.
     */
    assignTeamForNewPlayer() {
        if (this.gameMode === 'team') {
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
        return 'none'; // PvP Free For All
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
            players: playersList
        });
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
    startGame() {
        if (this.state !== 'lobby') return;

        this.state = 'playing';
        this.bullets = [];
        this.bots = [];

        // Spawn Bots based on game mode
        this.spawnBotsForMatch();

        // Reposition players to spawn locations
        this.players.forEach(player => {
            this.respawnEntity(player);
            player.score = 0;
            player.deaths = 0;
        });

        this.broadcast({
            type: 'game_start',
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
            obstacles: this.obstacles
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
    spawnBotsForMatch() {
        let botCount = 0;
        let blueBots = 0;
        let redBots = 0;

        if (this.gameMode === 'vs_bot') {
            redBots = this.botCount;
        } else if (this.gameMode === 'coop') {
            redBots = this.botCount;
            // Số bot đồng đội phe Xanh = N - (số lượng người chơi thực)
            blueBots = Math.max(0, this.botCount - this.players.size);
        } else if (this.gameMode === 'pvp') {
            // Free for all. Spawn 3 bots to fill the arena
            botCount = 3;
            redBots = botCount;
        } else if (this.gameMode === 'team') {
            // Blue Team vs Red Team
            // Fill teams to 4 vs 4 with bots
            let realBlue = 0;
            let realRed = 0;
            this.players.forEach(p => {
                if (p.team === 'blue') realBlue++;
                else realRed++;
            });

            blueBots = Math.max(0, 4 - realBlue);
            redBots = Math.max(0, 4 - realRed);
        }

        const gunTypes = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'];
        const perks = ['none', 'speed_boost', 'extra_health', 'faster_reload', 'bullet_damage_boost', 'shield'];
        const skins = ['default', 'scout', 'heavy', 'tactical', 'neon'];
        const accessories = ['helmet', 'backpack', 'visor', 'shoulder_pad', 'none'];

        const spawnBot = (team, index) => {
            const id = this.nextBotId++;
            const gun = gunTypes[Math.floor(Math.random() * gunTypes.length)];
            const perk = perks[Math.floor(Math.random() * perks.length)];
            const skin = skins[Math.floor(Math.random() * skins.length)];
            const accessory = accessories[Math.floor(Math.random() * accessories.length)];
            const maxHp = perk === 'extra_health' ? 150 : 100;
            const maxShield = perk === 'shield' ? 30 : 0;

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
                maxHp: maxHp,
                hp: maxHp,
                maxShield: maxShield,
                shield: maxShield,
                shieldRegenTimer: 0,
                speed: perk === 'speed_boost' ? 240 : 200,
                ammo: WEAPONS[gun].maxAmmo,
                maxAmmo: WEAPONS[gun].maxAmmo,
                weaponStats: WEAPONS[gun],
                isReloading: false,
                reloadTimer: 0,
                shootCooldownTimer: 0,
                dashCooldownTimer: 0,
                dashDurationTimer: 0,
                dashAngle: 0,
                dashSpeed: 550,
                difficulty: this.botDifficulty,
                score: 0,
                deaths: 0,
                respawnTimer: 0,
                isBot: true
            };

            this.respawnEntity(bot);
            this.bots.push(bot);
        };

        for (let i = 0; i < redBots; i++) spawnBot(this.gameMode === 'pvp' ? 'none' : 'red', i);
        for (let i = 0; i < blueBots; i++) spawnBot('blue', i);
    }

    /**
     * Respawn player or bot at a safe location.
     */
    respawnEntity(entity) {
        // Find a location not colliding with obstacles
        let found = false;
        let rx, ry;
        let attempts = 0;

        while (!found && attempts < 100) {
            attempts++;
            rx = Math.random() * (this.mapWidth - 100) + 50;
            ry = Math.random() * (this.mapHeight - 100) + 50;

            // Check obstacle collision
            let collides = false;
            for (let obs of this.obstacles) {
                if (Physics.checkCircleRectCollision(rx, ry, entity.radius + 20, obs.x, obs.y, obs.w, obs.h)) {
                    collides = true;
                    break;
                }
            }
            if (!collides) found = true;
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
    }

    /**
     * Handle incoming input from client.
     */
    handlePlayerInput(wsId, input) {
        const player = this.players.get(wsId);
        if (player && this.state === 'playing') {
            player.input = input;
        }
    }

    /**
     * Spawn a bullet on the server.
     */
    spawnBullet(owner, angle) {
        const gun = WEAPONS[owner.gunType];
        
        // Damage multiplier from Perk
        let dmg = gun.damage;
        if (owner.perk === 'bullet_damage_boost') dmg = Math.round(dmg * 1.15);

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

        if (this.state !== 'playing') return;

        // Decrease match timer
        this.matchTimer = Math.max(0, this.matchTimer - deltaTime);
        if (this.matchTimer <= 0) {
            this.handleMatchEnd();
            return;
        }

        // 1. Update Players
        this.players.forEach(player => {
            // Save last positions for bot speed prediction
            player.lastX = player.x;
            player.lastY = player.y;

            if (player.hp <= 0) {
                player.respawnTimer += deltaTime;
                if (player.respawnTimer >= 3.0) {
                    this.respawnEntity(player);
                }
                return;
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
                    const moveX = (dx / length) * player.speed * deltaTime;
                    const moveY = (dy / length) * player.speed * deltaTime;
                    
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
                bot.respawnTimer += deltaTime;
                if (bot.respawnTimer >= 3.0) {
                    this.respawnEntity(bot);
                }
                return;
            }

            if (bot.perk === 'shield' && bot.shield < bot.maxShield) {
                bot.shieldRegenTimer += deltaTime;
                if (bot.shieldRegenTimer >= 5.0) {
                    bot.shield = Math.min(bot.maxShield, bot.shield + 10 * deltaTime);
                }
            }
        });

        // 3. Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Move bullet
            const bdx = bullet.vx * deltaTime;
            const bdy = bullet.vy * deltaTime;
            bullet.x += bdx;
            bullet.y += bdy;
            bullet.distanceTraveled += Math.sqrt(bdx * bdx + bdy * bdy);

            let destroyed = false;

            // Check out of bounds or range
            if (bullet.x < 0 || bullet.x > this.mapWidth || bullet.y < 0 || bullet.y > this.mapHeight || bullet.distanceTraveled >= bullet.range) {
                destroyed = true;
            }

            // Check obstacle collision
            if (!destroyed) {
                for (let obs of this.obstacles) {
                    if (Physics.checkCircleRectCollision(bullet.x, bullet.y, bullet.radius, obs.x, obs.y, obs.w, obs.h)) {
                        destroyed = true;
                        break;
                    }
                }
            }

            // Check Player collision
            if (!destroyed) {
                for (let [wsId, player] of this.players.entries()) {
                    // Do not shoot yourself, teammates (in team/coop mode)
                    if (bullet.ownerId === player.id) continue;
                    if ((this.gameMode === 'team' || this.gameMode === 'coop') && bullet.ownerTeam === player.team) continue;

                    if (player.hp > 0 && Physics.checkCircleCircleCollision(bullet.x, bullet.y, bullet.radius, player.x, player.y, player.radius)) {
                        this.damageEntity(player, bullet.damage, bullet.ownerId, bullet.ownerName);
                        destroyed = true;
                        break;
                    }
                }
            }

            // Check Bot collision
            if (!destroyed) {
                for (let bot of this.bots) {
                    // Do not shoot yourself, teammates
                    if (bullet.ownerId === bot.id) continue;
                    if ((this.gameMode === 'team' || this.gameMode === 'coop' || this.gameMode === 'vs_bot') && bullet.ownerTeam === bot.team) continue;

                    if (bot.hp > 0 && Physics.checkCircleCircleCollision(bullet.x, bullet.y, bullet.radius, bot.x, bot.y, bot.radius)) {
                        this.damageEntity(bot, bullet.damage, bullet.ownerId, bullet.ownerName);
                        destroyed = true;
                        break;
                    }
                }
            }

            if (destroyed) {
                this.bullets.splice(i, 1);
            }
        }

        // 4. Send State Update to Clients
        this.sendStateToClients();
    }

    /**
     * Apply damage to an entity (player or bot).
     */
    damageEntity(entity, damage, attackerId, attackerName) {
        // Reset shield regen timer on damage
        entity.shieldRegenTimer = 0;

        // Apply to shield first
        if (entity.shield > 0) {
            if (entity.shield >= damage) {
                entity.shield -= damage;
                damage = 0;
            } else {
                damage -= entity.shield;
                entity.shield = 0;
            }
        }

        if (damage > 0) {
            entity.hp = Math.max(0, entity.hp - damage);
        }

        // Trigger hit sound event
        this.broadcast({
            type: 'audio_trigger',
            action: 'hit',
            x: entity.x,
            y: entity.y
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

        // Broadcast death particle and sound event
        this.broadcast({
            type: 'death_event',
            victimName: victim.name,
            killerName: killerName || 'Unknown',
            x: victim.x,
            y: victim.y,
            team: victim.team
        });
    }

    /**
     * Package and broadcast current game state.
     */
    sendStateToClients() {
        const state = {
            type: 'game_state',
            state: this.state,
            gameMode: this.gameMode,
            matchTimer: Math.ceil(this.matchTimer),
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
                reloadProgress: p.isReloading ? Number(((WEAPONS[p.gunType].reloadTime * (p.perk === 'faster_reload' ? 0.5 : 1.0) - p.reloadTimer) / (WEAPONS[p.gunType].reloadTime * (p.perk === 'faster_reload' ? 0.5 : 1.0))).toFixed(2)) : 0
            })),
            bots: this.bots.map(b => ({
                id: b.id,
                name: b.name,
                x: Math.round(b.x),
                y: Math.round(b.y),
                angle: Number(b.angle.toFixed(2)),
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
                reloadProgress: b.isReloading ? Number(((b.weaponStats.reloadTime * (b.perk === 'faster_reload' ? 0.5 : 1.0) - b.reloadTimer) / (b.weaponStats.reloadTime * (b.perk === 'faster_reload' ? 0.5 : 1.0))).toFixed(2)) : 0
            })),
            bullets: this.bullets.map(b => ({
                id: b.id,
                x: Math.round(b.x),
                y: Math.round(b.y),
                angle: Number(b.angle.toFixed(2)),
                ownerTeam: b.ownerTeam
            }))
        };

        this.broadcast(state);
    }

    /**
     * Handle match termination on timer depletion.
     */
    handleMatchEnd() {
        this.state = 'gameover';
        
        let winnerTeam = 'none'; // 'blue', 'red', 'none' (hoa)
        let blueScore = 0;
        let redScore = 0;

        // Calculate team scores based on kills
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

        // Concat and sort players & bots by score to make final ranking
        const allEntities = Array.from(this.players.values()).concat(this.bots)
            .map(e => ({
                id: e.id,
                name: e.name,
                score: e.score,
                deaths: e.deaths,
                team: e.team,
                isBot: e.isBot || false
            }))
            .sort((a, b) => b.score - a.score || a.deaths - b.deaths);

        this.broadcast({
            type: 'game_over',
            winnerTeam: winnerTeam,
            blueScore: blueScore,
            redScore: redScore,
            scoreboard: allEntities
        });

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
