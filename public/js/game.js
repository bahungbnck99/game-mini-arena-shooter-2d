// public/js/game.js

// Game State variables
let socket = null;
let myId = null;
let currentRoomCode = null;
let isHost = false;
let gameActive = false;
let myPlayerState = null;

// Map & obstacles configuration (received from server)
let mapWidth = 1200;
let mapHeight = 900;
let obstacles = [];

// Latency & FPS counter
let lastStateTime = Date.now();
let ping = 0;
let pingInterval = null;
let fps = 0;
let lastFpsTime = Date.now();
let framesThisSecond = 0;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Local visual effects (particles)
let particles = [];

// Selected loadout config
const loadout = {
    name: '',
    skin: 'default',
    accessory: 'none',
    gunType: 'rifle',
    perk: 'none'
};

// Input state tracking
const inputState = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false,
    r: false,
    shooting: false,
    mouseAngle: 0
};

// DOM Cache
const screens = {
    menu: document.getElementById('mainMenuScreen'),
    lobby: document.getElementById('roomLobbyScreen'),
    game: document.getElementById('gameScreen')
};

const UI = {
    playerNameInput: document.getElementById('playerNameInput'),
    roomCodeInput: document.getElementById('roomCodeInput'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    roomListContainer: document.getElementById('roomListContainer'),
    gameModeSelect: document.getElementById('gameModeSelect'),
    botDifficultySelect: document.getElementById('botDifficultySelect'),
    
    // Lobby Screen DOMs
    lobbyRoomInfoText: document.getElementById('lobbyRoomInfoText'),
    lobbyRoomCodeDisplay: document.getElementById('lobbyRoomCodeDisplay'),
    lobbyPlayersList: document.getElementById('lobbyPlayersList'),
    lobbyStartBtn: document.getElementById('lobbyStartBtn'),
    lobbyLeaveBtn: document.getElementById('lobbyLeaveBtn'),
    
    // Game Screen DOMs
    hudHpText: document.getElementById('hudHpText'),
    hudHpFill: document.getElementById('hudHpFill'),
    hudShieldContainer: document.getElementById('hudShieldContainer'),
    hudShieldText: document.getElementById('hudShieldText'),
    hudShieldFill: document.getElementById('hudShieldFill'),
    hudWeaponName: document.getElementById('hudWeaponName'),
    hudAmmoCurrent: document.getElementById('hudAmmoCurrent'),
    hudAmmoMax: document.getElementById('hudAmmoMax'),
    hudDashIndicator: document.getElementById('hudDashIndicator'),
    hudRoomCodeDisplay: document.getElementById('hudRoomCodeDisplay'),
    hudRoomModeDisplay: document.getElementById('hudRoomModeDisplay'),
    hudLatencyDisplay: document.getElementById('hudLatencyDisplay'),
    leaderboardList: document.getElementById('leaderboardList'),
    hudKillfeed: document.getElementById('hudKillfeed'),
    hudDeathOverlay: document.getElementById('hudDeathOverlay'),
    deathKillerText: document.getElementById('deathKillerText'),
    respawnTimerCount: document.getElementById('respawnTimerCount'),
    
    // Audio button
    audioToggle: document.getElementById('audioToggle'),
    audioIcon: document.getElementById('audioIcon'),
    audioText: document.getElementById('audioText'),
    
    // Exit game button
    exitGameBtn: document.getElementById('exitGameBtn'),

    // Bot count elements
    botCountInputGroup: document.getElementById('botCountInputGroup'),
    botCountInput: document.getElementById('botCountInput'),
    botCountHelperText: document.getElementById('botCountHelperText'),
    maxPlayersSelect: document.getElementById('maxPlayersSelect'),
    maxPlayersInputGroup: document.getElementById('maxPlayersInputGroup'),

    // Match timer & game over elements
    matchDurationSelect: document.getElementById('matchDurationSelect'),
    hudTimer: document.getElementById('hudTimer'),
    hudGameOverOverlay: document.getElementById('hudGameOverOverlay'),
    goResultTitle: document.getElementById('goResultTitle'),
    goScoreDetail: document.getElementById('goScoreDetail'),
    goLeaderboard: document.getElementById('goLeaderboard'),
    goBackBtn: document.getElementById('goBackBtn'),
    goMvpContainer: document.getElementById('goMvpContainer'),
    goTeamsScoreboard: document.getElementById('goTeamsScoreboard'),
    goBlueTeamList: document.getElementById('goBlueTeamList'),
    goRedTeamList: document.getElementById('goRedTeamList'),
    goSingleScoreboard: document.getElementById('goSingleScoreboard'),
    lobbyWaitWarning: document.getElementById('lobbyWaitWarning'),
    lobbyTeamSelectArea: document.getElementById('lobbyTeamSelectArea'),
    lobbySelectBlueBtn: document.getElementById('lobbySelectBlueBtn'),
    lobbySelectRedBtn: document.getElementById('lobbySelectRedBtn')
};

// Weapon Stats definitions for Loadout UI UI Bars
const WEAPON_STATS = {
    pistol:  { damage: 30, fireRate: 35, speed: 50, ammo: 40 },
    smg:     { damage: 15, fireRate: 95, speed: 65, ammo: 100 },
    rifle:   { damage: 45, fireRate: 75, speed: 75, ammo: 80 },
    shotgun: { damage: 70, fireRate: 20, speed: 45, ammo: 20 },
    sniper:  { damage: 100, fireRate: 5,  speed: 100, ammo: 20 }
};

// Skin Colors definitions
const SKIN_COLORS = {
    default: '#00f0ff',
    scout: '#39ff14',
    heavy: '#ff6600',
    tactical: '#a0a0a0',
    neon: '#ff007f'
};

// Team Colors
const TEAM_COLORS = {
    blue: '#00ccff',
    red: '#ff3366',
    none: '#ffffff'
};

// Initialize WebSocket connection
function initSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('Connected to server');
        // Fetch room list immediately on connect
        getLobbyRooms();
    };

    socket.onmessage = (event) => {
        const packet = JSON.parse(event.data);
        handleServerPacket(packet);
    };

    socket.onclose = () => {
        console.log('Disconnected from server');
        alert('Mất kết nối tới server. Vui lòng tải lại trang!');
        showScreen('menu');
        gameActive = false;
        if (pingInterval) clearInterval(pingInterval);
    };

    socket.onerror = (err) => {
        console.error('Socket error:', err);
    };
}

// Show specific screen state
function showScreen(screenKey) {
    Object.keys(screens).forEach(key => {
        if (key === screenKey) {
            screens[key].classList.remove('hidden');
        } else {
            screens[key].classList.add('hidden');
        }
    });

    // Control Exit game button visibility
    if (screenKey === 'game') {
        UI.exitGameBtn.classList.remove('hidden');
    } else {
        UI.exitGameBtn.classList.add('hidden');
        UI.hudGameOverOverlay.classList.add('hidden');
    }
}

// Request lobby list from server
function getLobbyRooms() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'get_lobby_list' }));
    }
}

