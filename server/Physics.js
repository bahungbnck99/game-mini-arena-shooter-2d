// server/Physics.js

/**
 * Check if a circle intersects with a rectangle.
 */
function checkCircleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
    // Find the closest point on the rectangle to the circle's center
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));

    // Calculate the distance between the circle's center and this closest point
    const distanceX = cx - closestX;
    const distanceY = cy - closestY;

    // If the distance is less than the circle's radius, an intersection occurs
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (radius * radius);
}

/**
 * Handle collision between player (circle) and a rectangle obstacle.
 * Resolves collision by pushing the player back out.
 */
function resolvePlayerObstacleCollision(player, obstacle) {
    const rx = obstacle.x;
    const ry = obstacle.y;
    const rw = obstacle.w;
    const rh = obstacle.h;

    // Closest point on obstacle to player center
    const closestX = Math.max(rx, Math.min(player.x, rx + rw));
    const closestY = Math.max(ry, Math.min(player.y, ry + rh));

    const dx = player.x - closestX;
    const dy = player.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return; // Inside, shouldn't normally happen

    if (distance < player.radius) {
        const overlap = player.radius - distance;
        // Push the player away from the closest point
        player.x += (dx / distance) * overlap;
        player.y += (dy / distance) * overlap;
    }
}

/**
 * Check if two circles collide.
 */
function checkCircleCircleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const distSq = dx * dx + dy * dy;
    const minDist = r1 + r2;
    return distSq < minDist * minDist;
}

/**
 * Keep player/bot within the map boundary.
 */
function constrainToMap(entity, mapWidth, mapHeight) {
    if (entity.x - entity.radius < 0) entity.x = entity.radius;
    if (entity.x + entity.radius > mapWidth) entity.x = mapWidth - entity.radius;
    if (entity.y - entity.radius < 0) entity.y = entity.radius;
    if (entity.y + entity.radius > mapHeight) entity.y = mapHeight - entity.radius;
}

module.exports = {
    checkCircleRectCollision,
    resolvePlayerObstacleCollision,
    checkCircleCircleCollision,
    constrainToMap
};
