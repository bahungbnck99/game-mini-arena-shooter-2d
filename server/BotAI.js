// server/BotAI.js
const Physics = require('./Physics');

class BotAI {
    /**
     * Update the behavior of all bots in a game room.
     */
    static updateBots(room, deltaTime) {
        const bots = room.bots;
        const players = room.players;
        const obstacles = room.obstacles;
        const bullets = room.bullets;

        bots.forEach(bot => {
            if (bot.hp <= 0) return; // Skip dead bots (handled by respawn)

            // Initialize stuck prevention states
            if (bot.stuckTicks === undefined) bot.stuckTicks = 0;
            if (bot.avoidTimer === undefined) bot.avoidTimer = 0;
            if (bot.avoidDirection === undefined) bot.avoidDirection = 1;
            if (bot.stuckDuration === undefined) bot.stuckDuration = 0;
            if (bot.ignoreTargetTimer === undefined) bot.ignoreTargetTimer = 0;

            if (bot.ignoreTargetTimer > 0) {
                bot.ignoreTargetTimer -= deltaTime;
            }

            const startX = bot.x;
            const startY = bot.y;

            // Update timers
            if (bot.avoidTimer > 0) bot.avoidTimer -= deltaTime;
            if (bot.dashCooldownTimer > 0) bot.dashCooldownTimer -= deltaTime;
            if (bot.dashDurationTimer > 0) {
                bot.dashDurationTimer -= deltaTime;
                // Continue dash movement
                bot.x += Math.cos(bot.dashAngle) * bot.dashSpeed * deltaTime;
                bot.y += Math.sin(bot.dashAngle) * bot.dashSpeed * deltaTime;
                Physics.constrainToMap(bot, room.mapWidth, room.mapHeight);
                obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(bot, obs));
                return; // During dash, skip regular movement/shooting decisions
            }

            if (bot.isReloading) {
                bot.reloadTimer -= deltaTime;
                if (bot.reloadTimer <= 0) {
                    bot.isReloading = false;
                    bot.ammo = bot.maxAmmo;
                }
            }

            if (bot.shootCooldownTimer > 0) bot.shootCooldownTimer -= deltaTime;

            // Bots (especially Hard/Expert/Nightmare) automatically consume stored healing packs when HP < 60%
            if (bot.hp > 0 && bot.hp < bot.maxHp * 0.6 && (bot.healingPacks || 0) > 0) {
                bot.healingPacks--;
                bot.hp = Math.min(bot.maxHp, bot.hp + 25);
                
                // Broadcast healing sound effect trigger
                room.broadcast({
                    type: 'pickup',
                    itemType: 'heal',
                    x: bot.x,
                    y: bot.y
                });
            }

            const isSurvival = room.gameMode === 'survival' || room.gameMode === 'survival_team';
            let forceMoveToZone = false;

            if (isSurvival && room.safeZone) {
                const zone = room.safeZone;
                const distToZone = Math.hypot(bot.x - zone.x, bot.y - zone.y);
                if (distToZone > zone.radius * 0.82) {
                    forceMoveToZone = true;
                    let angleToZone = Math.atan2(zone.y - bot.y, zone.x - bot.x);
                    
                    // If avoiding obstacle
                    if (bot.avoidTimer > 0) {
                        angleToZone += bot.avoidDirection * (Math.PI / 2);
                    }
                    bot.angle = angleToZone;
                    
                    const moveSpeed = bot.speed * (bot.speedMultiplier || 1.0) * deltaTime;
                    bot.x += Math.cos(angleToZone) * moveSpeed;
                    bot.y += Math.sin(angleToZone) * moveSpeed;
                    Physics.constrainToMap(bot, room.mapWidth, room.mapHeight);
                    obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(bot, obs));
                }
            }

            // 1. Scan for nearest enemy target
            let immediateEnemy = null;
            if (bot.ignoreTargetTimer <= 0) {
                immediateEnemy = this.findNearestEnemy(bot, players, bots, room.gameMode);
            }

            let target = null;
            let inActiveCombat = false;

            // If there is an enemy, evaluate if we can engage or if it is behind walls
            if (immediateEnemy) {
                const distToEnemy = Math.hypot(immediateEnemy.x - bot.x, immediateEnemy.y - bot.y);
                if (distToEnemy < 400) {
                    target = immediateEnemy;
                    inActiveCombat = true;
                } else {
                    // Check Line of Sight (LOS) for distant enemies
                    let hasLOS = true;
                    for (const obs of room.obstacles) {
                        if (Physics.checkLineRectIntersection(bot.x, bot.y, immediateEnemy.x, immediateEnemy.y, obs.x, obs.y, obs.w, obs.h)) {
                            hasLOS = false;
                            break;
                        }
                    }
                    if (!hasLOS) {
                        // Only ignore far enemies without LOS on large survival maps (mapWidth > 3000)
                        // In small arena matches (mapWidth <= 3000), bots should always engage and seek enemies!
                        const isSurvivalMap = room.mapWidth > 3000;
                        if (isSurvivalMap) {
                            immediateEnemy = null;
                        }
                    }
                }
            }

            const isNightmare = bot.difficulty === 'nightmare';
            const hpPercent = bot.hp / bot.maxHp;
            const shieldPercent = bot.maxShield > 0 ? (bot.shield / bot.maxShield) : 1.0;
            const needEmergencyHeal = isNightmare && (hpPercent < 0.45 || shieldPercent < 0.3);

            // 2. Only loot or seek items/healing if not in active close combat
            if (!inActiveCombat) {
                let chosenItem = null;
                if (room.items && room.items.length > 0) {
                    let itemScanRadius = 150;
                    if (bot.difficulty === 'medium') itemScanRadius = 300;
                    else if (bot.difficulty === 'hard' || bot.difficulty === 'expert') itemScanRadius = 500;
                    else if (isNightmare) itemScanRadius = 600;

                    // Priority A: Low HP/Shield -> Look for heal / shield
                    if (hpPercent < 0.6 || shieldPercent < 0.5 || needEmergencyHeal) {
                        let minHealingDist = itemScanRadius;
                        for (const item of room.items) {
                            if (item.type === 'heal' || item.type === 'shield') {
                                const dist = Math.hypot(item.x - bot.x, item.y - bot.y);
                                if (dist < minHealingDist) {
                                    minHealingDist = dist;
                                    chosenItem = item;
                                }
                            }
                        }
                    }

                    // Priority B: Medium or higher difficulty -> Loot any buff
                    if (!chosenItem && bot.difficulty !== 'easy') {
                        let minBuffDist = itemScanRadius;
                        for (const item of room.items) {
                            const dist = Math.hypot(item.x - bot.x, item.y - bot.y);
                            if (dist < minBuffDist) {
                                minBuffDist = dist;
                                chosenItem = item;
                            }
                        }
                    }

                    if (chosenItem) {
                        target = {
                            x: chosenItem.x,
                            y: chosenItem.y,
                            isItem: true
                        };
                    }
                }

                // 3. Target wooden crates or large airdrops to farm items/buffs if no ready items
                if (!target && room.crates.length > 0) {
                    let chosenCrate = null;
                    let maxCrateScore = -1;
                    const scanRange = isNightmare ? 600 : 350;

                    for (const crate of room.crates) {
                        const dist = Math.hypot(crate.x + 20 - bot.x, crate.y + 20 - bot.y);
                        if (dist < scanRange) {
                            // Priority score: large airdrops get +1000 weight, closer gets higher score
                            const score = (crate.isLarge ? 1000 : 0) + (scanRange - dist);
                            if (score > maxCrateScore) {
                                maxCrateScore = score;
                                chosenCrate = crate;
                            }
                        }
                    }

                    if (chosenCrate) {
                        target = {
                            x: chosenCrate.x + 20,
                            y: chosenCrate.y + 20,
                            isDummy: true
                        };
                    }
                }

                // 4. Fallback: If no items/crates nearby, engage the distant enemy (if any)
                if (!target && immediateEnemy) {
                    target = immediateEnemy;
                }
            }

            if (!target) {
                if (!forceMoveToZone) {
                    this.patrol(bot, deltaTime, room);
                }
            } else if (target.isItem) {
                // Move towards item to collect
                let angle = Math.atan2(target.y - bot.y, target.x - bot.x);
                if (bot.avoidTimer > 0) {
                    angle += bot.avoidDirection * (Math.PI / 2);
                }
                bot.angle = angle;

                if (!forceMoveToZone) {
                    const moveSpeed = bot.speed * (bot.speedMultiplier || 1.0) * deltaTime;
                    bot.x += Math.cos(angle) * moveSpeed;
                    bot.y += Math.sin(angle) * moveSpeed;
                    Physics.constrainToMap(bot, room.mapWidth, room.mapHeight);
                    obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(bot, obs));
                }
            } else if (target.isDummy) {
                // Shoot the crate
                bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x);
                if (!bot.isReloading && bot.shootCooldownTimer <= 0) {
                    if (bot.ammo > 0) {
                        room.spawnBullet(bot, bot.angle);
                        bot.ammo--;
                        bot.shootCooldownTimer = bot.weaponStats.fireRate;
                    } else {
                        bot.isReloading = true;
                        let reloadMultiplier = bot.perk === 'faster_reload' ? 0.5 : 1.0;
                        bot.reloadTimer = bot.weaponStats.reloadTime * reloadMultiplier;
                    }
                }
                // Step closer to loot the crate buffs
                const distToCrate = Math.hypot(target.x - bot.x, target.y - bot.y);
                if (distToCrate > 40 && !forceMoveToZone) {
                    let angle = Math.atan2(target.y - bot.y, target.x - bot.x);
                    if (bot.avoidTimer > 0) {
                        angle += bot.avoidDirection * (Math.PI / 2);
                    }
                    const moveSpeed = bot.speed * (bot.speedMultiplier || 1.0) * deltaTime;
                    bot.x += Math.cos(angle) * moveSpeed;
                    bot.y += Math.sin(angle) * moveSpeed;
                    Physics.constrainToMap(bot, room.mapWidth, room.mapHeight);
                    obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(bot, obs));
                }
            } else {
                this.handleAimAndShoot(bot, target, room, deltaTime);
                if (!forceMoveToZone) {
                    // Avoidance injected directly into movement handler if avoiding
                    this.handleMovement(bot, target, bullets, obstacles, deltaTime, room);
                }
            }

            // 4. Stuck prevention check (Obstacle Avoidance)
            // If bot attempted to move but position barely changed, increment stuck counters
            const isMoving = forceMoveToZone || (target && !target.isItem && !target.isDummy) || (target && target.isItem) || (!target);
            if (isMoving && bot.dashDurationTimer <= 0) {
                const distMoved = Math.hypot(bot.x - startX, bot.y - startY);
                if (distMoved < 0.5) {
                    bot.stuckTicks++;
                    bot.stuckDuration += deltaTime;
                    
                    // Critical stuck: stuck for more than 3 seconds
                    if (bot.stuckDuration >= 3.0) {
                        bot.avoidDirection = Math.random() < 0.5 ? 1 : -1;
                        bot.avoidTimer = 2.0;            // Try to move away for 2 seconds
                        bot.ignoreTargetTimer = 2.5;     // Ignore enemies to focus on escaping
                        bot.patrolTarget = null;         // Reroute patrol path
                        bot.stuckDuration = 0;
                        bot.stuckTicks = 0;
                    } 
                    // Soft stuck: nightmare bots react in 3 ticks (~0.1s), others react in 12 ticks (~0.4s)
                    else {
                        const stuckLimit = isNightmare ? 3 : 12;
                        if (bot.stuckTicks > stuckLimit && bot.avoidTimer <= 0) {
                            bot.avoidDirection = Math.random() < 0.5 ? 1 : -1;
                            bot.avoidTimer = isNightmare ? 1.2 : 0.8;
                            bot.stuckTicks = 0;
                        }
                    }
                } else {
                    bot.stuckTicks = 0;
                    bot.stuckDuration = 0;
                }
            } else {
                bot.stuckTicks = 0;
                bot.stuckDuration = 0;
            }
        });
    }

    /**
     * Find nearest alive enemy based on game mode.
     */
    static findNearestEnemy(bot, players, bots, gameMode) {
        let nearestEnemy = null;
        let minDist = Infinity;

        const checkEnemy = (other) => {
            if (other.id === bot.id || other.hp <= 0) return;
            
            // Check team
            if (gameMode === 'team' || gameMode === 'coop' || gameMode === 'survival_team') {
                if (other.team === bot.team) return; // Ignore teammates
            } else if (gameMode === 'vs_bot') {
                // In Player vs Bot, bots are always on 'red' team and players on 'blue'
                if (other.team === bot.team) return;
            }

            const dx = other.x - bot.x;
            const dy = other.y - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearestEnemy = other;
            }
        };

        players.forEach(checkEnemy);
        bots.forEach(checkEnemy);

        return nearestEnemy;
    }

    /**
     * Patrol behavior when no enemies are found.
     */
    static patrol(bot, deltaTime, room) {
        if (!bot.patrolTarget || Math.hypot(bot.patrolTarget.x - bot.x, bot.patrolTarget.y - bot.y) < 30) {
            bot.patrolTarget = {
                x: Math.random() * (room.mapWidth - 100) + 50,
                y: Math.random() * (room.mapHeight - 100) + 50
            };
        }

        let angle = Math.atan2(bot.patrolTarget.y - bot.y, bot.patrolTarget.x - bot.x);
        
        // Apply obstacle avoidance detour if avoiding
        if (bot.avoidTimer > 0) {
            angle += bot.avoidDirection * (Math.PI / 2);
        }
        
        const speed = bot.speed * 0.5; // Patrol slowly

        bot.x += Math.cos(angle) * speed * deltaTime;
        bot.y += Math.sin(angle) * speed * deltaTime;
        bot.angle = angle; // Look in direction of patrol

        Physics.constrainToMap(bot, room.mapWidth, room.mapHeight);
        room.obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(bot, obs));
    }

    /**
     * Aim at target and trigger shooting.
     */
    static handleAimAndShoot(bot, target, room, deltaTime) {
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;
        const dist = Math.hypot(dx, dy);

        // Aim angle
        let targetAngle = Math.atan2(dy, dx);

        // Add lead prediction for Advanced bots
        if (['hard', 'expert', 'nightmare'].includes(bot.difficulty)) {
            const bulletSpeed = bot.weaponStats.bulletSpeed;
            const travelTime = dist / bulletSpeed;
            // Target predicted position
            let targetVx = 0;
            let targetVy = 0;

            // Approximate velocity
            if (target.lastX !== undefined && target.lastY !== undefined) {
                targetVx = (target.x - target.lastX) / deltaTime;
                targetVy = (target.y - target.lastY) / deltaTime;
            }

            const predX = target.x + targetVx * travelTime;
            const predY = target.y + targetVy * travelTime;
            targetAngle = Math.atan2(predY - bot.y, predX - bot.x);
        }

        // Apply inaccuracy based on difficulty
        let error = 0;
        if (bot.difficulty === 'easy') {
            error = (Math.random() - 0.5) * 0.5; // ±14 degrees error
        } else if (bot.difficulty === 'medium') {
            error = (Math.random() - 0.5) * 0.2; // ±6 degrees error
        } else {
            error = (Math.random() - 0.5) * 0.05; // ±1.5 degrees error
        }

        bot.angle = targetAngle + error;

        // Shoot if ammo is available and not reloading
        if (bot.isReloading) return;

        if (bot.ammo <= 0) {
            bot.isReloading = true;
            // Perk effect on reload time
            let reloadMultiplier = bot.perk === 'faster_reload' ? 0.5 : 1.0;
            bot.reloadTimer = bot.weaponStats.reloadTime * reloadMultiplier;
            return;
        }

        if (bot.shootCooldownTimer <= 0 && dist < bot.weaponStats.range) {
            // Shoot weapon
            room.spawnBullet(bot, bot.angle);
            bot.ammo--;

            // Extra difficulty cooldown penalties (easy bot shoots slower)
            let difficultyCooldownMultiplier = 1.0;
            if (bot.difficulty === 'easy') difficultyCooldownMultiplier = 2.0;
            else if (bot.difficulty === 'medium') difficultyCooldownMultiplier = 1.3;

            bot.shootCooldownTimer = bot.weaponStats.fireRate * difficultyCooldownMultiplier;
        }
    }

    /**
     * Movement logic including chasing, distancing, and dodging.
     */
    static handleMovement(bot, target, bullets, obstacles, deltaTime, room) {
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;
        const dist = Math.hypot(dx, dy);

        let moveAngle = Math.atan2(dy, dx);
        let optimalDist = 200; // default spacing

        // Distance keeping based on weapon and difficulty
        const isAdvancedBot = ['hard', 'expert', 'nightmare'].includes(bot.difficulty);
        if (isAdvancedBot) {
            if (bot.gunType === 'sniper') {
                optimalDist = 450;
            } else if (bot.gunType === 'shotgun') {
                optimalDist = 80;
            } else if (bot.gunType === 'rifle') {
                optimalDist = 280;
            }
        }

        // Dodge logic for Medium and Advanced bots
        let isDodging = false;
        let dodgeDx = 0;
        let dodgeDy = 0;

        if (bot.difficulty !== 'easy') {
            // Scan incoming bullets
            for (let bullet of bullets) {
                // Only dodge opposing bullets
                if (bullet.ownerTeam === bot.team) continue;

                const bDx = bot.x - bullet.x;
                const bDy = bot.y - bullet.y;
                const bulletDist = Math.hypot(bDx, bDy);

                // Bullet is close
                const scanRange = isAdvancedBot ? 220 : 150;
                if (bulletDist < scanRange) {
                    // Check if bullet is heading towards the bot
                    const bVx = Math.cos(bullet.angle);
                    const bVy = Math.sin(bullet.angle);
                    
                    const bToBotX = bDx / bulletDist;
                    const bToBotY = bDy / bulletDist;

                    const dot = bVx * bToBotX + bVy * bToBotY;
                    if (dot > 0.8) { // Heading directly
                        isDodging = true;
                        dodgeDx += -bVy;
                        dodgeDy += bVx;
                    }
                }
            }
        }

        if (isDodging) {
            // Dodge angle
            moveAngle = Math.atan2(dodgeDy, dodgeDx);
            
            // Advanced bots can use Dash to dodge
            if (isAdvancedBot && bot.dashCooldownTimer <= 0) {
                bot.dashCooldownTimer = 3.0; // 3 seconds dash cooldown
                bot.dashDurationTimer = 0.2; // 200ms dash
                bot.dashAngle = moveAngle;
                bot.dashSpeed = bot.speed * (bot.speedMultiplier || 1.0) * 2.5;
                return; // Stop standard movement calculation, dash kicks in
            }
        } else {
            // Standard approach / retreat movement
            if (dist < optimalDist - 40) {
                // Too close, move back
                moveAngle = Math.atan2(-dy, -dx);
            } else if (dist > optimalDist + 40) {
                // Too far, approach
                moveAngle = Math.atan2(dy, dx);
            } else {
                // Strafe (move sideways) to look smart
                moveAngle = Math.atan2(dy, dx) + Math.PI / 2 * (bot.id % 2 === 0 ? 1 : -1);
            }
        }

        // Apply obstacle avoidance detour if avoiding during combat
        if (bot.avoidTimer > 0) {
            moveAngle += bot.avoidDirection * (Math.PI / 2);
        }

        // Apply movement
        const currentSpeed = bot.speed * (bot.speedMultiplier || 1.0);
        bot.x += Math.cos(moveAngle) * currentSpeed * deltaTime;
        bot.y += Math.sin(moveAngle) * currentSpeed * deltaTime;

        // Constrain and resolve obstacle collisions
        Physics.constrainToMap(bot, room.mapWidth, room.mapHeight);
        obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(bot, obs));
    }
}

module.exports = BotAI;