// Set up UI inputs and customizer interactions
function setupUI() {
    // Randomize name initially
    UI.playerNameInput.value = 'Player_' + Math.floor(Math.random() * 9000 + 1000);
    loadout.name = UI.playerNameInput.value;

    // Listen name change
    UI.playerNameInput.addEventListener('change', () => {
        loadout.name = UI.playerNameInput.value.trim() || 'NoName';
        saveLoadoutToLocal();
        syncLoadoutToServer();
    });

    // Customizer tabs switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            const contentId = btn.getAttribute('data-tab');
            document.getElementById(contentId).classList.remove('hidden');
        });
    });

    // Select options (cards)
    const selectCards = document.querySelectorAll('.select-card');
    selectCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-type');
            const value = card.getAttribute('data-value');

            // De-select siblings
            document.querySelectorAll(`.select-card[data-type="${type}"]`).forEach(c => c.classList.remove('selected', 'selected-pink'));

            // Select current
            const selectClass = type === 'skin' || type === 'accessory' ? 'selected-pink' : 'selected';
            card.classList.add(selectClass);

            // Update loadout
            loadout[type] = value;
            saveLoadoutToLocal();
            syncLoadoutToServer();

            // If gun type, update UI stats bars
            if (type === 'gunType') {
                updateWeaponStatsUI(value);
            }
        });
    });

    // Create Room action
    UI.createRoomBtn.addEventListener('click', () => {
        window.audioSystem.init(); // Play sounds must follow click event trigger
        const mode = UI.gameModeSelect.value;
        const difficulty = UI.botDifficultySelect.value;
        const botCount = parseInt(UI.botCountInput.value) || 4;
        const matchDuration = parseInt(UI.matchDurationSelect.value) || 120;
        const maxPlayers = parseInt(UI.maxPlayersSelect.value) || 4;
        
        socket.send(JSON.stringify({
            type: 'create_room',
            name: loadout.name,
            loadout: loadout,
            config: {
                gameMode: mode,
                botDifficulty: difficulty,
                botCount: botCount,
                matchDuration: matchDuration,
                maxPlayers: maxPlayers
            }
        }));
    });

    UI.goBackBtn.addEventListener('click', () => {
        socket.send(JSON.stringify({ type: 'leave_room' }));
        showScreen('menu');
        getLobbyRooms();
    });

    UI.lobbySelectBlueBtn.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'change_team', team: 'blue' }));
        }
    });

    UI.lobbySelectRedBtn.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'change_team', team: 'red' }));
        }
    });

    // Listen game mode select to show/hide bot count & max players settings
    const handleGameModeChange = () => {
        const mode = UI.gameModeSelect.value;
        if (mode === 'vs_bot' || mode === 'coop') {
            UI.botCountInputGroup.style.display = 'block';
            updateBotCountHelperText();
        } else {
            UI.botCountInputGroup.style.display = 'none';
        }

        if (mode === 'vs_bot') {
            UI.maxPlayersInputGroup.style.display = 'none';
        } else {
            UI.maxPlayersInputGroup.style.display = 'block';
        }
    };

    const updateBotCountHelperText = () => {
        const mode = UI.gameModeSelect.value;
        const n = parseInt(UI.botCountInput.value) || 4;
        if (mode === 'vs_bot') {
            UI.botCountHelperText.textContent = `Đấu Solo: Bạn sẽ đối đầu với ${n} Bot đối thủ.`;
        } else if (mode === 'coop') {
            UI.botCountHelperText.textContent = `Co-op: Phe địch có ${n} Bot. Phe ta sẽ có bạn + ${Math.max(0, n - 1)} Bot đồng đội.`;
        }
    };

    UI.gameModeSelect.addEventListener('change', handleGameModeChange);
    UI.botCountInput.addEventListener('input', updateBotCountHelperText);
    
    // Initial trigger
    handleGameModeChange();

    // Join Room action
    UI.joinRoomBtn.addEventListener('click', () => {
        window.audioSystem.init();
        const code = UI.roomCodeInput.value.trim().toUpperCase();
        if (code.length !== 4) {
            alert('Mã phòng phải gồm 4 ký tự!');
            return;
        }

        socket.send(JSON.stringify({
            type: 'join_room',
            code: code,
            name: loadout.name,
            loadout: loadout
        }));
    });

    // Lobby buttons
    UI.lobbyStartBtn.addEventListener('click', () => {
        socket.send(JSON.stringify({ type: 'start_game' }));
    });

    UI.lobbyLeaveBtn.addEventListener('click', () => {
        socket.send(JSON.stringify({ type: 'leave_room' }));
        showScreen('menu');
        getLobbyRooms();
    });

    UI.exitGameBtn.addEventListener('click', () => {
        socket.send(JSON.stringify({ type: 'leave_room' }));
        gameActive = false;
        if (pingInterval) clearInterval(pingInterval);
        showScreen('menu');
        getLobbyRooms();
    });

    // Audio toggle
    UI.audioToggle.addEventListener('click', () => {
        const isMuted = window.audioSystem.toggleMute();
        if (isMuted) {
            UI.audioIcon.textContent = '🔇';
            UI.audioText.textContent = 'Tắt âm thanh';
            UI.audioToggle.style.borderColor = 'rgba(255,255,255,0.1)';
        } else {
            UI.audioIcon.textContent = '🔊';
            UI.audioText.textContent = 'Bật âm thanh';
            UI.audioToggle.style.borderColor = 'var(--cyber-cyan)';
            window.audioSystem.playGameStart();
        }
    });

    // Initialize weapon stats display
    updateWeaponStatsUI('rifle');
    loadLocalLoadout();

    // Resize canvas
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Periodically fetch room list every 5 seconds when in menu
    setInterval(() => {
        if (screens.menu.classList.contains('hidden') === false) {
            getLobbyRooms();
        }
    }, 5000);
}

// Save selected loadout to localStorage
function saveLoadoutToLocal() {
    localStorage.setItem('arena_shooter_loadout', JSON.stringify(loadout));
}

// Load previous loadout from localStorage
function loadLocalLoadout() {
    const saved = localStorage.getItem('arena_shooter_loadout');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            Object.assign(loadout, data);
            
            // Re-apply to UI selection cards
            Object.keys(loadout).forEach(key => {
                if (key === 'name') {
                    UI.playerNameInput.value = loadout.name;
                    return;
                }
                const card = document.querySelector(`.select-card[data-type="${key}"][data-value="${loadout[key]}"]`);
                if (card) {
                    document.querySelectorAll(`.select-card[data-type="${key}"]`).forEach(c => c.classList.remove('selected', 'selected-pink'));
                    const selectClass = key === 'skin' || key === 'accessory' ? 'selected-pink' : 'selected';
                    card.classList.add(selectClass);
                }
            });

            updateWeaponStatsUI(loadout.gunType);
        } catch (e) {
            console.error('Error loading local loadout', e);
        }
    }
}

// Sync current loadout to server if in lobby
function syncLoadoutToServer() {
    if (socket && socket.readyState === WebSocket.OPEN && currentRoomCode) {
        socket.send(JSON.stringify({
            type: 'update_loadout',
            loadout: loadout
        }));
    }
}

// Update the loadout preview bar graphs
function updateWeaponStatsUI(gunType) {
    const stats = WEAPON_STATS[gunType];
    if (stats) {
        document.getElementById('stat-damage').style.width = stats.damage + '%';
        document.getElementById('stat-firerate').style.width = stats.fireRate + '%';
        document.getElementById('stat-speed').style.width = stats.speed + '%';
        document.getElementById('stat-ammo').style.width = stats.ammo + '%';
    }
}

