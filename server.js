// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const roomManager = require('./server/RoomManager');
const { bin } = require('cloudflared');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve client static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Global map to track active connections (wsId -> WebSocket connection)
const clients = new Map();
global.clients = clients;

// Clean up empty rooms every 30 seconds
setInterval(() => {
    roomManager.cleanupRooms();
}, 30000);

wss.on('connection', (ws) => {
    const wsId = crypto.randomBytes(8).toString('hex');
    clients.set(wsId, ws);
    console.log(`New connection: ${wsId}`);

    // Gửi gói tin welcome chứa ID kết nối của client
    ws.send(JSON.stringify({
        type: 'welcome',
        id: wsId
    }));

    let currentRoomCode = null;

    ws.on('message', (messageStr) => {
        try {
            const packet = JSON.parse(messageStr);
            
            switch (packet.type) {
                case 'get_lobby_list': {
                    const list = roomManager.getLobbyRooms();
                    ws.send(JSON.stringify({
                        type: 'lobby_list',
                        rooms: list
                    }));
                    break;
                }

                case 'create_room': {
                    const room = roomManager.createRoom(wsId, packet.config);
                    currentRoomCode = room.code;
                    room.addPlayer(wsId, packet.name, packet.loadout);
                    break;
                }

                case 'join_room': {
                    const code = packet.code ? packet.code.toUpperCase() : '';
                    const room = roomManager.getRoom(code);
                    if (!room) {
                        ws.send(JSON.stringify({
                            type: 'join_error',
                            message: 'Không tìm thấy phòng với mã này!'
                        }));
                        break;
                    }

                    if (room.state !== 'lobby') {
                        ws.send(JSON.stringify({
                            type: 'join_error',
                            message: 'Phòng đã bắt đầu trận đấu hoặc kết thúc!'
                        }));
                        break;
                    }

                    if (room.players.size >= room.maxPlayers) {
                        ws.send(JSON.stringify({
                            type: 'join_error',
                            message: 'Phòng đã đầy!'
                        }));
                        break;
                    }

                    currentRoomCode = room.code;
                    const success = room.addPlayer(wsId, packet.name, packet.loadout);
                    if (!success) {
                        ws.send(JSON.stringify({
                            type: 'join_error',
                            message: 'Không thể vào phòng!'
                        }));
                    }
                    break;
                }

                case 'update_loadout': {
                    if (currentRoomCode) {
                        const room = roomManager.getRoom(currentRoomCode);
                        if (room) {
                            room.updatePlayerLoadout(wsId, packet.loadout);
                        }
                    }
                    break;
                }

                case 'change_team': {
                    if (currentRoomCode) {
                        const room = roomManager.getRoom(currentRoomCode);
                        if (room) {
                            room.changePlayerTeam(wsId, packet.team);
                        }
                    }
                    break;
                }

                case 'start_game': {
                    if (currentRoomCode) {
                        const room = roomManager.getRoom(currentRoomCode);
                        if (room && room.hostId === wsId) {
                            room.startGame();
                        }
                    }
                    break;
                }

                case 'input': {
                    if (currentRoomCode) {
                        const room = roomManager.getRoom(currentRoomCode);
                        if (room) {
                            room.handlePlayerInput(wsId, packet.input);
                        }
                    }
                    break;
                }

                case 'leave_room': {
                    handleLeave();
                    break;
                }

                default:
                    console.log(`Unknown packet type: ${packet.type}`);
            }
        } catch (err) {
            console.error('Error handling message:', err);
        }
    });

    const handleLeave = () => {
        if (currentRoomCode) {
            const room = roomManager.getRoom(currentRoomCode);
            if (room) {
                const isHostLeaving = room.hostId === wsId;
                room.removePlayer(wsId);
                if (isHostLeaving) {
                    roomManager.deleteRoom(currentRoomCode);
                }
            }
            currentRoomCode = null;
        }
    };

    ws.on('close', () => {
        console.log(`Connection closed: ${wsId}`);
        handleLeave();
        clients.delete(wsId);
    });

    ws.on('error', (err) => {
        console.error(`WebSocket error on ${wsId}:`, err);
    });
});

