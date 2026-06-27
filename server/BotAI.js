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

            // Update timers
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

            // 1. Scan for nearest enemy target
            const target = this.findNearestEnemy(bot, players, bots, room.gameMode);
            if (!target) {
                this.patrol(bot, deltaTime, room);
                return;
            }

            // 2. Aim and Shoot
            this.handleAimAndShoot(bot, target, room, deltaTime);

            // 3. Movement and Dodging
            this.handleMovement(bot, target, bullets, obstacles, deltaTime, room);
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
            if (gameMode === 'team' || gameMode === 'coop') {
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

        const angle = Math.atan2(bot.patrolTarget.y - bot.y, bot.patrolTarget.x - bot.x);
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

        // Add lead prediction for Hard bots
        if (bot.difficulty === 'hard') {
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
        if (bot.difficulty === 'hard') {
            if (bot.gunType === 'sniper') {
                optimalDist = 450;
            } else if (bot.gunType === 'shotgun') {
                optimalDist = 80;
            } else if (bot.gunType === 'rifle') {
                optimalDist = 280;
            }
        }

        // Dodge logic for Medium and Hard bots
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

                // Bullet is close (Medium: <150px, Hard: <220px)
                const scanRange = bot.difficulty === 'hard' ? 220 : 150;
                if (bulletDist < scanRange) {
                    // Check if bullet is heading towards the bot
                    // Bullet vector
                    const bVx = Math.cos(bullet.angle);
                    const bVy = Math.sin(bullet.angle);
                    
                    // Vector from bullet to bot
                    const bToBotX = bDx / bulletDist;
                    const bToBotY = bDy / bulletDist;

                    // Dot product
                    const dot = bVx * bToBotX + bVy * bToBotY;
                    if (dot > 0.8) { // Heading directly
                        isDodging = true;
                        // Move perpendicular to bullet direction
                        dodgeDx += -bVy;
                        dodgeDy += bVx;
                    }
                }
            }
        }

        if (isDodging) {
            // Dodge angle
            moveAngle = Math.atan2(dodgeDy, dodgeDx);
            
            // Hard bots can use Dash to dodge
            if (bot.difficulty === 'hard' && bot.dashCooldownTimer <= 0) {
                bot.dashCooldownTimer = 3.0; // 3 seconds dash cooldown
                bot.dashDurationTimer = 0.2; // 200ms dash
                bot.dashAngle = moveAngle;
                bot.dashSpeed = bot.speed * 2.5;
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

        // Apply movement
        const currentSpeed = bot.speed;
        bot.x += Math.cos(moveAngle) * currentSpeed * deltaTime;
        bot.y += Math.sin(moveAngle) * currentSpeed * deltaTime;

        // Constrain and resolve obstacle collisions
        Physics.constrainToMap(bot, room.mapWidth, room.mapHeight);
        obstacles.forEach(obs => Physics.resolvePlayerObstacleCollision(bot, obs));
    }
}

module.exports = BotAI;