// Resize canvas elements dynamically
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Handle packets received from the server
function handleServerPacket(packet) {
    switch (packet.type) {
        case 'welcome': {
            myId = packet.id;
            console.log('Welcome! My client ID is:', myId);
            break;
        }

        case 'room_closed': {
            alert(packet.message);
            gameActive = false;
            if (pingInterval) clearInterval(pingInterval);
            showScreen('menu');
            getLobbyRooms();
            break;
        }

        case 'lobby_list': {
            renderLobbyList(packet.rooms);
            break;
        }

        case 'join_error': {
            alert(packet.message);
            break;
        }

        case 'lobby_update': {
            currentRoomCode = packet.code;
            showScreen('lobby');
            UI.lobbyRoomCodeDisplay.textContent = currentRoomCode;
            
            // Set text mode
            let modeViet = 'Người vs Bot (Solo)';
            if (packet.gameMode === 'coop') modeViet = 'Người + Bot phe ta vs Bot địch';
            else if (packet.gameMode === 'pvp') modeViet = 'Người vs Người (FFA)';
            else if (packet.gameMode === 'team') modeViet = 'Team Battle (Xanh vs Đỏ)';
            
            let diffViet = packet.botDifficulty === 'easy' ? 'Dễ' : packet.botDifficulty === 'medium' ? 'Vừa' : 'Khó';
            UI.lobbyRoomInfoText.textContent = `Chế độ: ${modeViet} | Độ khó Bot: ${diffViet}`;

            // Render players
            renderLobbyPlayers(packet.players, packet.hostId);

            // Show/hide team selector based on mode
            if (packet.gameMode === 'team') {
                UI.lobbyTeamSelectArea.style.display = 'block';
                const myPlayerObj = packet.players.find(p => isMySocket(p.id));
                if (myPlayerObj) {
                    if (myPlayerObj.team === 'blue') {
                        UI.lobbySelectBlueBtn.className = 'cyber-btn lobby-btn-blue-active';
                        UI.lobbySelectRedBtn.className = 'cyber-btn lobby-btn-red-inactive';
                    } else if (myPlayerObj.team === 'red') {
                        UI.lobbySelectBlueBtn.className = 'cyber-btn lobby-btn-blue-inactive';
                        UI.lobbySelectRedBtn.className = 'cyber-btn lobby-btn-red-active';
                    }
                }
            } else {
                UI.lobbyTeamSelectArea.style.display = 'none';
            }

            // Show start button only to host when condition met
            const myPlayerObj = packet.players.find(p => isMySocket(p.id));
            const isMeHost = myPlayerObj && myPlayerObj.isHost;
            const isMultiplayer = packet.gameMode === 'pvp' || packet.gameMode === 'team';
            const playerCount = packet.players.length;

            if (isMeHost) {
                if (isMultiplayer && playerCount < 2) {
                    // Hide start button, show wait warning
                    UI.lobbyStartBtn.style.display = 'none';
                    UI.lobbyWaitWarning.style.display = 'block';
                } else {
                    // Show start button, hide wait warning
                    UI.lobbyStartBtn.style.display = 'block';
                    UI.lobbyWaitWarning.style.display = 'none';
                }
            } else {
                UI.lobbyStartBtn.style.display = 'none';
                UI.lobbyWaitWarning.style.display = 'none';
            }
            break;
        }

        case 'game_start': {
            gameActive = true;
            mapWidth = packet.mapWidth;
            mapHeight = packet.mapHeight;
            obstacles = packet.obstacles;
            
            showScreen('game');
            UI.hudGameOverOverlay.classList.add('hidden'); // Reset overlay
            window.audioSystem.playGameStart();

            // Set HUD room info
            UI.hudRoomCodeDisplay.textContent = currentRoomCode;
            
            // Setup latency heartbeats
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(() => {
                if (gameActive && socket.readyState === WebSocket.OPEN) {
                    lastStateTime = Date.now();
                    socket.send(JSON.stringify({ type: 'input', input: inputState })); // Keep-alive / Sync
                }
            }, 1000);
            
            // Start main client draw loop
            requestAnimationFrame(drawLoop);
            break;
        }

        case 'game_over': {
            gameActive = false;
            if (pingInterval) clearInterval(pingInterval);
            
            // Show overlay
            UI.hudGameOverOverlay.classList.remove('hidden');
            
            // Determine Win/Loss/Draw
            let mode = latestGameState?.gameMode || 'vs_bot';
            let won = false;
            let isTeamMode = mode === 'team' || mode === 'coop' || mode === 'vs_bot';
            
            if (isTeamMode) {
                // Find my team
                let myTeam = myPlayerState?.team || 'blue';
                if (packet.winnerTeam === myTeam) {
                    won = true;
                    UI.goResultTitle.textContent = 'CHIẾN THẮNG';
                    UI.goResultTitle.style.color = 'var(--cyber-cyan)';
                    UI.goResultTitle.style.textShadow = 'var(--glow-cyan)';
                } else if (packet.winnerTeam === 'none') {
                    UI.goResultTitle.textContent = 'HÒA CỜ';
                    UI.goResultTitle.style.color = 'var(--cyber-yellow)';
                    UI.goResultTitle.style.textShadow = '0 0 10px rgba(255, 189, 3, 0.4)';
                } else {
                    UI.goResultTitle.textContent = 'THẤT BẠI';
                    UI.goResultTitle.style.color = 'var(--cyber-pink)';
                    UI.goResultTitle.style.textShadow = 'var(--glow-pink)';
                }
                UI.goScoreDetail.textContent = `Xanh (Blue) ${packet.blueScore} - ${packet.redScore} Đỏ (Red)`;

                // 1. Calculate MVPs
                const bluePlayers = packet.scoreboard.filter(p => p.team === 'blue');
                const redPlayers = packet.scoreboard.filter(p => p.team === 'red');
                
                let mvpBlue = null;
                if (bluePlayers.length > 0) {
                    mvpBlue = bluePlayers.reduce((best, cur) => {
                        if (cur.score > best.score) return cur;
                        if (cur.score === best.score && cur.deaths < best.deaths) return cur;
                        return best;
                    }, bluePlayers[0]);
                }
                
                let mvpRed = null;
                if (redPlayers.length > 0) {
                    mvpRed = redPlayers.reduce((best, cur) => {
                        if (cur.score > best.score) return cur;
                        if (cur.score === best.score && cur.deaths < best.deaths) return cur;
                        return best;
                    }, redPlayers[0]);
                }

                // 2. Render MVPs
                UI.goMvpContainer.style.display = 'flex';
                UI.goMvpContainer.innerHTML = '';
                if (mvpBlue) {
                    const mvpBlueDiv = document.createElement('div');
                    mvpBlueDiv.className = 'cyber-panel';
                    mvpBlueDiv.style.flex = '1';
                    mvpBlueDiv.style.borderColor = 'rgba(0, 204, 255, 0.4)';
                    mvpBlueDiv.style.background = 'rgba(0, 204, 255, 0.08)';
                    mvpBlueDiv.style.textAlign = 'center';
                    mvpBlueDiv.style.padding = '8px 12px';
                    mvpBlueDiv.innerHTML = `
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">👑 MVP Phe Xanh</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--cyber-cyan); text-shadow: var(--glow-cyan); margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${mvpBlue.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-primary);">${mvpBlue.score} K / ${mvpBlue.deaths} D</div>
                    `;
                    UI.goMvpContainer.appendChild(mvpBlueDiv);
                }
                if (mvpRed) {
                    const mvpRedDiv = document.createElement('div');
                    mvpRedDiv.className = 'cyber-panel';
                    mvpRedDiv.style.flex = '1';
                    mvpRedDiv.style.borderColor = 'rgba(255, 51, 102, 0.4)';
                    mvpRedDiv.style.background = 'rgba(255, 51, 102, 0.08)';
                    mvpRedDiv.style.textAlign = 'center';
                    mvpRedDiv.style.padding = '8px 12px';
                    mvpRedDiv.innerHTML = `
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">👑 MVP Phe Đỏ</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--cyber-pink); text-shadow: var(--glow-pink); margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${mvpRed.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-primary);">${mvpRed.score} K / ${mvpRed.deaths} D</div>
                    `;
                    UI.goMvpContainer.appendChild(mvpRedDiv);
                }

                // 3. Render Two-column Team Scores
                UI.goTeamsScoreboard.style.display = 'flex';
                UI.goSingleScoreboard.style.display = 'none';

                const renderTeamList = (listContainer, teamPlayers, mvpObj) => {
                    listContainer.innerHTML = '';
                    if (teamPlayers.length === 0) {
                        listContainer.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-size: 0.8rem;">Không có ai</div>';
                        return;
                    }
                    const sorted = [...teamPlayers].sort((a, b) => b.score - a.score || a.deaths - b.deaths);
                    sorted.forEach((ent, index) => {
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.justifyContent = 'space-between';
                        row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
                        row.style.padding = '4px 0';
                        
                        let label = `${index + 1}. `;
                        if (mvpObj && ent.id === mvpObj.id) {
                            label += '👑 ';
                        }
                        label += ent.name;
                        if (ent.isBot) label += ' (B)';
                        if (ent.id === myId) {
                            label += ' <span style="color: var(--cyber-yellow); font-size: 0.7rem;">(BẠN)</span>';
                            row.style.fontWeight = '800';
                            row.style.color = '#fff';
                        } else {
                            row.style.color = 'var(--text-primary)';
                        }

                        const kdRatio = ent.deaths === 0 ? ent.score : (ent.score / ent.deaths).toFixed(1);
                        
                        row.innerHTML = `
                            <span style="display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;">${label}</span>
                            <span style="font-size: 0.75rem; white-space: nowrap;">${ent.score}K/${ent.deaths}D (${kdRatio})</span>
                        `;
                        listContainer.appendChild(row);
                    });
                };

                renderTeamList(UI.goBlueTeamList, bluePlayers, mvpBlue);
                renderTeamList(UI.goRedTeamList, redPlayers, mvpRed);

            } else {
                // Free for all
                UI.goMvpContainer.style.display = 'none';
                UI.goTeamsScoreboard.style.display = 'none';
                UI.goSingleScoreboard.style.display = 'block';

                const firstPlace = packet.scoreboard[0];
                const isMeFirst = firstPlace && firstPlace.id === myId;
                if (isMeFirst) {
                    UI.goResultTitle.textContent = 'HẠNG 1 - CHIẾN THẮNG';
                    UI.goResultTitle.style.color = 'var(--cyber-cyan)';
                    UI.goResultTitle.style.textShadow = 'var(--glow-cyan)';
                } else {
                    UI.goResultTitle.textContent = 'THẤT BẠI';
                    UI.goResultTitle.style.color = 'var(--cyber-pink)';
                    UI.goResultTitle.style.textShadow = 'var(--glow-pink)';
                }
                const myRankIndex = packet.scoreboard.findIndex(e => e.id === myId);
                const myRank = myRankIndex !== -1 ? myRankIndex + 1 : packet.scoreboard.length;
                UI.goScoreDetail.textContent = `Bạn xếp hạng #${myRank} trên tổng số ${packet.scoreboard.length} đấu thủ`;

                // Fill single scoreboard
                UI.goLeaderboard.innerHTML = '';
                packet.scoreboard.slice(0, 5).forEach((ent, index) => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    row.style.padding = '4px 0';
                    if (ent.id === myId) {
                        row.style.color = 'var(--cyber-cyan)';
                        row.style.fontWeight = '800';
                    }
                    
                    let name = ent.name;
                    if (ent.isBot) name += ' (BOT)';
                    if (index === 0) name = '👑 ' + name;
                    
                    const kdRatio = ent.deaths === 0 ? ent.score : (ent.score / ent.deaths).toFixed(1);

                    row.innerHTML = `
                        <span>${index + 1}. ${name}</span>
                        <span>${ent.score} K / ${ent.deaths} D (K/D: ${kdRatio})</span>
                    `;
                    UI.goLeaderboard.appendChild(row);
                });
            }
            break;
        }

        case 'game_state': {
            myPlayerState = packet.players.find(p => isMySocket(p.id));

            // Calculate latency (approximate round-trip)
            const latency = Date.now() - lastStateTime;
            if (latency < 200) {
                ping = Math.round(latency);
            }

            renderGame(packet);
            break;
        }

        case 'audio_trigger': {
            if (packet.action === 'shoot') {
                window.audioSystem.playShoot(packet.gunType);
            } else if (packet.action === 'hit') {
                window.audioSystem.playHit();
            }
            break;
        }

        case 'death_event': {
            window.audioSystem.playDeath();
            
            // Render local death explosion particles
            spawnDeathParticles(packet.x, packet.y, packet.team);
            
            // Insert into Killfeed
            triggerKillfeed(packet.killerName, packet.victimName);
            break;
        }
    }
}

