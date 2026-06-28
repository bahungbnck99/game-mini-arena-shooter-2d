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

// Survival mode variables
let latestSafeZone = null;
let latestCrates = [];
let survivalAliveCount = 0;
let survivalTotalCount = 0;
const clientPickedItemIds = new Set();
let isSpectating = false;
let spectateTargetId = null;
let isAutoSpectate = false;
let latestRankings = null;
let autoStartTimeoutId = null;
let autoStartIntervalId = null;
let cameraX = 0;
let cameraY = 0;
let lastTargetX = 0;
let lastTargetY = 0;
let targetStuckTimer = 0;

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
let damagePopups = [];

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
    mouseAngle: 0,
    useHeal: false
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
    rightTabLobby: document.getElementById('rightTabLobby'),
    rightTabRanked: document.getElementById('rightTabRanked'),
    rightLobbyContent: document.getElementById('rightLobbyContent'),
    rightRankedContent: document.getElementById('rightRankedContent'),
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
    hudBuffsList: document.getElementById('hudBuffsList'),
    hudHealPackText: document.getElementById('hudHealPackText'),
    
    // Audio & Volume controls
    audioToggle: document.getElementById('audioToggle'),
    audioIcon: document.getElementById('audioIcon'),
    audioText: document.getElementById('audioText'),
    volumeSettingsPanel: document.getElementById('volumeSettingsPanel'),
    volumeMuteCheck: document.getElementById('volumeMuteCheck'),
    bgmVolumeSlider: document.getElementById('bgmVolumeSlider'),
    bgmVolumeVal: document.getElementById('bgmVolumeVal'),
    gunVolumeSlider: document.getElementById('gunVolumeSlider'),
    gunVolumeVal: document.getElementById('gunVolumeVal'),
    otherVolumeSlider: document.getElementById('otherVolumeSlider'),
    otherVolumeVal: document.getElementById('otherVolumeVal'),
    
    // Exit game button
    exitGameBtn: document.getElementById('exitGameBtn'),

    // Bot count elements & inputs
    botDifficultyInputGroup: document.getElementById('botDifficultyInputGroup'),
    matchDurationInputGroup: document.getElementById('matchDurationInputGroup'),
    botCountInputGroup: document.getElementById('botCountInputGroup'),
    botCountInput: document.getElementById('botCountInput'),
    botCountHelperText: document.getElementById('botCountHelperText'),
    maxPlayersSelect: document.getElementById('maxPlayersSelect'),
    maxPlayersInputGroup: document.getElementById('maxPlayersInputGroup'),
    survivalConfigGroup: document.getElementById('survivalConfigGroup'),
    survivalConfigLabel: document.getElementById('survivalConfigLabel'),
    survivalConfigInput: document.getElementById('survivalConfigInput'),
    survivalSafeZoneDurationInput: document.getElementById('survivalSafeZoneDurationInput'),
    survivalShrinkDurationInput: document.getElementById('survivalShrinkDurationInput'),

    // Match timer & game over elements
    hudPlayerStats: document.getElementById('hudPlayerStats'),
    hudWeaponStats: document.getElementById('hudWeaponStats'),
    matchDurationSelect: document.getElementById('matchDurationSelect'),
    hudTimer: document.getElementById('hudTimer'),
    hudGameOverOverlay: document.getElementById('hudGameOverOverlay'),
    goResultTitle: document.getElementById('goResultTitle'),
    goScoreDetail: document.getElementById('goScoreDetail'),
    goLeaderboard: document.getElementById('goLeaderboard'),
    goBackBtn: document.getElementById('goBackBtn'),
    goLobbyBtn: document.getElementById('goLobbyBtn'),
    goMvpContainer: document.getElementById('goMvpContainer'),
    goTeamsScoreboard: document.getElementById('goTeamsScoreboard'),
    goBlueTeamList: document.getElementById('goBlueTeamList'),
    goRedTeamList: document.getElementById('goRedTeamList'),
    goSingleScoreboard: document.getElementById('goSingleScoreboard'),
    goRankedLeaderboard: document.getElementById('goRankedLeaderboard'),
    rankedTabDay: document.getElementById('rankedTabDay'),
    rankedTabWeek: document.getElementById('rankedTabWeek'),
    rankedTabMonth: document.getElementById('rankedTabMonth'),
    rankedTabYear: document.getElementById('rankedTabYear'),
    goRankedList: document.getElementById('goRankedList'),
    lobbyWaitWarning: document.getElementById('lobbyWaitWarning'),
    lobbySpectateToggleArea: document.getElementById('lobbySpectateToggleArea'),
    lobbySpectateCheck: document.getElementById('lobbySpectateCheck'),
    lobbyTeamSelectArea: document.getElementById('lobbyTeamSelectArea'),
    lobbySelectBlueBtn: document.getElementById('lobbySelectBlueBtn'),
    lobbySelectRedBtn: document.getElementById('lobbySelectRedBtn'),
    lobbySquadSelectArea: document.getElementById('lobbySquadSelectArea'),
    lobbySquadBtnsContainer: document.getElementById('lobbySquadBtnsContainer'),
    survivalHud: document.getElementById('survivalHud'),
    survivalRingTimer: document.getElementById('survivalRingTimer'),
    survivalAliveCountText: document.getElementById('survivalAliveCount'),
    spectatorHud: document.getElementById('spectatorHud'),
    spectatorTargetName: document.getElementById('spectatorTargetName'),
    spectatorLeaveBtn: document.getElementById('spectatorLeaveBtn'),
    deathSpectateBtn: document.getElementById('deathSpectateBtn'),
    deathLeaveBtn: document.getElementById('deathLeaveBtn'),
    deathRespawnText: document.getElementById('deathRespawnText'),
    deathSurvivalButtons: document.getElementById('deathSurvivalButtons'),
    dbTabDay: document.getElementById('dbTabDay'),
    dbTabWeek: document.getElementById('dbTabWeek'),
    dbTabMonth: document.getElementById('dbTabMonth'),
    dbTabYear: document.getElementById('dbTabYear'),
    dbRankedList: document.getElementById('dbRankedList')
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