function openFirewallPort() {
    if (process.platform === 'win32') {
        exec('netsh advfirewall firewall add rule name="2D Arena Shooter Port 3000" dir=in action=allow protocol=TCP localport=3000', (err, stdout, stderr) => {
            if (err) {
                console.log('Quyền hạn thông thường bị từ chối. Đang kích hoạt UAC để yêu cầu quyền Administrator mở cổng Firewall...');
                const command = `powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -WindowStyle Hidden -Command \\\"New-NetFirewallRule -DisplayName \\\\\\\"2D Arena Shooter Port 3000\\\\\\\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Force\\\"' -Verb RunAs"`;
                exec(command, (uacErr) => {
                    if (uacErr) {
                        console.log('Lưu ý: Không thể tự động cấu hình Windows Firewall (UAC bị từ chối).');
                        console.log('Nếu máy LAN không kết nối được, hãy tự mở cổng 3000 thủ công.');
                    } else {
                        console.log('Đã gửi yêu cầu cấu hình Windows Firewall. Vui lòng nhấn "Yes" trên popup UAC nếu có.');
                    }
                });
            } else {
                console.log('Đã tự động cấu hình Windows Firewall mở cổng 3000 cho các máy khác kết nối.');
            }
        });
    }
}

let tunnelProcess = null;

async function startTunnel() {
    try {
        console.log('Đang khởi tạo Cloudflare Tunnel kết nối Internet công cộng...');
        tunnelProcess = spawn(bin, ['tunnel', '--url', `http://localhost:${PORT}`]);
        
        tunnelProcess.stderr.on('data', (data) => {
            const output = data.toString();
            const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match) {
                const url = match[0];
                console.log(`=============================================`);
                console.log(`  PUBLIC INTERNET LINK:`);
                console.log(`  ${url}`);
                console.log(`  Chia sẻ liên kết trên để người ngoài Internet chơi cùng!`);
                console.log(`  (Người chơi click vào link sẽ vào thẳng game trực tiếp)`);
                console.log(`=============================================`);
            }
        });

        tunnelProcess.on('close', (code) => {
            console.log(`Cloudflare Tunnel đã đóng với mã code: ${code}`);
        });
    } catch (err) {
        console.log('Lưu ý: Không thể tạo public link qua Cloudflare Tunnel (lỗi kết nối hoặc server quá tải).');
    }
}

function closeFirewallPort() {
    if (tunnelProcess) {
        try {
            tunnelProcess.kill();
        } catch (e) {}
    }
    if (process.platform === 'win32') {
        console.log('\nĐang dừng server, tự động đóng cổng Windows Firewall để bảo mật...');
        exec('netsh advfirewall firewall delete rule name="2D Arena Shooter Port 3000"', (err, stdout, stderr) => {
            if (err) {
                const command = `powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -WindowStyle Hidden -Command \\\"Remove-NetFirewallRule -DisplayName \\\\\\\"2D Arena Shooter Port 3000\\\\\\\"\\\"' -Verb RunAs"`;
                exec(command, () => {
                    process.exit(0);
                });
            } else {
                console.log('Đã cấu hình Windows Firewall đóng cổng 3000 thành công.');
                process.exit(0);
            }
        });
    } else {
        process.exit(0);
    }
}

// Lắng nghe tín hiệu tắt tiến trình để đóng firewall bảo mật
process.on('SIGINT', closeFirewallPort);
process.on('SIGTERM', closeFirewallPort);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`=============================================`);
    console.log(`  2D Arena Shooter server running on:`);
    console.log(`  LAN:     http://0.0.0.0:${PORT}`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`=============================================`);
    openFirewallPort();
    startTunnel();
});