// Temporary variable to capture my true socket ID
function isMySocket(id) {
    return id === myId;
}

// Override: when server sends lobby update, try to identify myself
function renderLobbyPlayers(playersList, hostId) {
    UI.lobbyPlayersList.innerHTML = '';
    
    // We assume the player with isHost=true matches our host role, or we save who we are
    // Since client WS is single, the first player we match will be labeled
    playersList.forEach(p => {
        const row = document.createElement('div');
        row.className = 'lobby-player-row';
        
        // Check if this row is me. Since we don't have our ID yet in the initial phase,
        // we can identify our row by matching the name we inputted.
        const isMe = p.name === loadout.name;
        if (isMe) {
            row.classList.add('me');
            myId = p.id; // Assign my socket ID
        }

        let skinColor = SKIN_COLORS[p.skin] || '#fff';
        let gunName = p.gunType.toUpperCase();
        let perkName = p.perk !== 'none' ? ` | Perk: ${p.perk.replace('_', ' ')}` : '';
        let accName = p.accessory !== 'none' ? ` | Phụ kiện: ${p.accessory}` : '';

        let statusBadge = '';
        if (p.isHost) {
            statusBadge = '<span class="badge-host" style="background: var(--cyber-cyan); color: #000; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-left: 8px;">Host</span>';
        } else {
            statusBadge = '<span class="badge-ready" style="background: var(--cyber-green); color: #000; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-left: 8px;">Sẵn sàng</span>';
        }

        row.innerHTML = `
            <div>
                <span style="display:inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${skinColor}; margin-right: 8px;"></span>
                <span style="font-weight:600;">${escapeHTML(p.name)}</span>
                ${statusBadge}
            </div>
            <div class="player-info-detail">
                ${gunName}${perkName}${accName}
            </div>
        `;
        UI.lobbyPlayersList.appendChild(row);
    });
}