// 20 unique neon colors for squads
const SQUAD_NEON_COLORS = [
    '#00f3ff', // Cyan
    '#ff3c83', // Pink
    '#ffde07', // Yellow
    '#39ff14', // Neon Green
    '#ff5722', // Orange
    '#e040fb', // Purple
    '#00e676', // Light Green
    '#ff1744', // Red-Pink
    '#2979ff', // Blue
    '#ffd600', // Gold
    '#ff8f00', // Amber
    '#00e5ff', // Aqua
    '#651fff', // Indigo
    '#d500f9', // Magenta
    '#aeea00', // Lime
    '#00b0ff', // Light Blue
    '#f50057', // Deep Pink
    '#1de9b6', // Teal
    '#f4ff81', // Lemon
    '#ff6e40'  // Coral
];

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
        const matchDuration = UI.matchDurationSelect.value !== '' ? parseInt(UI.matchDurationSelect.value) : 120;
        
        let maxPlayers = parseInt(UI.maxPlayersSelect.value) || 4;
        let squadCount = 4;

        if (mode === 'survival') {
            maxPlayers = parseInt(UI.survivalConfigInput.value) || 30;
        } else if (mode === 'survival_team') {
            squadCount = parseInt(UI.survivalConfigInput.value) || 4;
            maxPlayers = squadCount * 5;
        }
        
        socket.send(JSON.stringify({
            type: 'create_room',
            name: loadout.name,
            loadout: loadout,
            config: {
                gameMode: mode,
                botDifficulty: difficulty,
                botCount: botCount,
                matchDuration: matchDuration,
                maxPlayers: maxPlayers,
                squadCount: squadCount,
                survivalSafeZoneDuration: parseInt(UI.survivalSafeZoneDurationInput.value) || 180,
                survivalShrinkDuration: parseInt(UI.survivalShrinkDurationInput.value) || 30
            }
        }));
    });

    UI.goBackBtn.addEventListener('click', () => {
        socket.send(JSON.stringify({ type: 'leave_room' }));
        localStorage.removeItem('my_hosted_room');
        isHost = false;
        showScreen('menu');
        getLobbyRooms();
    });

    UI.goLobbyBtn.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'return_to_lobby' }));
            
            // Immediately clear client screen overlay and transition to lobby
            UI.hudGameOverOverlay.classList.add('hidden');
            gameActive = false;
            if (pingInterval) clearInterval(pingInterval);
            showScreen('lobby');
        }
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
        const isSurvival = mode === 'survival' || mode === 'survival_team';
        const isRanked = mode === 'ranked';

        if (isSurvival) {
            UI.botDifficultyInputGroup.style.display = 'block';
            UI.matchDurationInputGroup.style.display = 'block';
            UI.botCountInputGroup.style.display = 'none';
            UI.maxPlayersInputGroup.style.display = 'none';
            UI.survivalConfigGroup.style.display = 'block';
            UI.matchDurationSelect.value = '0';
            UI.matchDurationSelect.disabled = true;

            if (mode === 'survival') {
                UI.survivalConfigLabel.textContent = 'Số người tham gia sinh tồn (Solo)';
                UI.survivalConfigInput.value = 30;
                UI.survivalConfigInput.min = 2;
                UI.survivalConfigInput.max = 100;
            } else {
                UI.survivalConfigLabel.textContent = 'Số đội tham gia sinh tồn (Squad 5 người)';
                UI.survivalConfigInput.value = 4;
                UI.survivalConfigInput.min = 2;
                UI.survivalConfigInput.max = 8;
            }
        } else if (isRanked) {
            // Ranked Solo vs Bots: 10 bots, no timer, no difficulty choice, only 1 player
            UI.botDifficultyInputGroup.style.display = 'none';
            UI.matchDurationInputGroup.style.display = 'none';
            UI.botCountInputGroup.style.display = 'none';
            UI.maxPlayersInputGroup.style.display = 'none';
            UI.survivalConfigGroup.style.display = 'none';
            
            // Hardcode ranked setup
            UI.matchDurationSelect.value = '0'; // Infinite time
            UI.matchDurationSelect.disabled = true;
            UI.botCountInput.value = '10';
            UI.botDifficultySelect.value = 'easy'; // Starts easy, server auto escalates
        } else {
            UI.botDifficultyInputGroup.style.display = 'block';
            UI.matchDurationInputGroup.style.display = 'block';
            UI.survivalConfigGroup.style.display = 'none';
            UI.matchDurationSelect.disabled = false;
            if (UI.matchDurationSelect.value === '0') {
                UI.matchDurationSelect.value = '120';
            }

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
    // Dashboard Bảng Xếp Hạng Modal Logic
    // Helper to format duration in hh:mm:ss format
    window.formatDuration = (totalSeconds) => {
        if (totalSeconds === undefined || totalSeconds === null) return '00:00:00';
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.round(totalSeconds % 60);
        const pad = (num) => String(num).padStart(2, '0');
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    };

    // Helper to format Date into dd/mm/yyyy format
    window.formatDate = (timestamp) => {
        if (!timestamp) return '--/--/----';
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    window.renderDbRankedList = (period) => {
        UI.dbRankedList.innerHTML = '';
        if (!latestRankings || !latestRankings[period] || latestRankings[period].length === 0) {
            UI.dbRankedList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 15px;">Chưa có dữ liệu xếp hạng!</div>';
            return;
        }
        latestRankings[period].forEach((item, index) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            row.style.padding = '6px 0';
            
            const isMe = item.name === loadout.name;
            if (isMe) {
                row.style.color = 'var(--cyber-cyan)';
                row.style.fontWeight = '800';
            } else {
                row.style.color = 'var(--text-primary)';
            }
            
            let trophy = '';
            if (index === 0) trophy = '🥇 ';
            else if (index === 1) trophy = '🥈 ';
            else if (index === 2) trophy = '🥉 ';

            row.innerHTML = `
                <span style="display: flex; flex-direction: column;">
                    <span>${trophy}${index + 1}. ${escapeHTML(item.name)}</span>
                    <span style="font-size: 0.72rem; color: var(--text-secondary); margin-left: 18px; margin-top: 2px;">Đạt ngày: ${window.formatDate(item.timestamp)}</span>
                </span>
                <span>
                    <span style="color: var(--cyber-pink); font-weight: bold; text-shadow: 0 0 5px var(--cyber-pink);">${item.score} Kills</span>
                    <span style="font-size: 0.78rem; color: var(--text-secondary); margin-left: 6px;">(${window.formatDuration(item.duration)})</span>
                </span>
            `;
            UI.dbRankedList.appendChild(row);
        });
    };

    window.setDbActiveTab = (tab) => {
        UI.dbTabDay.style.background = tab === 'day' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
        UI.dbTabDay.style.color = tab === 'day' ? '#fff' : 'var(--text-primary)';

        UI.dbTabWeek.style.background = tab === 'week' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
        UI.dbTabWeek.style.color = tab === 'week' ? '#fff' : 'var(--text-primary)';

        UI.dbTabMonth.style.background = tab === 'month' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
        UI.dbTabMonth.style.color = tab === 'month' ? '#fff' : 'var(--text-primary)';

        if (UI.dbTabYear) {
            UI.dbTabYear.style.background = tab === 'year' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
            UI.dbTabYear.style.color = tab === 'year' ? '#fff' : 'var(--text-primary)';
        }
    };

    // Right-panel Tab switching listeners
    UI.rightTabLobby.addEventListener('click', () => {
        window.audioSystem.init();
        UI.rightTabLobby.classList.add('active');
        UI.rightTabLobby.style.borderBottom = '3px solid var(--cyber-cyan)';
        UI.rightTabLobby.style.color = 'var(--cyber-cyan)';
        UI.rightTabLobby.style.textShadow = 'var(--glow-cyan)';
        UI.rightTabLobby.style.fontWeight = 'bold';

        UI.rightTabRanked.classList.remove('active');
        UI.rightTabRanked.style.borderBottom = 'none';
        UI.rightTabRanked.style.color = 'var(--text-secondary)';
        UI.rightTabRanked.style.textShadow = 'none';
        UI.rightTabRanked.style.fontWeight = 'normal';

        UI.rightLobbyContent.style.display = 'flex';
        UI.rightRankedContent.style.display = 'none';
    });

    // Variable to track currently selected ranking period tab in the lobby sidebar
    // Variable to track currently selected ranking period tab in the lobby sidebar
    window.currentLobbyRankingPeriod = 'day';

    UI.rightTabRanked.addEventListener('click', () => {
        window.audioSystem.init();
        UI.rightTabRanked.classList.add('active');
        UI.rightTabRanked.style.borderBottom = '3px solid var(--cyber-pink)';
        UI.rightTabRanked.style.color = 'var(--cyber-pink)';
        UI.rightTabRanked.style.textShadow = 'var(--glow-pink)';
        UI.rightTabRanked.style.fontWeight = 'bold';

        UI.rightTabLobby.classList.remove('active');
        UI.rightTabLobby.style.borderBottom = 'none';
        UI.rightTabLobby.style.color = 'var(--text-secondary)';
        UI.rightTabLobby.style.textShadow = 'none';
        UI.rightTabLobby.style.fontWeight = 'normal';

        UI.rightLobbyContent.style.display = 'none';
        UI.rightRankedContent.style.display = 'flex';

        // Load rankings realtime from server
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'get_rankings' }));
        }
    });

    UI.dbTabDay.addEventListener('click', () => {
        window.currentLobbyRankingPeriod = 'day';
        window.setDbActiveTab('day');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'get_rankings' }));
        } else {
            window.renderDbRankedList('day');
        }
    });
    UI.dbTabWeek.addEventListener('click', () => {
        window.currentLobbyRankingPeriod = 'week';
        window.setDbActiveTab('week');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'get_rankings' }));
        } else {
            window.renderDbRankedList('week');
        }
    });
    UI.dbTabMonth.addEventListener('click', () => {
        window.currentLobbyRankingPeriod = 'month';
        window.setDbActiveTab('month');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'get_rankings' }));
        } else {
            window.renderDbRankedList('month');
        }
    });
    if (UI.dbTabYear) {
        UI.dbTabYear.addEventListener('click', () => {
            window.currentLobbyRankingPeriod = 'year';
            window.setDbActiveTab('year');
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'get_rankings' }));
            } else {
                window.renderDbRankedList('year');
            }
        });
    }

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
        socket.send(JSON.stringify({
            type: 'start_game',
            isAutoSpectate: isAutoSpectate
        }));
    });

    const leaveRoom = () => {
        socket.send(JSON.stringify({ type: 'leave_room' }));
        localStorage.removeItem('my_hosted_room');
        isHost = false;
        gameActive = false;
        isSpectating = false;
        isAutoSpectate = false;
        if (UI.lobbySpectateCheck) UI.lobbySpectateCheck.checked = false;
        spectateTargetId = null;
        cancelAutoStart(); // Clear any pending rematch timer
        UI.spectatorHud.style.display = 'none';
        if (pingInterval) clearInterval(pingInterval);
        showScreen('menu');
        getLobbyRooms();
    };

    // Auto spectate checkbox listener
    UI.lobbySpectateCheck.addEventListener('change', () => {
        isAutoSpectate = UI.lobbySpectateCheck.checked;
        if (!isAutoSpectate) {
            cancelAutoStart();
        }
    });

    // Ranked Leaderboard tab click listeners and helpers
    window.renderRankedList = (period) => {
        UI.goRankedList.innerHTML = '';
        if (!latestRankings || !latestRankings[period] || latestRankings[period].length === 0) {
            UI.goRankedList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-size: 0.85rem; padding: 15px;">Chưa có dữ liệu xếp hạng!</div>';
            return;
        }
        latestRankings[period].forEach((item, index) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            row.style.padding = '6px 0';
            
            const isMe = item.name === loadout.name;
            if (isMe) {
                row.style.color = 'var(--cyber-cyan)';
                row.style.fontWeight = '800';
            } else {
                row.style.color = 'var(--text-primary)';
            }
            
            let trophy = '';
            if (index === 0) trophy = '🥇 ';
            else if (index === 1) trophy = '🥈 ';
            else if (index === 2) trophy = '🥉 ';

            row.innerHTML = `
                <span style="display: flex; flex-direction: column;">
                    <span>${trophy}${index + 1}. ${escapeHTML(item.name)}</span>
                    <span style="font-size: 0.72rem; color: var(--text-secondary); margin-left: 18px; margin-top: 2px;">Đạt ngày: ${window.formatDate(item.timestamp)}</span>
                </span>
                <span>
                    <span style="color: var(--cyber-pink); font-weight: bold; text-shadow: 0 0 5px var(--cyber-pink);">${item.score} Kills</span>
                    <span style="font-size: 0.78rem; color: var(--text-secondary); margin-left: 6px;">(${window.formatDuration(item.duration)})</span>
                </span>
            `;
            UI.goRankedList.appendChild(row);
        });
    };

    window.setActiveRankedTab = (tab) => {
        UI.rankedTabDay.style.background = tab === 'day' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
        UI.rankedTabDay.style.color = tab === 'day' ? '#fff' : 'var(--text-primary)';

        UI.rankedTabWeek.style.background = tab === 'week' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
        UI.rankedTabWeek.style.color = tab === 'week' ? '#fff' : 'var(--text-primary)';

        UI.rankedTabMonth.style.background = tab === 'month' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
        UI.rankedTabMonth.style.color = tab === 'month' ? '#fff' : 'var(--text-primary)';

        if (UI.rankedTabYear) {
            UI.rankedTabYear.style.background = tab === 'year' ? 'var(--cyber-pink)' : 'rgba(255,255,255,0.05)';
            UI.rankedTabYear.style.color = tab === 'year' ? '#fff' : 'var(--text-primary)';
        }
    };

    UI.rankedTabDay.addEventListener('click', () => {
        window.setActiveRankedTab('day');
        window.renderRankedList('day');
    });
    UI.rankedTabWeek.addEventListener('click', () => {
        window.setActiveRankedTab('week');
        window.renderRankedList('week');
    });
    UI.rankedTabMonth.addEventListener('click', () => {
        window.setActiveRankedTab('month');
        window.renderRankedList('month');
    });
    if (UI.rankedTabYear) {
        UI.rankedTabYear.addEventListener('click', () => {
            window.setActiveRankedTab('year');
            window.renderRankedList('year');
        });
    }

    UI.lobbyLeaveBtn.addEventListener('click', leaveRoom);
    UI.exitGameBtn.addEventListener('click', leaveRoom);
    UI.deathLeaveBtn.addEventListener('click', leaveRoom);
    UI.spectatorLeaveBtn.addEventListener('click', () => {
        cancelAutoStart();
        leaveRoom();
    });

    UI.deathSpectateBtn.addEventListener('click', () => {
        isSpectating = true;
        UI.hudDeathOverlay.classList.add('hidden');
        UI.spectatorHud.style.display = 'flex';
        // Auto pick first available spectate target
        findNextSpectateTarget();
    });

    // Setup initial volume control UI values from audioSystem
    const initVolumeUI = () => {
        const audio = window.audioSystem;
        UI.volumeMuteCheck.checked = audio.isMuted;
        UI.audioIcon.textContent = audio.isMuted ? '🔇' : '🔈';
        UI.audioToggle.style.borderColor = audio.isMuted ? 'rgba(255,255,255,0.1)' : 'var(--cyber-cyan)';
        
        UI.bgmVolumeSlider.value = Math.round(audio.bgmVolume * 100);
        UI.bgmVolumeVal.textContent = `${Math.round(audio.bgmVolume * 100)}%`;
        
        UI.gunVolumeSlider.value = Math.round(audio.gunVolume * 100);
        UI.gunVolumeVal.textContent = `${Math.round(audio.gunVolume * 100)}%`;
        
        UI.otherVolumeSlider.value = Math.round(audio.otherVolume * 100);
        UI.otherVolumeVal.textContent = `${Math.round(audio.otherVolume * 100)}%`;
    };
    initVolumeUI();

    // Toggle volume panel dropdown on click
    UI.audioToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        UI.volumeSettingsPanel.classList.toggle('hidden');
        window.audioSystem.init(); // Play sounds must follow click event trigger
    });

    // Hide volume panel if click outside
    document.addEventListener('click', (e) => {
        if (UI.volumeSettingsPanel && !UI.volumeSettingsPanel.contains(e.target) && e.target !== UI.audioToggle) {
            UI.volumeSettingsPanel.classList.add('hidden');
        }
    });

    // Mute checkbox listener
    UI.volumeMuteCheck.addEventListener('change', () => {
        const mute = UI.volumeMuteCheck.checked;
        window.audioSystem.setMute(mute);
        UI.audioIcon.textContent = mute ? '🔇' : '🔈';
        UI.audioToggle.style.borderColor = mute ? 'rgba(255,255,255,0.1)' : 'var(--cyber-cyan)';
        if (!mute) {
            window.audioSystem.playGameStart();
        }
    });

    // Sliders input listeners
    UI.bgmVolumeSlider.addEventListener('input', () => {
        const val = parseInt(UI.bgmVolumeSlider.value);
        UI.bgmVolumeVal.textContent = `${val}%`;
        window.audioSystem.setVolume('bgm', val / 100);
        // Start or adjust BGM play if not muted
        if (!window.audioSystem.isMuted) {
            window.audioSystem.startBgm();
        }
    });

    UI.gunVolumeSlider.addEventListener('input', () => {
        const val = parseInt(UI.gunVolumeSlider.value);
        UI.gunVolumeVal.textContent = `${val}%`;
        window.audioSystem.setVolume('gun', val / 100);
    });

    UI.otherVolumeSlider.addEventListener('input', () => {
        const val = parseInt(UI.otherVolumeSlider.value);
        UI.otherVolumeVal.textContent = `${val}%`;
        window.audioSystem.setVolume('other', val / 100);
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

        case 'rankings_data': {
            console.log('CLIENT: Received rankings_data from server:', packet.rankings);
            latestRankings = packet.rankings || { day: [], week: [], month: [] };
            const period = window.currentLobbyRankingPeriod || 'day';
            window.setDbActiveTab(period);
            window.renderDbRankedList(period);
            break;
        }

        case 'join_error': {
            alert(packet.message);
            break;
        }

        case 'lobby_update': {
            currentRoomCode = packet.code;
             
            // Reset survival parameters 
            latestSafeZone = null;
            latestCrates = [];
            UI.survivalHud.style.display = 'none';

            const isGameOverOpen = !UI.hudGameOverOverlay.classList.contains('hidden');
            if (!isGameOverOpen) {
                gameActive = false;
                if (pingInterval) clearInterval(pingInterval);
                showScreen('lobby');
            }
            
            UI.lobbyRoomCodeDisplay.textContent = currentRoomCode;
            
            // Set text mode
            let modeViet = 'Người vs Bot (Solo)';
            if (packet.gameMode === 'coop') modeViet = 'Người + Bot phe ta vs Bot địch';
            else if (packet.gameMode === 'pvp') modeViet = 'Người vs Người (FFA)';
            else if (packet.gameMode === 'team') modeViet = 'Team Battle (Xanh vs Đỏ)';
            else if (packet.gameMode === 'survival') modeViet = 'Sinh tồn Solo';
            else if (packet.gameMode === 'survival_team') modeViet = 'Sinh tồn Tổ đội';
            else if (packet.gameMode === 'ranked') modeViet = 'Đấu Xếp Hạng (Ranked Solo)';
            
            let diffViet = 'Vừa';
            if (packet.gameMode === 'ranked') {
                diffViet = 'Tăng dần (Dễ -> Siêu khó)';
            } else {
                if (packet.botDifficulty === 'easy') diffViet = 'Dễ';
                else if (packet.botDifficulty === 'medium') diffViet = 'Vừa';
                else if (packet.botDifficulty === 'hard') diffViet = 'Khó';
                else if (packet.botDifficulty === 'expert') diffViet = 'Chuyên gia';
                else if (packet.botDifficulty === 'nightmare') diffViet = 'Siêu khó';
            }
            
            UI.lobbyRoomInfoText.textContent = `Chế độ: ${modeViet} | Độ khó Bot: ${diffViet}`;

            // Render players
            renderLobbyPlayers(packet.players, packet.hostId);

            // Show/hide team or squad selector based on mode
            const myPlayerObj = packet.players.find(p => isMySocket(p.id));
            if (packet.gameMode === 'team') {
                UI.lobbyTeamSelectArea.style.display = 'block';
                UI.lobbySquadSelectArea.style.display = 'none';
                if (myPlayerObj) {
                    if (myPlayerObj.team === 'blue') {
                        UI.lobbySelectBlueBtn.className = 'cyber-btn lobby-btn-blue-active';
                        UI.lobbySelectRedBtn.className = 'cyber-btn lobby-btn-red-inactive';
                    } else if (myPlayerObj.team === 'red') {
                        UI.lobbySelectBlueBtn.className = 'cyber-btn lobby-btn-blue-inactive';
                        UI.lobbySelectRedBtn.className = 'cyber-btn lobby-btn-red-active';
                    }
                }
            } else if (packet.gameMode === 'survival_team') {
                UI.lobbyTeamSelectArea.style.display = 'none';
                UI.lobbySquadSelectArea.style.display = 'block';
                if (myPlayerObj) {
                    renderSquadButtons(packet.squadCount || 4, myPlayerObj.team);
                }
            } else {
                UI.lobbyTeamSelectArea.style.display = 'none';
                UI.lobbySquadSelectArea.style.display = 'none';
            }

            // Show start button only to host when condition met
            const isMeHost = myPlayerObj && myPlayerObj.isHost;
            
            // Sync host state with browser storage
            if (isMeHost) {
                localStorage.setItem('my_hosted_room', currentRoomCode);
                isHost = true;
            } else {
                if (localStorage.getItem('my_hosted_room') === currentRoomCode) {
                    localStorage.removeItem('my_hosted_room');
                }
                isHost = false;
            }

            const isMultiplayer = packet.gameMode === 'pvp' || packet.gameMode === 'team';
            const playerCount = packet.players.length;

            // Show spectator toggle ONLY in survival or survival_team modes
            const isSurvivalMode = packet.gameMode === 'survival' || packet.gameMode === 'survival_team';
            if (isSurvivalMode) {
                if (UI.lobbySpectateToggleArea) UI.lobbySpectateToggleArea.style.display = 'flex';
            } else {
                if (UI.lobbySpectateToggleArea) UI.lobbySpectateToggleArea.style.display = 'none';
                isAutoSpectate = false;
                if (UI.lobbySpectateCheck) UI.lobbySpectateCheck.checked = false;
            }

            if (isMeHost) {
                // Show start button immediately to host, letting them start solo with bots if they want
                UI.lobbyStartBtn.style.display = 'block';
                UI.lobbyWaitWarning.style.display = 'none';
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
            
            // Clean up state arrays and maps to prevent tàn dư of old matches
            latestGameState = null;
            latestSafeZone = null;
            latestCrates = []; 
            lerpedPositions.clear(); 
            clientPickedItemIds.clear(); // Clear picked items memory!
            particles = [];              // Clear old explosion particles!
            damagePopups = [];           // Clear old damage text popups!
            isSpectating = isAutoSpectate;
            spectateTargetId = null;
            cancelAutoStart(); // Ensure no active timer remains when new game starts
            
            if (isAutoSpectate) {
                UI.spectatorHud.style.display = 'flex';
                UI.hudWeaponStats.style.display = 'none';
                UI.hudPlayerStats.style.display = 'none';
            } else {
                UI.spectatorHud.style.display = 'none';
                UI.hudWeaponStats.style.display = 'block';
                UI.hudPlayerStats.style.display = 'block';
            }

            showScreen('game');
            UI.hudGameOverOverlay.classList.add('hidden'); // Reset overlay
            window.audioSystem.playGameStart();

            // Set HUD room info
            UI.hudRoomCodeDisplay.textContent = currentRoomCode;
            
            let modeViet = 'Người vs Bot (Solo)';
            if (packet.gameMode === 'coop') modeViet = 'Người + Bot phe ta vs Bot địch';
            else if (packet.gameMode === 'pvp') modeViet = 'Người vs Người (FFA)';
            else if (packet.gameMode === 'team') modeViet = 'Team Battle (Xanh vs Đỏ)';
            else if (packet.gameMode === 'survival') modeViet = 'Sinh tồn Solo';
            else if (packet.gameMode === 'survival_team') modeViet = 'Sinh tồn Tổ đội';
            else if (packet.gameMode === 'ranked') modeViet = 'Đấu Xếp Hạng (Ranked Solo)';
            
            let diffViet = 'Vừa';
            if (packet.gameMode === 'ranked') {
                diffViet = 'Tăng dần';
            } else {
                if (packet.botDifficulty === 'easy') diffViet = 'Dễ';
                else if (packet.botDifficulty === 'medium') diffViet = 'Vừa';
                else if (packet.botDifficulty === 'hard') diffViet = 'Khó';
                else if (packet.botDifficulty === 'expert') diffViet = 'Chuyên gia';
                else if (packet.botDifficulty === 'nightmare') diffViet = 'Siêu khó';
            }

            UI.hudRoomModeDisplay.textContent = `${modeViet} | ${diffViet}`;
            
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
            isSpectating = false;
            spectateTargetId = null;
            UI.spectatorHud.style.display = 'none';
            if (pingInterval) clearInterval(pingInterval);
            
            // Hide all potential sub-elements in Game Over screen first
            UI.goMvpContainer.style.display = 'none';
            UI.goTeamsScoreboard.style.display = 'none';
            UI.goSingleScoreboard.style.display = 'none';
            UI.goRankedLeaderboard.style.display = 'none';

            // Show overlay
            UI.hudGameOverOverlay.classList.remove('hidden');
            
            // Determine Win/Loss/Draw
            let mode = packet.gameMode || latestGameState?.gameMode || 'vs_bot';
            const isRanked = mode === 'ranked';
            let won = false;
            let isTeamMode = !isRanked && (mode === 'team' || mode === 'coop' || mode === 'vs_bot' || mode === 'survival_team');
            let isSurvival = !isRanked && (mode === 'survival' || mode === 'survival_team');
            
            if (isRanked) {
                UI.goResultTitle.textContent = 'KẾT THÚC';
                UI.goResultTitle.style.color = 'var(--cyber-pink)';
                UI.goResultTitle.style.textShadow = 'var(--glow-pink)';
                UI.goScoreDetail.textContent = `Bạn bắn hạ được ${packet.rankedScore || 0} Bot!`;
            } else if (isSurvival) {
                if (mode === 'survival') {
                    const amIWinner = packet.winnerName && myPlayerState && packet.winnerName === myPlayerState.name;
                    if (amIWinner) {
                        UI.goResultTitle.textContent = 'CHIẾN TROOP';
                        UI.goResultTitle.style.color = 'var(--cyber-cyan)';
                        UI.goResultTitle.style.textShadow = 'var(--glow-cyan)';
                        UI.goScoreDetail.textContent = 'Bạn là người sống sót cuối cùng!';
                    } else {
                        UI.goResultTitle.textContent = 'HẠ GỤC';
                        UI.goResultTitle.style.color = 'var(--cyber-pink)';
                        UI.goResultTitle.style.textShadow = 'var(--glow-pink)';
                        UI.goScoreDetail.textContent = `Người thắng: ${packet.winnerName}`;
                    }
                } else {
                    // Team Survival
                    let myTeam = myPlayerState?.team || 'blue';
                    if (packet.winnerTeam === myTeam) {
                        UI.goResultTitle.textContent = 'ĐỘI CHIẾN THẮNG';
                        UI.goResultTitle.style.color = 'var(--cyber-cyan)';
                        UI.goResultTitle.style.textShadow = 'var(--glow-cyan)';
                        UI.goScoreDetail.textContent = 'Đội của bạn đã sống sót thành công!';
                    } else {
                        UI.goResultTitle.textContent = 'ĐỘI THẤT BẠI';
                        UI.goResultTitle.style.color = 'var(--cyber-pink)';
                        UI.goResultTitle.style.textShadow = 'var(--glow-pink)';
                        UI.goScoreDetail.textContent = `Đội thắng: ${packet.winnerTeam === 'blue' ? 'Xanh (Blue)' : 'Đỏ (Red)'}`;
                    }
                }
            } else if (isTeamMode) {
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
            } else {
                // Solo FFA mode
                let myTeam = myPlayerState?.team || 'blue';
                const isMeWinner = packet.scoreboard[0] && packet.scoreboard[0].id === myId;
                if (isMeWinner) {
                    UI.goResultTitle.textContent = 'HẠNG 1';
                    UI.goResultTitle.style.color = 'var(--cyber-cyan)';
                    UI.goResultTitle.style.textShadow = 'var(--glow-cyan)';
                } else {
                    UI.goResultTitle.textContent = 'KẾT THÚC';
                    UI.goResultTitle.style.color = 'var(--cyber-yellow)';
                    UI.goResultTitle.style.textShadow = '0 0 10px rgba(255, 189, 3, 0.4)';
                }
                UI.goScoreDetail.textContent = `Bạn đạt hạng: ${packet.scoreboard.findIndex(p => p.id === myId) + 1}`;
            }

            // Render Leaderboard lists
            if (isTeamMode) {
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

            } else if (isRanked) {
                // Ranked Solo vs Bots mode
                UI.goMvpContainer.style.display = 'none';
                UI.goTeamsScoreboard.style.display = 'none';
                UI.goSingleScoreboard.style.display = 'none';
                UI.goRankedLeaderboard.style.display = 'block';

                // Save ranked leaderboard packet data to local variable
                latestRankings = packet.rankings || { day: [], week: [], month: [] };
                
                // Show default tab Day
                window.setActiveRankedTab('day');
                window.renderRankedList('day');
            } else {
                // Free for all or Solo Survival
                UI.goMvpContainer.style.display = 'none';
                UI.goTeamsScoreboard.style.display = 'none';
                UI.goSingleScoreboard.style.display = 'block';
                UI.goRankedLeaderboard.style.display = 'none';

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
                const myScoreEntry = packet.scoreboard.find(e => e.id === myId);
                let myRank = packet.scoreboard.length;
                if (myScoreEntry) {
                    const isSurvivalMode = mode === 'survival' || mode === 'survival_team';
                    myRank = isSurvivalMode ? (myScoreEntry.survivalRank || 1) : (packet.scoreboard.indexOf(myScoreEntry) + 1);
                }
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

            // Show 'Play Again' button for all players unconditionally
            UI.goLobbyBtn.style.display = 'block';

            // Auto-rematch loop for Spectator Mode
            if (isAutoSpectate) {
                cancelAutoStart(); // clear first
                let countdown = 10;
                
                // Add temporary countdown element below scoreboard
                const countdownDiv = document.createElement('div');
                countdownDiv.id = 'autoRematchCountdown';
                countdownDiv.style.marginTop = '20px';
                countdownDiv.style.color = 'var(--cyber-cyan)';
                countdownDiv.style.fontWeight = 'bold';
                countdownDiv.style.fontSize = '1.05rem';
                countdownDiv.style.textShadow = 'var(--glow-cyan)';
                countdownDiv.style.textAlign = 'center';
                countdownDiv.style.textTransform = 'uppercase';
                countdownDiv.style.letterSpacing = '1px';
                countdownDiv.textContent = `Tự động đấu tiếp sau ${countdown}s...`;
                
                UI.hudGameOverOverlay.querySelector('.cyber-panel').appendChild(countdownDiv);

                autoStartIntervalId = setInterval(() => {
                    countdown--;
                    countdownDiv.textContent = `Tự động đấu tiếp sau ${countdown}s...`;
                    if (countdown <= 0) {
                        clearInterval(autoStartIntervalId);
                        autoStartIntervalId = null;
                    }
                }, 1000);

                autoStartTimeoutId = setTimeout(() => {
                    cancelAutoStart();
                    // If Host, start the next game automatically
                    if (isHost && socket && socket.readyState === WebSocket.OPEN) {
                        // Return to lobby first to trigger lobby reset on server
                        socket.send(JSON.stringify({ type: 'return_to_lobby' }));
                        
                        // Wait a tiny bit (200ms) for lobby state to sync, then start
                        setTimeout(() => {
                            if (socket && socket.readyState === WebSocket.OPEN) {
                                socket.send(JSON.stringify({
                                    type: 'start_game',
                                    isAutoSpectate: isAutoSpectate
                                }));
                            }
                        }, 200);
                    }
                }, 10000);
            }
            break;
        }

        case 'game_state': {
            myPlayerState = packet.players.find(p => isMySocket(p.id));

            // Sync survival mode data
            latestSafeZone = packet.safeZone || null;
            latestCrates = packet.crates || [];
            if (packet.aliveCount !== undefined) {
                survivalAliveCount = packet.aliveCount;
                survivalTotalCount = packet.totalCount || packet.players.length;
            }

            // Sync predicted pickups
            if (packet.items) {
                const serverItemIds = new Set(packet.items.map(it => it.id));
                for (let id of clientPickedItemIds) {
                    if (!serverItemIds.has(id)) {
                        clientPickedItemIds.delete(id);
                    }
                }
            }

            const isRankedMode = packet.gameMode === 'ranked';
            const isSurvival = packet.gameMode === 'survival' || packet.gameMode === 'survival_team' || isRankedMode;
            if (isSurvival && latestSafeZone) {
                UI.survivalHud.style.display = 'flex';
                
                if (isRankedMode) {
                    const playerKills = myPlayerState ? (myPlayerState.score || 0) : 0;
                    UI.survivalAliveCountText.textContent = `Bot tiêu diệt: ${playerKills}`;
                    
                    let diffText = 'Dễ';
                    if (playerKills >= 80) diffText = 'Siêu khó';
                    else if (playerKills >= 60) diffText = 'Chuyên gia';
                    else if (playerKills >= 40) diffText = 'Khó';
                    else if (playerKills >= 20) diffText = 'Vừa';
                    
                    if (latestSafeZone.shrinkingTimer > 0) {
                        UI.survivalRingTimer.textContent = `BO CO! [Độ khó: ${diffText}] (${latestSafeZone.shrinkingTimer}s)`;
                        UI.survivalRingTimer.style.borderColor = '#ff003c';
                        UI.survivalRingTimer.style.color = '#ff003c';
                        UI.survivalRingTimer.style.boxShadow = '0 0 15px rgba(255, 0, 60, 0.4)';
                    } else {
                        UI.survivalRingTimer.textContent = `Độ khó Bot: ${diffText}`;
                        UI.survivalRingTimer.style.borderColor = 'var(--cyber-cyan)';
                        UI.survivalRingTimer.style.color = 'var(--cyber-cyan)';
                        UI.survivalRingTimer.style.boxShadow = 'var(--glow-cyan)';
                    }
                } else {
                    UI.survivalAliveCountText.textContent = `Còn sống: ${survivalAliveCount} / ${survivalTotalCount}`;
                    
                    if (latestSafeZone.shrinkingTimer > 0) {
                        UI.survivalRingTimer.textContent = `BO ĐANG CO LẠI! (${latestSafeZone.shrinkingTimer}s)`;
                        UI.survivalRingTimer.style.borderColor = '#ff003c';
                        UI.survivalRingTimer.style.color = '#ff003c';
                        UI.survivalRingTimer.style.boxShadow = '0 0 15px rgba(255, 0, 60, 0.4)';
                    } else {
                        const m = Math.floor(latestSafeZone.timer / 60);
                        const s = latestSafeZone.timer % 60;
                        const timeStr = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
                        UI.survivalRingTimer.textContent = `Bo co sau: ${timeStr}`;
                        UI.survivalRingTimer.style.borderColor = '#ff3c83';
                        UI.survivalRingTimer.style.color = '#ff3c83';
                        UI.survivalRingTimer.style.boxShadow = '0 0 15px rgba(255, 60, 131, 0.2)';
                    }
                }
            } else {
                UI.survivalHud.style.display = 'none';
            }

            // Calculate latency (approximate round-trip)
            const latency = Date.now() - lastStateTime;
            if (latency < 200) {
                ping = Math.round(latency);
            }

            renderGame(packet);
            break;
        }

        case 'audio_trigger': {
            // Spatial sound filtering: only play sound effects within the client viewport (with 300px padding)
            const isGlobalSound = packet.action === 'countdown_tick' || packet.action === 'match_start' || packet.action === 'border_shrink';
            if (!isGlobalSound && packet.x !== undefined && packet.y !== undefined) {
                const hw = canvas.width / 2 + 300;
                const hh = canvas.height / 2 + 300;
                if (packet.x < cameraX - hw || packet.x > cameraX + hw || packet.y < cameraY - hh || packet.y > cameraY + hh) {
                    break; // Outside of view, ignore audio trigger
                }
            }

            if (packet.action === 'shoot') {
                window.audioSystem.playShoot(packet.gunType);
            } else if (packet.action === 'hit') {
                window.audioSystem.playHit();
            } else if (packet.action === 'pickup') {
                window.audioSystem.playPickup(packet.itemType);
            } else if (packet.action === 'countdown_tick') {
                window.audioSystem.playCountdownTick();
            } else if (packet.action === 'match_start') {
                window.audioSystem.playMatchStart();
            } else if (packet.action === 'hit_crate') {
                window.audioSystem.playHitCrate();
            } else if (packet.action === 'break_crate') {
                window.audioSystem.playBreakCrate();
            } else if (packet.action === 'border_shrink') {
                window.audioSystem.playBorderShrink();
            }
            break;
        }

        case 'death_event': {
            if (packet.x !== undefined && packet.y !== undefined) {
                const hw = canvas.width / 2 + 300;
                const hh = canvas.height / 2 + 300;
                if (packet.x >= cameraX - hw && packet.x <= cameraX + hw && packet.y >= cameraY - hh && packet.y <= cameraY + hh) {
                    window.audioSystem.playDeath();
                }
            } else {
                window.audioSystem.playDeath();
            }
            
            // Render local death explosion particles
            spawnDeathParticles(packet.x, packet.y, packet.team);
            
            // Insert into Killfeed
            triggerKillfeed(packet.killerName, packet.victimName);
            break;
        }

        case 'damage_pop': {
            damagePopups.push({
                x: packet.x + (Math.random() - 0.5) * 25,
                y: packet.y - 12,
                text: packet.amount,
                color: packet.isZone ? '#ff3c83' : (packet.isCrit ? '#ff0055' : '#ff7b00'),
                size: packet.isZone ? 11 : (packet.isCrit ? 22 : 13),
                fontStyle: packet.isCrit ? 'bold' : 'normal',
                vy: packet.isZone ? -25 : -40,
                life: 0,
                maxLife: packet.isZone ? 0.6 : 0.8
            });

            if (packet.healAmount > 0 && latestGameState) {
                const attacker = latestGameState.players.find(p => p.id === packet.attackerId) || latestGameState.bots.find(b => b.id === packet.attackerId);
                if (attacker) {
                    damagePopups.push({
                        x: attacker.x + (Math.random() - 0.5) * 15,
                        y: attacker.y - 32,
                        text: `+${packet.healAmount} HP`,
                        color: '#39ff14',
                        size: 12,
                        fontStyle: 'bold',
                        vy: -50,
                        life: 0,
                        maxLife: 1.0
                    });
                }
            }
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

        let teamBadge = '';
        if (p.team === 'blue') {
            teamBadge = '<span class="badge-team" style="background: rgba(0, 204, 255, 0.25); color: var(--cyber-cyan); border: 1px solid var(--cyber-cyan); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left: 8px;">Xanh</span>';
        } else if (p.team === 'red') {
            teamBadge = '<span class="badge-team" style="background: rgba(255, 51, 102, 0.25); color: var(--cyber-pink); border: 1px solid var(--cyber-pink); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left: 8px;">Đỏ</span>';
        } else if (p.team && p.team.startsWith('squad_')) {
            const squadNum = p.team.split('_')[1];
            const squadColors = { '1': '#00f3ff', '2': '#ff3c83', '3': '#ffde07', '4': '#39ff14' };
            const color = squadColors[squadNum] || '#fff';
            teamBadge = `<span class="badge-squad" style="background: rgba(8, 9, 15, 0.6); color: ${color}; border: 1px solid ${color}; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left: 8px;">Squad ${squadNum}</span>`;
        }

        row.innerHTML = `
            <div>
                <span style="display:inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${skinColor}; margin-right: 8px;"></span>
                <span style="font-weight:600;">${escapeHTML(p.name)}</span>
                ${statusBadge}
                ${teamBadge}
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
        
        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp': inputState.w = true; break;
            case 'a': case 'A': case 'ArrowLeft': inputState.a = true; break;
            case 's': case 'S': case 'ArrowDown': inputState.s = true; break;
            case 'd': case 'D': case 'ArrowRight': inputState.d = true; break;
            case 'r': case 'R': inputState.r = true; break;
            case 'h': case 'H': inputState.useHeal = true; break;
            case ' ': inputState.space = true; break;
        }

        // Prevent space/arrow key defaults to avoid page scrolling
        if (e.key === ' ' || e.key.startsWith('Arrow')) {
            e.preventDefault();
        }
        
        syncInput();
    });

    window.addEventListener('keyup', (e) => {
        if (!gameActive) return;

        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp': inputState.w = false; break;
            case 'a': case 'A': case 'ArrowLeft': inputState.a = false; break;
            case 's': case 'S': case 'ArrowDown': inputState.s = false; break;
            case 'd': case 'D': case 'ArrowRight': inputState.d = false; break;
            case 'r': case 'R': inputState.r = false; break;
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
        if (isSpectating) {
            findNextSpectateTarget();
            return;
        }
        inputState.shooting = true;
        syncInput();
    });

    window.addEventListener('mouseup', (e) => {
        if (!gameActive || e.button !== 0) return;
        inputState.shooting = false;
        syncInput();
    });
}

function cancelAutoStart() {
    if (autoStartTimeoutId) {
        clearTimeout(autoStartTimeoutId);
        autoStartTimeoutId = null;
    }
    if (autoStartIntervalId) {
        clearInterval(autoStartIntervalId);
        autoStartIntervalId = null;
    }
}

function syncInput() {
    if (socket && socket.readyState === WebSocket.OPEN && gameActive) {
        socket.send(JSON.stringify({
            type: 'input',
            input: inputState
        }));
        // Reset one-shot useHeal action
        inputState.useHeal = false;
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
        // Update local client-side death particles and floating texts
        updateParticles(dt);
        updateDamagePopups(dt);

        // Find my current player state in latest
        const currentMe = latestGameState.players.find(p => p.id === myId);
        if (currentMe) {
            myPlayerState = currentMe;
        }

        // Client-side Move Prediction for myself to make movement buttery smooth and jitter-free!
        if (myPlayerState && !isSpectating) {
            let predDx = 0;
            let predDy = 0;
            if (inputState.w) predDy -= 1;
            if (inputState.s) predDy += 1;
            if (inputState.a) predDx -= 1;
            if (inputState.d) predDx += 1;

            if (predDx !== 0 || predDy !== 0) {
                const length = Math.sqrt(predDx * predDx + predDy * predDy);
                const speedMultiplier = myPlayerState.speedMultiplier || 1.0;
                const speed = 200 * speedMultiplier; // base speed is 200
                
                myPlayerState.x += (predDx / length) * speed * dt;
                myPlayerState.y += (predDy / length) * speed * dt;
                
                // Constrain locally
                myPlayerState.x = Math.max(20, Math.min(mapWidth - 20, myPlayerState.x));
                myPlayerState.y = Math.max(20, Math.min(mapHeight - 20, myPlayerState.y));
            }
        }

        // Calculate lerped position for camera and local rendering of myself
        cameraX = myPlayerState.x;
        cameraY = myPlayerState.y;

        let spectatingTarget = null;
        if (isSpectating && (spectateTargetId === null || spectateTargetId === undefined)) {
            findNextSpectateTarget();
        }
        if (isSpectating && spectateTargetId !== null) {
            spectatingTarget = latestGameState.players.find(p => p.id === spectateTargetId) || latestGameState.bots.find(b => b.id === spectateTargetId);
            if (spectatingTarget && spectatingTarget.hp > 0) {
                let targetLerp = lerpedPositions.get(spectateTargetId);
                if (!targetLerp) {
                    targetLerp = { x: spectatingTarget.x, y: spectatingTarget.y, angle: spectatingTarget.angle };
                    lerpedPositions.set(spectateTargetId, targetLerp);
                } else {
                    const factor = 1 - Math.exp(-25 * dt);
                    targetLerp.x += (spectatingTarget.x - targetLerp.x) * factor;
                    targetLerp.y += (spectatingTarget.y - targetLerp.y) * factor;
                    targetLerp.angle = lerpAngle(targetLerp.angle, spectatingTarget.angle, factor);
                }
                cameraX = targetLerp.x;
                cameraY = targetLerp.y;

                UI.spectatorTargetName.textContent = `Đang quan sát: ${spectatingTarget.name}${spectatingTarget.isBot ? ' (B)' : ''}`;

                // Auto switch target if target remains stationary / stuck for more than 3 seconds
                const targetDist = Math.hypot(spectatingTarget.x - lastTargetX, spectatingTarget.y - lastTargetY);
                if (targetDist < 1.0) { // Barely moving
                    targetStuckTimer += dt;
                    if (targetStuckTimer >= 3.0) {
                        targetStuckTimer = 0;
                        findNextSpectateTarget();
                    }
                } else {
                    targetStuckTimer = 0;
                    lastTargetX = spectatingTarget.x;
                    lastTargetY = spectatingTarget.y;
                }
            } else {
                targetStuckTimer = 0;
                findNextSpectateTarget();
            }
        }

        if (!spectatingTarget) {
            let myLerp = lerpedPositions.get(myId);
            if (!myLerp) {
                myLerp = { x: myPlayerState.x, y: myPlayerState.y, angle: myPlayerState.angle };
                lerpedPositions.set(myId, myLerp);
            } else {
                const factor = 1 - Math.exp(-25 * dt);
                myLerp.x += (myPlayerState.x - myLerp.x) * factor;
                myLerp.y += (myPlayerState.y - myLerp.y) * factor;
                myLerp.angle = lerpAngle(myLerp.angle, myPlayerState.angle, factor);
            }
            cameraX = myLerp.x;
            cameraY = myLerp.y;
        }

        // Camera positioning (follow cameraX, cameraY center)
        ctx.save();
        ctx.translate(canvas.width / 2 - cameraX, canvas.height / 2 - cameraY);

        // Draw Arena Grid floor
        drawArenaGrid();

        // Draw Map borders
        drawMapBorders();

        // Draw static Obstacles
        drawObstacles();

        // Draw death particles
        drawParticles();

        // Draw dropped items
        if (latestGameState.items) {
            latestGameState.items.forEach(item => {
                if (clientPickedItemIds.has(item.id)) return;
                
                if (myPlayerState) {
                    const dist = Math.hypot(myPlayerState.x - item.x, myPlayerState.y - item.y);
                    if (dist < 45) {
                        clientPickedItemIds.add(item.id);
                        window.audioSystem.playPickup(item.type);
                        return; // Hide immediately
                    }
                }
                drawItem(item);
            });
        }

        // Draw Loot Crates (if survival mode)
        if (latestCrates && latestCrates.length > 0) {
            latestCrates.forEach(drawCrate);
        }

        // Draw Safe Zone (if survival mode)
        if (latestSafeZone) {
            drawSafeZone(latestSafeZone);
        }

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
                    const myLerp = lerpedPositions.get(myId) || player;
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

        // Draw floating damage popups
        damagePopups.forEach(pop => {
            ctx.save();
            ctx.fillStyle = pop.color;
            ctx.font = `${pop.fontStyle} ${pop.size}px Orbitron, sans-serif`;
            ctx.textAlign = 'center';
            ctx.shadowColor = pop.color;
            ctx.shadowBlur = pop.fontStyle === 'bold' ? 10 : 3;
            
            const alpha = Math.max(0, 1.0 - pop.life / pop.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillText(pop.text, pop.x, pop.y);
            ctx.restore();
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

        // Draw Countdown overlay overlay screen
        if (latestGameState.state === 'countdown' && latestGameState.countdownTimer !== undefined) {
            ctx.fillStyle = 'rgba(8, 9, 15, 0.65)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const timerVal = latestGameState.countdownTimer;
            let displayVal = timerVal > 0 ? timerVal : 'GO!';
            
            ctx.font = 'bold 90px Orbitron, sans-serif';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 25;
            ctx.fillStyle = '#00f0ff';
            
            // Pulse zoom scale effect
            const scale = 1.2 - ((Date.now() % 1000) / 1000) * 0.3;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scale, scale);
            ctx.fillText(displayVal, 0, -30);
            ctx.restore();
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '14px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TRẬN ĐẤU SẮP BẮT ĐẦU...', canvas.width / 2, canvas.height / 2 + 80);
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

// Draw dropped buff items on ground
function drawItem(item) {
    ctx.save();
    ctx.translate(item.x, item.y);

    let color = '#39ff14'; // heal (green)
    let symbol = '✚';
    let fontSize = '10px';
    
    if (item.type === 'shield') {
        color = '#00f0ff'; // shield (cyan)
        symbol = '🛡️';
    } else if (item.type === 'damage') {
        color = '#ff007f'; // damage (pink)
        symbol = 'DMG';
        fontSize = '8px';
    } else if (item.type === 'speed') {
        color = '#ffea00'; // speed (yellow)
        symbol = 'SPD';
        fontSize = '8px';
    } else if (item.type === 'crit') {
        color = '#b000ff'; // crit (purple)
        symbol = 'CR';
        fontSize = '9px';
    } else if (item.type === 'vamp') {
        color = '#ff0055'; // vamp (red)
        symbol = 'VP';
        fontSize = '9px';
    } else if (item.type === 'pierce') {
        color = '#a0aab8'; // pierce (steel)
        symbol = 'AP';
        fontSize = '9px';
    } else if (item.type === 'defense') {
        color = '#00ffc4'; // defense (emerald/cyan-green)
        symbol = 'DF';
        fontSize = '9px';
    }

    // Outer glowing ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();

    // Inner background circle
    ctx.fillStyle = 'rgba(10, 11, 18, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    // Symbol character
    ctx.fillStyle = color;
    ctx.font = `${fontSize} Orbitron, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 0, 0);

    ctx.restore();
}

// Draw players and bots
// Draw players and bots as highly-polished cyberpunk humanoid sprites
function drawEntity(entity) {
    if (entity.hp <= 0) return; // Hide dead bodies

    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(entity.angle); // Rotate whole coordinate system to point towards weapon angle

    const isMe = entity.id === myId;
    
    // Define skin / primary styling color
    let mainColor = SKIN_COLORS[entity.skin] || '#fff';
    const gameMode = latestGameState ? latestGameState.gameMode : 'solo';

    if (latestGameState && (gameMode === 'team' || gameMode === 'coop' || gameMode === 'vs_bot')) {
        mainColor = TEAM_COLORS[entity.team] || mainColor;
    } else if (gameMode === 'survival_team' && entity.team && entity.team.startsWith('squad_')) {
        // Apply Golden Ratio Hue for distinct squad colors
        const squadNum = parseInt(entity.team.replace('squad_', '')) || 1;
        mainColor = `hsl(${(squadNum * 137.5) % 360}, 100%, 60%)`;
    } else if (gameMode === 'survival' || gameMode === 'pvp') {
        // Individual unique colors for FFA / Survival Solo using Golden Ratio Hue
        let hash = 0;
        const idStr = String(entity.id);
        for (let i = 0; i < idStr.length; i++) {
            hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash * 137.5) % 360;
        mainColor = `hsl(${hue}, 100%, 60%)`;
    }

    // A. Draw Feet (Humanoid Walking leg swing animation)
    const walkSpeed = 0.015;
    const walkCycle = Math.sin(Date.now() * walkSpeed) * 6; // Leg swing offset
    
    ctx.fillStyle = '#0a0b12';
    ctx.strokeStyle = '#5f6583';
    ctx.lineWidth = 1.5;
    
    // Left foot
    ctx.beginPath();
    ctx.arc(-4 + walkCycle, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right foot
    ctx.beginPath();
    ctx.arc(-4 - walkCycle, 9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // B. Draw Backpack Accessory (drawn behind body)
    if (entity.accessory === 'backpack') {
        ctx.fillStyle = '#1c1f35';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-16, -8, 6, 16, 2);
        ctx.fill();
        ctx.stroke();
    }

    // C. Draw Arms & Hands (Humanoid arm pose holding weapon)
    ctx.fillStyle = '#16192b';
    ctx.strokeStyle = '#474c67';
    ctx.lineWidth = 3.5;

    const isLongGun = ['rifle', 'shotgun', 'sniper'].includes(entity.gunType);

    if (isLongGun) {
        // Two-handed gun hold pose
        // Left arm stretching forward
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(10, -7);
        ctx.stroke();

        // Right arm holding trigger
        ctx.beginPath();
        ctx.moveTo(0, 11);
        ctx.lineTo(14, 5);
        ctx.stroke();

        // Hands (flesh / skin color)
        ctx.fillStyle = '#f3a38c';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(10, -7, 3, 0, Math.PI * 2);
        ctx.arc(14, 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else {
        // One-handed or compact SMG hold pose
        // Right arm pointing straight forward
        ctx.beginPath();
        ctx.moveTo(0, 11);
        ctx.lineTo(14, 4);
        ctx.stroke();

        // Left arm in defensive pose
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(3, -7);
        ctx.stroke();

        // Hands
        ctx.fillStyle = '#f3a38c';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(14, 4, 3, 0, Math.PI * 2);
        ctx.arc(3, -7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // D. Draw Gun (pointing forward, overlaying arms)
    ctx.save();
    ctx.fillStyle = '#1c1f35';
    ctx.strokeStyle = '#5f6583';
    ctx.lineWidth = 1.5;

    switch (entity.gunType) {
        case 'pistol':
            ctx.fillRect(8, 1, 10, 3.5);
            ctx.strokeRect(8, 1, 10, 3.5);
            break;
        case 'smg':
            ctx.fillRect(7, 1, 15, 5);
            ctx.strokeRect(7, 1, 15, 5);
            ctx.fillStyle = '#3a3f58';
            ctx.fillRect(13, 6, 2.5, 6); // Magazine
            break;
        case 'rifle':
            ctx.fillRect(5, 1, 23, 6);
            ctx.strokeRect(5, 1, 23, 6);
            break;
        case 'shotgun':
            ctx.fillRect(7, -1, 17, 8);
            ctx.strokeRect(7, -1, 17, 8);
            break;
        case 'sniper':
            ctx.fillRect(3, 1.5, 31, 4.5);
            ctx.strokeRect(3, 1.5, 31, 4.5);
            // Scope
            ctx.fillStyle = '#474c67';
            ctx.beginPath();
            ctx.arc(16, -1, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
    }
    ctx.restore();

    // E. Draw Torso (Cyber armor panel)
    ctx.fillStyle = '#16192b';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = isMe ? 8 : 2;

    ctx.beginPath();
    ctx.roundRect(-8, -11, 16, 22, 4); // Vai rộng hông thon dạng người
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Glowing core indicator on chest
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.lineTo(1, 0);
    ctx.lineTo(-3, 3);
    ctx.stroke();

    // F. Draw Head
    ctx.fillStyle = '#0b0c10';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // G. Accessories (Helmet, Visor, Shoulder Pads)
    if (entity.accessory === 'helmet') {
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, -Math.PI/2, Math.PI/2);
        ctx.fill();
    }

    if (entity.accessory === 'visor') {
        ctx.strokeStyle = '#ffea00'; // Yellow glowing visor lens
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, -0.4, 0.4);
        ctx.stroke();
    }

    if (entity.accessory === 'shoulder_pad') {
        ctx.fillStyle = '#16192b';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -11, 4, 0, Math.PI * 2); // Left shoulder plate
        ctx.arc(0, 11, 4, 0, Math.PI * 2);  // Right shoulder plate
        ctx.fill();
        ctx.stroke();
    }

    // G2. Buff Auras (visual glow particles rotating around the torso)
    if (entity.buffs) {
        const timeFactor = Date.now() * 0.005;
        
        // Damage Buff Aura (Red/Pink glowing core ring + small stars)
        if (entity.buffs.damage > 0) {
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
            ctx.lineWidth = 2;
            ctx.save();
            ctx.shadowColor = '#ff007f';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(0, 0, 15 + Math.sin(timeFactor) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            
            // Draw rotating flame points
            ctx.fillStyle = '#ff007f';
            for (let i = 0; i < entity.buffs.damage; i++) {
                const angle = timeFactor + (i * Math.PI * 2 / 5);
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * 15, Math.sin(angle) * 15, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Speed Buff Aura (Yellow speed halo + trails)
        if (entity.buffs.speed > 0) {
            ctx.strokeStyle = 'rgba(255, 234, 0, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.save();
            ctx.shadowColor = '#ffea00';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(0, 0, 18 + Math.cos(timeFactor * 1.5) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Speed dashes
            ctx.fillStyle = '#ffea00';
            for (let i = 0; i < entity.buffs.speed; i++) {
                const angle = -timeFactor * 1.2 + (i * Math.PI * 2 / 5);
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * 18, Math.sin(angle) * 18, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // G3. Invincibility Spawn Shield (Glowing cyan shield pulsing around character)
    if (entity.invincible) {
        const shieldPulse = 0.3 + Math.sin(Date.now() * 0.02) * 0.25;
        ctx.strokeStyle = `rgba(0, 240, 255, ${shieldPulse})`;
        ctx.lineWidth = 3;
        ctx.save();
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore(); // Restore translation

    // H. Draw HUD Text & Bars above the player
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    
    let label = entity.name;
    if (entity.team && entity.team.startsWith('squad_')) {
        const squadNum = entity.team.split('_')[1];
        label = `[S${squadNum}] ${label}`;
    }
    if (entity.isBot) label += ` [BOT]`;
    ctx.fillText(label, entity.x, entity.y - 36);

    const barWidth = 36;
    const barHeight = 4;
    const barX = entity.x - barWidth / 2;
    const barY = entity.y - 28;

    // HP Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // HP Fill
    const hpRatio = Math.max(0, entity.hp / entity.maxHp);
    let hpColor = '#39ff14';
    if (entity.team === 'red') hpColor = '#ff3366';
    else if (entity.team === 'blue') hpColor = '#00f0ff';
    else if (entity.team && entity.team.startsWith('squad_')) {
        const squadColors = { squad_1: '#00f3ff', squad_2: '#ff3c83', squad_3: '#ffde07', squad_4: '#39ff14' };
        hpColor = squadColors[entity.team] || hpColor;
    }
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // Shield Fill
    if (entity.maxShield > 0 && entity.shield > 0) {
        const shieldRatio = entity.shield / entity.maxShield;
        ctx.fillStyle = '#00a2ff';
        ctx.fillRect(barX, barY - 2, barWidth * shieldRatio, 1.5);
    }

    // Reloading indicator
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

// Client damage popups updater
function updateDamagePopups(dt) {
    for (let i = damagePopups.length - 1; i >= 0; i--) {
        const pop = damagePopups[i];
        pop.y += pop.vy * dt;
        pop.life += dt;
        if (pop.life >= pop.maxLife) {
            damagePopups.splice(i, 1);
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

    // Render match time countdown (only if not survival mode)
    const isSurvival = latestGameState && (latestGameState.gameMode === 'survival' || latestGameState.gameMode === 'survival_team');
    if (isSurvival) {
        UI.hudTimer.style.display = 'none';
    } else {
        UI.hudTimer.style.display = 'block';
        if (latestGameState && latestGameState.matchTimer !== undefined) {
            const totalSecs = latestGameState.matchTimer;
            const mins = Math.floor(totalSecs / 60);
            const secs = Math.floor(totalSecs % 60);
            UI.hudTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
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

    // Healing Packs Inventory display
    if (UI.hudHealPackText) {
        UI.hudHealPackText.textContent = `${myPlayerState.healingPacks || 0} / 5`;
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

    // Render RPG Buff Badges
    if (UI.hudBuffsList) {
        UI.hudBuffsList.innerHTML = '';
        if (myPlayerState.buffs) {
            const buffMeta = {
                damage: { label: 'DMG', color: '#ff007f', borderColor: 'rgba(255, 0, 127, 0.4)' },
                speed: { label: 'SPD', color: '#ffea00', borderColor: 'rgba(255, 234, 0, 0.4)' },
                crit: { label: 'CRIT', color: '#b000ff', borderColor: 'rgba(176, 0, 255, 0.4)' },
                vamp: { label: 'VAMP', color: '#ff0055', borderColor: 'rgba(255, 0, 85, 0.4)' },
                reveal: { label: 'AP', color: '#a0aab8', borderColor: 'rgba(160, 170, 184, 0.4)' }, // Wait, pierce name in packet is 'pierce'! Let's check!
                pierce: { label: 'AP', color: '#a0aab8', borderColor: 'rgba(160, 170, 184, 0.4)' },
                defense: { label: 'DEF', color: '#00f0ff', borderColor: 'rgba(0, 240, 255, 0.4)' }
            };

            for (let [type, count] of Object.entries(myPlayerState.buffs)) {
                if (count > 0 && buffMeta[type]) {
                    const meta = buffMeta[type];
                    const badge = document.createElement('div');
                    badge.className = 'hud-buff-badge';
                    badge.style.color = meta.color;
                    badge.style.borderColor = meta.borderColor;
                    badge.textContent = `${meta.label} x${count}`;
                    UI.hudBuffsList.appendChild(badge);
                }
            }
        }
    }

    // Ping & FPS
    UI.hudLatencyDisplay.textContent = `FPS: ${fps} | Ping: ${ping}ms`;

    // Leaderboard update
    renderScoreboard();

    // Death overlay handler
    if (myPlayerState.hp <= 0 && !isSpectating) {
        UI.hudDeathOverlay.classList.remove('hidden');
        
        const isSurvival = latestGameState && (latestGameState.gameMode === 'survival' || latestGameState.gameMode === 'survival_team');
        if (isSurvival) {
            UI.deathRespawnText.style.display = 'none';
            UI.deathSurvivalButtons.style.display = 'flex';
        } else {
            UI.deathRespawnText.style.display = 'block';
            UI.deathSurvivalButtons.style.display = 'none';

            if (!window.deathTimeStart) {
                window.deathTimeStart = Date.now();
            }
            const timeElapsed = (Date.now() - window.deathTimeStart) / 1000;
            const countdown = Math.max(0, Math.ceil(3.0 - timeElapsed));
            UI.respawnTimerCount.textContent = countdown;
        }
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

    // Update entity counts
    const alivePlayers = latestGameState.players.filter(p => p.hp > 0).length;
    const aliveBots = latestGameState.bots.filter(b => b.hp > 0).length;
    const elCount = document.getElementById('hudEntityCountDisplay');
    if (elCount) {
        elCount.textContent = `👤 ${alivePlayers} Người | 🤖 ${aliveBots} Bot`;
    }

    // Dynamic difficulty text update for Ranked Mode
    if (latestGameState.gameMode === 'ranked') {
        const myState = latestGameState.players.find(p => p.id === myId);
        const myScore = myState ? (myState.score || 0) : 0;
        const upgradeCount = Math.floor(myScore / 10);
        const statPercent = upgradeCount * 2;
        
        let diffLabel = 'DỄ';
        if (upgradeCount >= 4) diffLabel = 'SIÊU KHÓ';
        else if (upgradeCount === 3) diffLabel = 'CHUYÊN GIA';
        else if (upgradeCount === 2) diffLabel = 'KHÓ';
        else if (upgradeCount === 1) diffLabel = 'VỪA';

        const suffix = statPercent > 0 ? ` (+${statPercent}%)` : '';
        UI.hudRoomModeDisplay.textContent = `ĐẤU XẾP HẠNG (RANKED SOLO) | TĂNG DẦN - ${diffLabel}${suffix}`;
    }
    
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

    // 3. Draw Safe Zone ring on mini-map (if survival mode)
    if (latestSafeZone) {
        const zx = mmX + (latestSafeZone.x / mapWidth) * mmW;
        const zy = mmY + (latestSafeZone.y / mapHeight) * mmH;
        const zr = (latestSafeZone.radius / mapWidth) * mmW; // map is square, width ratio is fine

        ctx.save();
        // Current Zone (cyan neon)
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.stroke();

        // Target Zone Preview (dashed white/cyan)
        if (latestSafeZone.targetRadius && latestSafeZone.targetRadius < latestSafeZone.radius) {
            const tzx = mmX + (latestSafeZone.targetX / mapWidth) * mmW;
            const tzy = mmY + (latestSafeZone.targetY / mapHeight) * mmH;
            const tzr = (latestSafeZone.targetRadius / mapWidth) * mmW;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1.0;
            ctx.setLineDash([2, 2]); // dashes
            ctx.beginPath();
            ctx.arc(tzx, tzy, tzr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]); // reset
        }
        ctx.restore();
    }

    // 4. Draw Airdrop Crates on mini-map (visible to everyone!)
    if (latestCrates && latestCrates.length > 0) {
        latestCrates.forEach(c => {
            if (c.isLarge) {
                drawDot(c.x, c.y, '#ff003c', 3.5, true);
            }
        });
    }

    const isSurvivalMode = latestGameState && (latestGameState.gameMode === 'survival' || latestGameState.gameMode === 'survival_team');
    const isTeamMode = latestGameState && (latestGameState.gameMode === 'team' || latestGameState.gameMode === 'coop' || latestGameState.gameMode === 'survival_team');

    // 5. Draw entities on mini-map
    if (isSpectating) {
        // In spectate mode, draw all alive players and bots
        latestGameState.players.forEach(p => {
            if (p.hp > 0) {
                const lerpPos = lerpedPositions.get(p.id) || p;
                const isCurrentTarget = (p.id === spectateTargetId);
                
                let dotColor = '#ffffff';
                const gMode = latestGameState.gameMode;
                if (gMode === 'survival_team' && p.team && p.team.startsWith('squad_')) {
                    const squadNum = parseInt(p.team.replace('squad_', '')) || 1;
                    dotColor = `hsl(${(squadNum * 137.5) % 360}, 100%, 60%)`;
                } else if (gMode === 'survival' || gMode === 'pvp') {
                    let hash = 0;
                    const idStr = String(p.id);
                    for (let i = 0; i < idStr.length; i++) {
                        hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const hue = Math.abs(hash * 137.5) % 360;
                    dotColor = `hsl(${hue}, 100%, 60%)`;
                } else {
                    dotColor = p.team === 'red' ? '#ff3b30' : p.team === 'blue' ? '#00f0ff' : '#ffffff';
                }
                
                drawDot(lerpPos.x, lerpPos.y, isCurrentTarget ? '#ffea00' : dotColor, isCurrentTarget ? 4 : 3, isCurrentTarget);
            }
        });
        latestGameState.bots.forEach(b => {
            if (b.hp > 0) {
                const lerpPos = lerpedPositions.get(b.id) || b;
                const isCurrentTarget = (b.id === spectateTargetId);
                
                let dotColor = '#00ff66';
                const gMode = latestGameState.gameMode;
                if (gMode === 'survival_team' && b.team && b.team.startsWith('squad_')) {
                    const squadNum = parseInt(b.team.replace('squad_', '')) || 1;
                    dotColor = `hsl(${(squadNum * 137.5) % 360}, 100%, 60%)`;
                } else if (gMode === 'survival' || gMode === 'pvp') {
                    let hash = 0;
                    const idStr = String(b.id);
                    for (let i = 0; i < idStr.length; i++) {
                        hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const hue = Math.abs(hash * 137.5) % 360;
                    dotColor = `hsl(${hue}, 100%, 60%)`;
                } else {
                    dotColor = b.team === 'red' ? '#ff3b30' : b.team === 'blue' ? '#00f0ff' : '#00ff66';
                }
                
                drawDot(lerpPos.x, lerpPos.y, isCurrentTarget ? '#ffea00' : dotColor, isCurrentTarget ? 4 : 3, isCurrentTarget);
            }
        });
    } else {
        // Draw alive teammates on mini-map (only in team modes)
        if (isTeamMode && myTeam && myTeam !== 'none') {
            const isSurvivalTeam = latestGameState.gameMode === 'survival_team';
            let teamColor = '#00f0ff';
            if (isSurvivalTeam && myTeam.startsWith('squad_')) {
                const squadNum = parseInt(myTeam.replace('squad_', '')) || 1;
                teamColor = `hsl(${(squadNum * 137.5) % 360}, 100%, 60%)`;
            }
            
            latestGameState.players.forEach(p => {
                if (p.id !== myId && p.hp > 0 && p.team === myTeam) {
                    const lerpPos = lerpedPositions.get(p.id) || p;
                    drawDot(lerpPos.x, lerpPos.y, teamColor, 3);
                }
            });
            latestGameState.bots.forEach(b => {
                if (b.hp > 0 && b.team === myTeam) {
                    const lerpPos = lerpedPositions.get(b.id) || b;
                    drawDot(lerpPos.x, lerpPos.y, teamColor, 3);
                }
            });
        }

        // Draw Self (drawn on top with yellow pulsing indicator) using lerp position
        const myLerpPos = lerpedPositions.get(myId) || myPlayerState;
        drawDot(myLerpPos.x, myLerpPos.y, '#ffea00', 4.5, true);
    }

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

// Render Loot Crates for Survival Mode
function drawCrate(crate) {
    ctx.save();
    
    const isLarge = crate.isLarge || false;
    const w = crate.w || 40;
    const h = crate.h || 40;

    if (isLarge) {
        // Red neon futuristic Airdrop chest
        ctx.fillStyle = '#ff003c';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3.5;
        
        ctx.shadowColor = '#ff003c';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillRect(crate.x, crate.y, w, h);
        ctx.strokeRect(crate.x, crate.y, w, h);
        
        // Draw cyber decals on the Airdrop crate
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(crate.x + 6, crate.y + 6, w - 12, 4);
        ctx.fillRect(crate.x + 6, crate.y + h - 10, w - 12, 4);
        ctx.fillRect(crate.x + w/2 - 2, crate.y + 10, 4, h - 20);

        // Draw HUD Label on top of Airdrop
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 10px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AIRDROP', crate.x + w/2, crate.y - 12);
    } else {
        // Regular wooden chest
        ctx.fillStyle = '#8B4513';
        ctx.strokeStyle = '#5c2d0c';
        ctx.lineWidth = 3;
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        ctx.fillRect(crate.x, crate.y, w, h);
        ctx.strokeRect(crate.x, crate.y, w, h);
        
        ctx.shadowColor = 'transparent';

        ctx.beginPath();
        ctx.moveTo(crate.x + 4, crate.y + 4);
        ctx.lineTo(crate.x + w - 4, crate.y + h - 4);
        ctx.moveTo(crate.x + w - 4, crate.y + 4);
        ctx.lineTo(crate.x + 4, crate.y + h - 4);
        ctx.strokeStyle = '#5c2d0c';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#6e350d';
        ctx.fillRect(crate.x + 2, crate.y + 2, w - 4, 4);
        ctx.fillRect(crate.x + 2, crate.y + h - 6, w - 4, 4);
    }

    // Draw Crate HP bar
    if (crate.hp < crate.maxHp) {
        const hpPercent = crate.hp / crate.maxHp;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(crate.x, crate.y - (isLarge ? 8 : 10), w, 4);
        
        ctx.fillStyle = isLarge ? '#00f0ff' : '#ff3c83';
        ctx.fillRect(crate.x, crate.y - (isLarge ? 8 : 10), w * hpPercent, 4);
    }

    ctx.restore();
}

// Render Shrinking Ring Safe Zone boundary and toxic area
function drawSafeZone(zone) {
    ctx.save();
    
    // Draw current boundary circle (cyan neon)
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 15;
    ctx.stroke();

    // Draw upcoming target boundary ring (dashed white line)
    if (zone.targetRadius > 0 && zone.targetRadius < zone.radius) {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(zone.targetX, zone.targetY, zone.targetRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([12, 8]); // dashed pattern
        ctx.stroke();
        ctx.restore();
    }

    // Draw toxic blue/purple outer overlay (covering the entire map bounds correctly)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-over';
    
    ctx.beginPath();
    // Cover a massive area to ensure even 20k/30k maps are fully covered
    const pad = 5000;
    ctx.rect(-pad, -pad, mapWidth + pad * 2, mapHeight + pad * 2);
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255, 60, 131, 0.12)';
    ctx.fill();

    ctx.restore();
}

// Generate dynamic squad selection buttons in Lobby UI
function renderSquadButtons(squadCount, mySquad) {
    UI.lobbySquadBtnsContainer.innerHTML = '';
    
    // Set grid columns dynamically based on squad count
    if (squadCount > 4) {
        UI.lobbySquadBtnsContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
    } else {
        UI.lobbySquadBtnsContainer.style.gridTemplateColumns = '1fr 1fr';
    }

    for (let i = 1; i <= squadCount; i++) {
        const sq = `squad_${i}`;
        const btn = document.createElement('button');
        btn.className = 'cyber-btn';
        btn.textContent = `Squad ${i}`;
        btn.style.padding = '8px 10px';
        btn.style.fontSize = '0.8rem';
        
        if (mySquad === sq) {
            btn.style.background = 'var(--cyber-cyan)';
            btn.style.color = '#08090f';
            btn.style.borderColor = 'var(--cyber-cyan)';
            btn.style.boxShadow = 'var(--glow-cyan)';
            btn.style.fontWeight = 'bold';
        }

        btn.addEventListener('click', () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'change_team', team: sq }));
            }
        });

        UI.lobbySquadBtnsContainer.appendChild(btn);
    }
}

// Find next alive player or bot to spectate
function findNextSpectateTarget() {
    if (!latestGameState) return;

    // Filter alive players and bots
    const aliveEntities = [
        ...latestGameState.players.filter(p => p.hp > 0),
        ...latestGameState.bots.filter(b => b.hp > 0)
    ];

    if (aliveEntities.length === 0) {
        spectateTargetId = null;
        UI.spectatorTargetName.textContent = 'Không có ai để quan sát';
        return;
    }

    // Find current target index
    let idx = aliveEntities.findIndex(ent => ent.id === spectateTargetId);
    
    // Pick next target index (looping back if index reached the end)
    let nextIdx = (idx + 1) % aliveEntities.length;
    spectateTargetId = aliveEntities[nextIdx].id;

    UI.spectatorTargetName.textContent = `Đang quan sát: ${aliveEntities[nextIdx].name}${aliveEntities[nextIdx].isBot ? ' (B)' : ''}`;
}
