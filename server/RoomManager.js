// server/RoomManager.js
const GameRoom = require('./GameRoom');

class RoomManager {
    constructor() {
        this.rooms = new Map(); // code -> GameRoom
    }

    /**
     * Generate a unique 4-character room code.
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        do {
            code = '';
            for (let i = 0; i < 4; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.rooms.has(code));
        return code;
    }

    /**
     * Create a new game room.
     */
    createRoom(hostId, config) {
        const code = this.generateRoomCode();
        const room = new GameRoom(code, hostId, config);
        this.rooms.set(code, room);
        console.log(`Room created: ${code} by host ${hostId}`);
        return room;
    }

    /**
     * Get an existing room.
     */
    getRoom(code) {
        return this.rooms.get(code.toUpperCase());
    }

    /**
     * Delete a room immediately (e.g. host leaves).
     */
    deleteRoom(code) {
        const key = code.toUpperCase();
        const room = this.rooms.get(key);
        if (room) {
            room.destroy();
            this.rooms.delete(key);
            console.log(`Room deleted immediately: ${key}`);
        }
    }

    /**
     * Get all active rooms waiting for players (lobby mode).
     */
    getLobbyRooms() {
        const list = [];
        this.rooms.forEach((room, code) => {
            if (room.state === 'lobby') {
                list.push({
                    code: code,
                    playersCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    gameMode: room.gameMode,
                    botDifficulty: room.botDifficulty
                });
            }
        });
        return list;
    }

    /**
     * Clean up empty rooms.
     */
    cleanupRooms() {
        this.rooms.forEach((room, code) => {
            if (room.players.size === 0) {
                room.destroy();
                this.rooms.delete(code);
                console.log(`Room cleaned up: ${code}`);
            }
        });
    }
}

module.exports = new RoomManager();