// Render active rooms onto main menu list
function renderLobbyList(rooms) {
    UI.roomListContainer.innerHTML = '';
    
    if (rooms.length === 0) {
        UI.roomListContainer.innerHTML = '<div class="no-rooms">Không có phòng chờ nào. Tạo phòng để bắt đầu!</div>';
        return;
    }

    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        
        let modeText = 'Solo';
        if (room.gameMode === 'coop') modeText = 'Coop';
        else if (room.gameMode === 'pvp') modeText = 'PVP';
        else if (room.gameMode === 'team') modeText = 'Team';

        let diffText = room.botDifficulty === 'easy' ? 'Dễ' : room.botDifficulty === 'medium' ? 'Vừa' : 'Khó';

        item.innerHTML = `
            <div>
                <span class="room-item-code">${room.code}</span>
                <span class="room-item-info"> (${modeText} - Bot: ${diffText})</span>
            </div>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span style="font-size: 0.85rem; color: var(--text-secondary);">${room.playersCount}/${room.maxPlayers} người</span>
                <button class="cyber-btn" style="padding: 4px 10px; font-size: 0.75rem;" onclick="joinRoomByCode('${room.code}')">Join</button>
            </div>
        `;
        UI.roomListContainer.appendChild(item);
    });
}

// Quick join function exposed globally
window.joinRoomByCode = function(code) {
    window.audioSystem.init();
    UI.roomCodeInput.value = code;
    UI.joinRoomBtn.click();
};

// Spawn particles for death explosion
function spawnDeathParticles(x, y, team) {
    const color = TEAM_COLORS[team] || '#ff00ff';
    const count = 35;
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 100;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 4 + 2,
            color: color,
            alpha: 1.0,
            life: 0,
            maxLife: Math.random() * 0.5 + 0.4 // 400-900ms life
        });
    }
}

// Add event to killfeed HUD
function triggerKillfeed(killer, victim) {
    const item = document.createElement('div');
    item.className = 'killfeed-item';
    
    item.innerHTML = `
        <span class="kf-killer">${escapeHTML(killer)}</span>
        <span class="kf-action">⚡ hạ gục</span>
        <span class="kf-victim">${escapeHTML(victim)}</span>
    `;

    UI.hudKillfeed.appendChild(item);
    
    // Automatically delete after 4s (matches CSS animation)
    setTimeout(() => {
        item.remove();
    }, 4000);
}

// Global touch control variables
let moveJoystickActive = false;
let moveJoystickStart = { x: 0, y: 0 };
let moveMaxDistance = 60; // dynamically updated on start

let aimJoystickActive = false;
let aimJoystickStart = { x: 0, y: 0 };
let aimMaxDistance = 60; // dynamically updated on start

function setupTouchControls() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    const overlay = document.getElementById('touchControlsOverlay');
    const moveArea = document.getElementById('moveJoystickContainer');
    const moveKnob = document.getElementById('moveJoystickKnob');
    const aimArea = document.getElementById('aimJoystickContainer');
    const aimKnob = document.getElementById('aimJoystickKnob');
    const touchReloadBtn = document.getElementById('touchReloadBtn');
    const touchDashBtn = document.getElementById('touchDashBtn');

    if (!overlay || !moveArea || !moveKnob || !aimArea || !aimKnob || !touchReloadBtn || !touchDashBtn) return;

    // Show touch overlay if touch capability is detected
    if (isTouchDevice) {
        overlay.style.display = 'block';
    }

    // Helper: Reset move inputs
    function resetMoveInputs() {
        inputState.w = false;
        inputState.a = false;
        inputState.s = false;
        inputState.d = false;
    }

    // --- 1. Movement Joystick ---
    moveArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = moveArea.getBoundingClientRect();
        moveJoystickStart.x = rect.left + rect.width / 2;
        moveJoystickStart.y = rect.top + rect.height / 2;
        moveMaxDistance = rect.width * 0.38; // Dynamic range based on container width
        moveJoystickActive = true;
    }, { passive: false });

    moveArea.addEventListener('touchmove', (e) => {
        if (!moveJoystickActive) return;
        e.preventDefault();
        const touch = e.targetTouches[0];
        
        const dx = touch.clientX - moveJoystickStart.x;
        const dy = touch.clientY - moveJoystickStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let angle = Math.atan2(dy, dx);
        let moveX = dx;
        let moveY = dy;
        
        if (dist > moveMaxDistance) {
            moveX = Math.cos(angle) * moveMaxDistance;
            moveY = Math.sin(angle) * moveMaxDistance;
        }
        
        moveKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;
        
        resetMoveInputs();
        if (dist > 8) {
            const deg = angle * 180 / Math.PI;
            
            // Up (W)
            if (deg >= -157.5 && deg <= -22.5) inputState.w = true;
            // Down (S)
            if (deg >= 22.5 && deg <= 157.5) inputState.s = true;
            // Right (D)
            if (deg >= -67.5 && deg <= 67.5) inputState.d = true;
            // Left (A)
            if (deg <= -112.5 || deg >= 112.5) inputState.a = true;
        }
        // Skip direct syncInput here to avoid flooding. Periodic drawLoop sync will handle this.
    }, { passive: false });

    moveArea.addEventListener('touchend', (e) => {
        e.preventDefault();
        moveJoystickActive = false;
        moveKnob.style.transform = 'translate(0px, 0px)';
        resetMoveInputs();
        syncInput(); // Immediate sync on release
    }, { passive: false });


    // --- 2. Aim & Shoot Joystick ---
    aimArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = aimArea.getBoundingClientRect();
        aimJoystickStart.x = rect.left + rect.width / 2;
        aimJoystickStart.y = rect.top + rect.height / 2;
        aimMaxDistance = rect.width * 0.38; // Dynamic range based on container width
        aimJoystickActive = true;
    }, { passive: false });

    aimArea.addEventListener('touchmove', (e) => {
        if (!aimJoystickActive) return;
        e.preventDefault();
        const touch = e.targetTouches[0];
        
        const dx = touch.clientX - aimJoystickStart.x;
        const dy = touch.clientY - aimJoystickStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let angle = Math.atan2(dy, dx);
        let moveX = dx;
        let moveY = dy;
        
        if (dist > aimMaxDistance) {
            moveX = Math.cos(angle) * aimMaxDistance;
            moveY = Math.sin(angle) * aimMaxDistance;
        }
        
        aimKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;
        
        inputState.mouseAngle = angle;
        
        if (dist > aimMaxDistance * 0.28) {
            inputState.shooting = true;
        } else {
            inputState.shooting = false;
        }
        // Skip direct syncInput here to avoid flooding. Periodic drawLoop sync will handle this.
    }, { passive: false });

    aimArea.addEventListener('touchend', (e) => {
        e.preventDefault();
        aimJoystickActive = false;
        aimKnob.style.transform = 'translate(0px, 0px)';
        inputState.shooting = false;
        syncInput();
    }, { passive: false });


    // --- 3. Action Buttons ---
    touchDashBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputState.space = true;
        syncInput();
        
        setTimeout(() => {
            inputState.space = false;
            syncInput();
        }, 100);
    }, { passive: false });

    touchReloadBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (socket && socket.readyState === WebSocket.OPEN && gameActive) {
            socket.send(JSON.stringify({ type: 'reload' }));
        }
    }, { passive: false });

    window.addEventListener('touchstart', () => {
        if (overlay.style.display === 'none') {
            overlay.style.display = 'block';
        }
    }, { once: true });
}

// Input listeners
function setupInput() {
    window.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        
        switch (e.key.toLowerCase()) {
            case 'w': inputState.w = true; break;
            case 'a': inputState.a = true; break;
            case 's': inputState.s = true; break;
            case 'd': inputState.d = true; break;
            case 'r': inputState.r = true; break;
            case ' ': inputState.space = true; break;
        }

        // Prevent space/arrow key defaults
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }
        
        syncInput();
    });

    window.addEventListener('keyup', (e) => {
        if (!gameActive) return;

        switch (e.key.toLowerCase()) {
            case 'w': inputState.w = false; break;
            case 'a': inputState.a = false; break;
            case 's': inputState.s = false; break;
            case 'd': inputState.d = false; break;
            case 'r': inputState.r = false; break;
            case ' ': inputState.space = false; break;
        }
        
        syncInput();
    });

    window.addEventListener('mousemove', (e) => {
        if (!gameActive || !myPlayerState) return;

        // Calculate angle between player center on screen and mouse
        const playerScreenX = canvas.width / 2;
        const playerScreenY = canvas.height / 2;
        
        const dx = e.clientX - playerScreenX;
        const dy = e.clientY - playerScreenY;
        
        inputState.mouseAngle = Math.atan2(dy, dx);
        // Skip direct syncInput here to avoid flooding. Periodic drawLoop sync will handle this.
    });

    window.addEventListener('mousedown', (e) => {
        if (!gameActive || e.button !== 0) return; // Left click only
        inputState.shooting = true;
        syncInput();
    });

    window.addEventListener('mouseup', (e) => {
        if (!gameActive || e.button !== 0) return;
        inputState.shooting = false;
        syncInput();
    });
}

function syncInput() {
    if (socket && socket.readyState === WebSocket.OPEN && gameActive) {
        socket.send(JSON.stringify({
            type: 'input',
            input: inputState
        }));
    }
}

// Render game view based on received state
let latestGameState = null;
// Map to hold lerped positions for smooth rendering
const lerpedPositions = new Map();
let lastInputSentTime = 0;

// Helper to interpolate angles smoothly avoiding the 180-degree wrap jump
function lerpAngle(current, target, factor) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * factor;
}

function renderGame(statePacket) {
    latestGameState = statePacket;
}

// Client drawing loop running at ~60fps
let lastLoopTime = Date.now();
function drawLoop() {
    if (!gameActive) return;

    const now = Date.now();
    const dt = (now - lastLoopTime) / 1000.0;
    lastLoopTime = now;

    // Rate limit input updates to server (approx 30ms interval) to prevent socket flooding
    if (now - lastInputSentTime >= 30) {
        syncInput();
        lastInputSentTime = now;
    }

    // Calculate Client FPS
    framesThisSecond++;
    if (now > lastFpsTime + 1000) {
        fps = framesThisSecond;
        framesThisSecond = 0;
        lastFpsTime = now;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (latestGameState && myPlayerState) {
        // Update local client-side death particles
        updateParticles(dt);

        // Find my current player state in latest
        const currentMe = latestGameState.players.find(p => p.id === myId);
        if (currentMe) {
            myPlayerState = currentMe;
        }

        // Calculate lerped position for camera and local rendering of myself
        let myLerp = lerpedPositions.get(myId);
        if (!myLerp) {
            myLerp = { x: myPlayerState.x, y: myPlayerState.y, angle: myPlayerState.angle };
            lerpedPositions.set(myId, myLerp);
        } else {
            // Lerp extremely fast for player self-movement to keep controls responsive
            const factor = 1 - Math.exp(-25 * dt);
            myLerp.x += (myPlayerState.x - myLerp.x) * factor;
            myLerp.y += (myPlayerState.y - myLerp.y) * factor;
            myLerp.angle = lerpAngle(myLerp.angle, myPlayerState.angle, factor);
        }

        // Camera positioning (follow my lerped player center)
        ctx.save();
        ctx.translate(canvas.width / 2 - myLerp.x, canvas.height / 2 - myLerp.y);

        // Draw Arena Grid floor
        drawArenaGrid();

        // Draw Map borders
        drawMapBorders();

        // Draw static Obstacles
        drawObstacles();

        // Draw death particles
        drawParticles();

        // Draw Bullets (with Client Extrapolation to make them fly smooth)
        latestGameState.bullets.forEach(bullet => {
            if (bullet.vx !== undefined && bullet.vy !== undefined) {
                bullet.x += bullet.vx * dt;
                bullet.y += bullet.vy * dt;
            }
            drawBullet(bullet);
        });

        // Draw Bots with smooth Lerp interpolation
        latestGameState.bots.forEach(bot => {
            let lerpData = lerpedPositions.get(bot.id);
            if (!lerpData) {
                lerpData = { x: bot.x, y: bot.y, angle: bot.angle };
                lerpedPositions.set(bot.id, lerpData);
            } else {
                const factor = 1 - Math.exp(-18 * dt);
                lerpData.x += (bot.x - lerpData.x) * factor;
                lerpData.y += (bot.y - lerpData.y) * factor;
                lerpData.angle = lerpAngle(lerpData.angle, bot.angle, factor);
            }
            const drawnBot = { ...bot, x: lerpData.x, y: lerpData.y, angle: lerpData.angle };
            drawEntity(drawnBot);
        });

        // Draw Players with smooth Lerp interpolation
        latestGameState.players.forEach(player => {
            let lerpData = lerpedPositions.get(player.id);
            if (!lerpData) {
                lerpData = { x: player.x, y: player.y, angle: player.angle };
                lerpedPositions.set(player.id, lerpData);
            } else {
                if (player.id === myId) {
                    lerpData.x = myLerp.x;
                    lerpData.y = myLerp.y;
                    lerpData.angle = myLerp.angle;
                } else {
                    const factor = 1 - Math.exp(-18 * dt);
                    lerpData.x += (player.x - lerpData.x) * factor;
                    lerpData.y += (player.y - lerpData.y) * factor;
                    lerpData.angle = lerpAngle(lerpData.angle, player.angle, factor);
                }
            }
            const drawnPlayer = { ...player, x: lerpData.x, y: lerpData.y, angle: lerpData.angle };
            drawEntity(drawnPlayer);
        });

        ctx.restore();

        // Garbage collection for offline/dead lerp entries
        const activeIds = new Set([
            ...latestGameState.players.map(p => p.id),
            ...latestGameState.bots.map(b => b.id)
        ]);
        for (let id of lerpedPositions.keys()) {
            if (!activeIds.has(id)) {
                lerpedPositions.delete(id);
            }
        }

        // Draw Mini-map HUD overlay
        drawMinimap();

        // Render Screen overlays HUD
        renderHUD();
    }

    requestAnimationFrame(drawLoop);
}

// Draw static block obstacles
function drawObstacles() {
    obstacles.forEach(obs => {
        ctx.fillStyle = '#16192b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        
        // Cyan borders with glow
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
        ctx.shadowBlur = 10;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        
        // Diagonal tech lines on boxes
        ctx.shadowBlur = 0; // reset
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let offset = 20; offset < obs.w + obs.h; offset += 20) {
            ctx.beginPath();
            ctx.moveTo(obs.x + Math.max(0, offset - obs.h), obs.y + Math.min(obs.h, offset));
            ctx.lineTo(obs.x + Math.min(obs.w, offset), obs.y + Math.max(0, offset - obs.w));
            ctx.stroke();
        }
    });
}

// Draw background grid lines within bounds
function drawArenaGrid() {
    ctx.strokeStyle = '#121424';
    ctx.lineWidth = 1;
    const gridSize = 40;

    for (let x = 0; x <= mapWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapHeight);
        ctx.stroke();
    }
    for (let y = 0; y <= mapHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mapWidth, y);
        ctx.stroke();
    }
}

// Draw boundary wall outlines
function drawMapBorders() {
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(255, 0, 127, 0.5)';
    ctx.shadowBlur = 15;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);
    
    ctx.shadowBlur = 0; // reset
}

// Draw bullets as bright neon beads
function drawBullet(bullet) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.angle);

    const bColor = bullet.ownerTeam === 'red' ? '#ff3366' : bullet.ownerTeam === 'blue' ? '#00f0ff' : '#ffea00';
    
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = bColor;
    ctx.shadowBlur = 8;
    
    // Draw capsule bullet shape
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Trail line
    ctx.strokeStyle = bColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.restore();
}

// Draw players and bots
function drawEntity(entity) {
    if (entity.hp <= 0) return; // Hide dead bodies

    ctx.save();
    ctx.translate(entity.x, entity.y);

    const isMe = entity.id === myId;
    
    // Define skin color
    let mainColor = SKIN_COLORS[entity.skin] || '#fff';
    if (latestGameState.gameMode === 'team' || latestGameState.gameMode === 'coop') {
        mainColor = TEAM_COLORS[entity.team] || mainColor;
    }

    // 1. Draw accessories (Backpack) - drawn behind player body
    if (entity.accessory === 'backpack') {
        ctx.fillStyle = '#1c1f35';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1;
        ctx.save();
        ctx.rotate(entity.angle);
        // Draw backpack behind (opposite of aiming angle)
        ctx.fillRect(-28, -8, 8, 16);
        ctx.strokeRect(-28, -8, 8, 16);
        ctx.restore();
    }

    // 2. Draw gun (pointing towards aim angle)
    ctx.save();
    ctx.rotate(entity.angle);
    ctx.fillStyle = '#1c1f35';
    ctx.strokeStyle = '#5f6583';
    ctx.lineWidth = 2;

    switch (entity.gunType) {
        case 'pistol':
            ctx.fillRect(10, 2, 12, 4); // Barrel
            ctx.strokeRect(10, 2, 12, 4);
            break;
        case 'smg':
            ctx.fillRect(8, 2, 16, 6);
            ctx.strokeRect(8, 2, 16, 6);
            ctx.fillStyle = '#3a3f58'; // Magazine clip
            ctx.fillRect(15, 8, 3, 8);
            break;
        case 'rifle':
            ctx.fillRect(6, 2, 24, 7);
            ctx.strokeRect(6, 2, 24, 7);
            break;
        case 'shotgun':
            ctx.fillRect(8, 0, 18, 9);
            ctx.strokeRect(8, 0, 18, 9);
            break;
        case 'sniper':
            ctx.fillRect(4, 2, 32, 5); // long barrel
            ctx.strokeRect(4, 2, 32, 5);
            // Scope
            ctx.fillStyle = '#474c67';
            ctx.beginPath();
            ctx.arc(18, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
    }
    ctx.restore();

    // 3. Draw main player body (Circle)
    ctx.fillStyle = '#0b0c10';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = isMe ? 12 : 4; // Glow more if it's me

    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.shadowBlur = 0; // reset

    // Draw inner design detailing
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Draw accessories (Helmet, Visor, Shoulder Pads)
    if (entity.accessory === 'helmet') {
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Helmet curve on top (facing gun direction)
        ctx.arc(0, 0, 19, entity.angle - Math.PI/2, entity.angle + Math.PI/2);
        ctx.stroke();
    }

    if (entity.accessory === 'visor') {
        ctx.strokeStyle = '#ffea00'; // visor lens glow
        ctx.lineWidth = 3;
        ctx.save();
        ctx.rotate(entity.angle);
        ctx.beginPath();
        // Front arc
        ctx.arc(0, 0, 18.5, -0.4, 0.4);
        ctx.stroke();
        ctx.restore();
    }

    if (entity.accessory === 'shoulder_pad') {
        ctx.fillStyle = '#2a2e45';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        
        ctx.save();
        ctx.rotate(entity.angle);
        // Draw pads on side shoulders (orthogonal to angle)
        ctx.beginPath();
        ctx.arc(0, -18, 4, 0, Math.PI*2);
        ctx.arc(0, 18, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore(); // Restore coordinates translation

    // 5. Draw labels (Name, HP, Reload bar) - drawn above character, not affected by rotation
    // Draw Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    
    let label = entity.name;
    if (entity.isBot) label += ` [BOT]`;
    ctx.fillText(label, entity.x, entity.y - 36);

    // Draw HP bar
    const barWidth = 36;
    const barHeight = 4;
    const barX = entity.x - barWidth / 2;
    const barY = entity.y - 28;

    // HP Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // HP Fill
    const hpRatio = Math.max(0, entity.hp / entity.maxHp);
    ctx.fillStyle = entity.team === 'red' ? '#ff3366' : entity.team === 'blue' ? '#00f0ff' : '#39ff14';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // Shield Fill (thin line on top if shield exists)
    if (entity.maxShield > 0 && entity.shield > 0) {
        const shieldRatio = entity.shield / entity.maxShield;
        ctx.fillStyle = '#00a2ff';
        ctx.fillRect(barX, barY - 2, barWidth * shieldRatio, 1.5);
    }

    // Draw Reloading Progress
    if (entity.isReloading) {
        ctx.fillStyle = 'rgba(255, 234, 0, 0.8)';
        ctx.fillRect(barX, barY + 5, barWidth * entity.reloadProgress, 2);
    }
}

// Client particles animation updater
function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96; // drag
        p.vy *= 0.96;
        
        p.life += dt;
        p.alpha = Math.max(0, 1.0 - p.life / p.maxLife);

        if (p.life >= p.maxLife) {
            particles.splice(i, 1);
        }
    }
}

// Draw local particles
function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
}

// Synchronize in-game HUD indicators
function renderHUD() {
    if (!myPlayerState) return;

    // Render match time countdown
    if (latestGameState && latestGameState.matchTimer !== undefined) {
        const totalSecs = latestGameState.matchTimer;
        const mins = Math.floor(totalSecs / 60);
        const secs = Math.floor(totalSecs % 60);
        UI.hudTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // HP Text & bar
    UI.hudHpText.textContent = `${myPlayerState.hp}/${myPlayerState.maxHp}`;
    UI.hudHpFill.style.width = (myPlayerState.hp / myPlayerState.maxHp * 100) + '%';

    // Shield (only show if Perk Shield is equipped)
    if (myPlayerState.maxShield > 0) {
        UI.hudShieldContainer.style.display = 'block';
        UI.hudShieldText.textContent = `${myPlayerState.shield}/${myPlayerState.maxShield}`;
        UI.hudShieldFill.style.width = (myPlayerState.shield / myPlayerState.maxShield * 100) + '%';
    } else {
        UI.hudShieldContainer.style.display = 'none';
    }

    // Weapon & Ammo
    UI.hudWeaponName.textContent = myPlayerState.gunType;
    if (myPlayerState.isReloading) {
        UI.hudAmmoCurrent.textContent = 'R';
        UI.hudAmmoCurrent.style.color = 'var(--cyber-yellow)';
    } else {
        UI.hudAmmoCurrent.textContent = myPlayerState.ammo;
        UI.hudAmmoCurrent.style.color = '#fff';
    }
    UI.hudAmmoMax.textContent = myPlayerState.maxAmmo;

    // Dash ready indicator
    const dashCooldown = myPlayerState.dashCooldownTimer || 0;
    if (myPlayerState.dashCooldownTimer > 0) {
        UI.hudDashIndicator.textContent = `DASH (Cooldowm: ${Math.ceil(dashCooldown)}s)`;
        UI.hudDashIndicator.classList.remove('hud-dash-ready');
        UI.hudDashIndicator.style.color = 'var(--text-secondary)';
    } else {
        UI.hudDashIndicator.textContent = 'DASH SẴN SÀNG (SPACE)';
        UI.hudDashIndicator.classList.add('hud-dash-ready');
    }

    // Ping & FPS
    UI.hudLatencyDisplay.textContent = `FPS: ${fps} | Ping: ${ping}ms`;

    // Leaderboard update
    renderScoreboard();

    // Death overlay handler
    if (myPlayerState.hp <= 0) {
        UI.hudDeathOverlay.classList.remove('hidden');
        // Subtract or get respawn countdown from server approximation
        // In this implementation, Server spawns after exactly 3s
        // We'll calculate a local timer countdown
        if (!window.deathTimeStart) {
            window.deathTimeStart = Date.now();
        }
        const timeElapsed = (Date.now() - window.deathTimeStart) / 1000;
        const countdown = Math.max(0, Math.ceil(3.0 - timeElapsed));
        UI.respawnTimerCount.textContent = countdown;
    } else {
        UI.hudDeathOverlay.classList.add('hidden');
        window.deathTimeStart = null;
    }
}

// Draw the Leaderboard table based on scores
function renderScoreboard() {
    UI.leaderboardList.innerHTML = '';
    
    // Concat players and bots lists
    const allEntities = latestGameState.players.concat(latestGameState.bots);
    
    // Sort descending by score
    allEntities.sort((a, b) => b.score - a.score || a.deaths - b.deaths);

    // Take top 6
    const topList = allEntities.slice(0, 6);

    topList.forEach((ent, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        if (ent.id === myId) row.classList.add('me');

        let nameDisplay = ent.name;
        if (ent.isBot) nameDisplay += ' (BOT)';
        
        row.innerHTML = `
            <span>${index + 1}. ${escapeHTML(nameDisplay)}</span>
            <span>${ent.score} K / ${ent.deaths} D</span>
        `;
        UI.leaderboardList.appendChild(row);
    });
}

// Draw the mini-map overlay in-game
function drawMinimap() {
    if (!latestGameState || !myPlayerState) return;

    const mmW = 160;
    const mmH = 120;
    const mmX = 30;
    const mmY = 115;

    // 1. Draw Mini-map background
    ctx.save();
    ctx.fillStyle = 'rgba(8, 9, 15, 0.75)';
    ctx.fillRect(mmX, mmY, mmW, mmH);

    // Glowing border
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.3)';
    ctx.shadowBlur = 8;
    ctx.strokeRect(mmX, mmY, mmW, mmH);
    ctx.shadowBlur = 0; // reset

    // Draw grid lines inside minimap
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridDivs = 4;
    for (let i = 1; i < gridDivs; i++) {
        // Vertical
        ctx.beginPath();
        ctx.moveTo(mmX + (mmW / gridDivs) * i, mmY);
        ctx.lineTo(mmX + (mmW / gridDivs) * i, mmY + mmH);
        ctx.stroke();

        // Horizontal
        ctx.beginPath();
        ctx.moveTo(mmX, mmY + (mmH / gridDivs) * i);
        ctx.lineTo(mmX + mmW, mmY + (mmH / gridDivs) * i);
        ctx.stroke();
    }

    // 2. Draw Obstacles
    obstacles.forEach(obs => {
        const ox = mmX + (obs.x / mapWidth) * mmW;
        const oy = mmY + (obs.y / mapHeight) * mmH;
        const ow = (obs.w / mapWidth) * mmW;
        const oh = (obs.h / mapHeight) * mmH;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(ox, oy, ow, oh);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeRect(ox, oy, ow, oh);
    });

    // Helper to draw a dot
    const drawDot = (mx, my, color, radius, pulse = false) => {
        const ox = mmX + (mx / mapWidth) * mmW;
        const oy = mmY + (my / mapHeight) * mmH;

        // Pulse ring
        if (pulse) {
            const pulseRadius = radius + 3 + Math.sin(Date.now() / 150) * 2;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ox, oy, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = pulse ? 6 : 2;
        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
    };

    const myTeam = myPlayerState.team;

    // 3. Draw other Entities (Teammates and Enemies) using lerped positions for smoothness
    // Draw players
    latestGameState.players.forEach(p => {
        if (p.hp <= 0 || p.id === myId) return;

        let color = '#ff3366'; // enemy red by default
        let size = 3;

        if (latestGameState.gameMode === 'team' || latestGameState.gameMode === 'coop') {
            if (p.team === myTeam) color = '#00f0ff'; // teammate blue
        }
        
        const lerpPos = lerpedPositions.get(p.id) || p;
        drawDot(lerpPos.x, lerpPos.y, color, size);
    });

    // Draw bots
    latestGameState.bots.forEach(b => {
        if (b.hp <= 0) return;

        let color = '#ff3366'; // enemy red by default
        let size = 3;

        if (latestGameState.gameMode === 'team' || latestGameState.gameMode === 'coop' || latestGameState.gameMode === 'vs_bot') {
            if (b.team === myTeam) color = '#00f0ff'; // teammate bot blue
        }
        
        const lerpPos = lerpedPositions.get(b.id) || b;
        drawDot(lerpPos.x, lerpPos.y, color, size);
    });

    // 4. Draw Self (drawn on top with yellow pulsing indicator) using lerp position
    const myLerpPos = lerpedPositions.get(myId) || myPlayerState;
    drawDot(myLerpPos.x, myLerpPos.y, '#ffea00', 4.5, true);

    ctx.restore();
}

function setupFullscreen() {
    const btn = document.getElementById('fullscreenToggle');
    const icon = document.getElementById('fullscreenIcon');
    const text = document.getElementById('fullscreenText');

    if (!btn || !icon || !text) return;

    btn.addEventListener('click', () => {
        toggleFullscreen();
    });

    function toggleFullscreen() {
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.msFullscreenElement) {
            
            const el = document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen();
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (el.msRequestFullscreen) {
                el.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    const onFullscreenChange = () => {
        const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (isFS) {
            icon.textContent = '🗗';
            text.textContent = 'Thu nhỏ';
        } else {
            icon.textContent = '⛶';
            text.textContent = 'Toàn màn hình';
        }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('msfullscreenchange', onFullscreenChange);
}

// QR Code Lightbox Controls
function openQrModal(imgSrc, titleText) {
    const modal = document.getElementById('qrModal');
    const modalImg = document.getElementById('qrModalImg');
    const modalTitle = document.getElementById('qrModalTitle');
    
    if (!modal || !modalImg || !modalTitle) return;

    modalTitle.textContent = titleText;
    
    if (imgSrc.includes('bank')) {
        modalTitle.style.color = 'var(--cyber-pink)';
        modal.querySelector('.qr-modal-content').style.borderColor = 'rgba(255, 0, 127, 0.2)';
        modal.querySelector('.qr-modal-content').style.boxShadow = '0 0 30px rgba(255, 0, 127, 0.15)';
    } else {
        modalTitle.style.color = 'var(--cyber-cyan)';
        modal.querySelector('.qr-modal-content').style.borderColor = 'rgba(0, 240, 255, 0.2)';
        modal.querySelector('.qr-modal-content').style.boxShadow = '0 0 30px rgba(0, 240, 255, 0.15)';
    }
    
    modalImg.src = imgSrc;
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => {
        if (!modal.classList.contains('active')) {
            modal.style.display = 'none';
        }
    }, 300);
}

// Utility: HTML Escaper
function escapeHTML(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// Boot up game script
window.addEventListener('DOMContentLoaded', () => {
    initSocket();
    setupUI();
    setupInput();
    setupTouchControls();
    setupFullscreen();
});
