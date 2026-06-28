// public/js/audio.js

class AudioSystem {
    constructor() {
        this.ctx = null;
        
        // Load volume settings from localStorage, or set defaults
        this.bgmVolume = parseFloat(localStorage.getItem('bgmVolume') || '0.3');
        this.gunVolume = parseFloat(localStorage.getItem('gunVolume') || '0.4');
        this.otherVolume = parseFloat(localStorage.getItem('otherVolume') || '0.4');
        
        // Start muted to comply with browser autoplay policies
        this.isMuted = localStorage.getItem('isMuted') === 'true';
        
        this.bgmInterval = null;
        this.bgmStep = 0;
    }

    /**
     * Initialize AudioContext upon user interaction.
     */
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.startBgm();
    }

    /**
     * Set volume settings
     */
    setVolume(type, val) {
        if (type === 'bgm') {
            this.bgmVolume = val;
            localStorage.setItem('bgmVolume', val.toString());
        } else if (type === 'gun') {
            this.gunVolume = val;
            localStorage.setItem('gunVolume', val.toString());
        } else if (type === 'other') {
            this.otherVolume = val;
            localStorage.setItem('otherVolume', val.toString());
        }
    }

    /**
     * Set mute state
     */
    setMute(mute) {
        this.isMuted = mute;
        localStorage.setItem('isMuted', mute.toString());
        if (!mute) {
            this.init();
            this.startBgm();
        } else {
            this.stopBgm();
        }
    }

    /**
     * Toggle mute state.
     */
    toggleMute() {
        this.setMute(!this.isMuted);
        return this.isMuted;
    }

    /**
     * Play procedural background music (BGM)
     * Soft chiptune neon lofi loop
     */
    startBgm() {
        if (this.bgmInterval || this.isMuted) return;
        this.bgmStep = 0;
        
        // Intense cyberpunk combat bass notes (A1, A1, D2, A1, C2, C2, F2, C2, etc.)
        const bassNotes = [
            55.00, 55.00, 73.42, 55.00,
            65.41, 65.41, 87.31, 65.41,
            73.42, 73.42, 98.00, 73.42,
            55.00, 55.00, 73.42, 55.00
        ];

        // Exciting combat lead melody progression
        const leadNotes = [
            220.00, 0, 261.63, 293.66,
            329.63, 0, 392.00, 329.63,
            293.66, 0, 261.63, 220.00,
            196.00, 220.00, 261.63, 293.66
        ];

        // Helpers to play chiptune beat components
        const playKick = (vol, time) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(130, time);
            osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);
            gain.gain.setValueAtTime(vol * 0.45, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
            osc.start(time);
            osc.stop(time + 0.12);
        };

        const playSnare = (vol, time) => {
            // White noise crunch
            this.playNoise(vol * 0.35, 0.08, time);
            // Low mid thud
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, time);
            osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);
            gain.gain.setValueAtTime(vol * 0.15, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
            osc.start(time);
            osc.stop(time + 0.08);
        };

        this.bgmInterval = setInterval(() => {
            if (this.isMuted || !this.ctx || this.bgmVolume <= 0) return;
            const now = this.ctx.currentTime;
            const step = this.bgmStep;
            
            // 1. Synth Bassline (Sawtooth/Triangle pulse)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = step % 4 === 0 ? 'sawtooth' : 'triangle';
            const freq = bassNotes[step % bassNotes.length];
            osc.frequency.setValueAtTime(freq, now);
            const bassVol = 0.08 * this.bgmVolume;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(bassVol, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.2);

            // 2. Synth Lead Melody (Exciting electronic tune)
            const leadFreq = leadNotes[step % leadNotes.length];
            if (leadFreq > 0) {
                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                leadOsc.connect(leadGain);
                leadGain.connect(this.ctx.destination);
                leadOsc.type = 'sawtooth';
                leadOsc.frequency.setValueAtTime(leadFreq, now);
                // Vibrato effect
                leadOsc.frequency.linearRampToValueAtTime(leadFreq + 4, now + 0.1);
                const leadVol = 0.035 * this.bgmVolume; // Soft melody
                leadGain.gain.setValueAtTime(0, now);
                leadGain.gain.linearRampToValueAtTime(leadVol, now + 0.04);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                leadOsc.start(now);
                leadOsc.stop(now + 0.2);
            }

            // 3. Drum Beats (Four-on-the-floor Kick and backbeat Snare)
            const beatStep = step % 8;
            if (beatStep === 0 || beatStep === 4) {
                playKick(this.bgmVolume, now); // Kick on 1 and 5
            } else if (beatStep === 2 || beatStep === 6) {
                playSnare(this.bgmVolume, now); // Snare on 3 and 7
            } else if (step % 2 === 1) {
                this.playNoise(0.012 * this.bgmVolume, 0.04, now); // Hi-hat tick
            }
            
            this.bgmStep++;
        }, 220); // 220ms per note (~136 BPM combat beat)
    }

    stopBgm() {
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
    }

    /**
     * Play procedural shoot sound.
     */
    playShoot(gunType) {
        if (this.isMuted || !this.ctx || this.gunVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        switch (gunType) {
            case 'pistol':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);
                gain.gain.setValueAtTime(0.25 * this.gunVolume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'smg':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(350, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
                gain.gain.setValueAtTime(0.18 * this.gunVolume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
                break;

            case 'rifle':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
                gain.gain.setValueAtTime(0.35 * this.gunVolume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                
                // Add noise for crunchiness
                this.playNoise(0.08 * this.gunVolume, 0.2, now);

                osc.start(now);
                osc.stop(now + 0.2);
                break;

            case 'shotgun':
                // Loud blast, multiple noise sweeps
                this.playNoise(0.5 * this.gunVolume, 0.35, now);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(5, now + 0.3);
                gain.gain.setValueAtTime(0.4 * this.gunVolume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;

            case 'sniper':
                // Heavy deep blast
                this.playNoise(0.35 * this.gunVolume, 0.5, now);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(1, now + 0.5);
                gain.gain.setValueAtTime(0.5 * this.gunVolume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
        }
    }

    /**
     * Play procedural bullet impact sound.
     */
    playHit() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

        gain.gain.setValueAtTime(0.12 * this.otherVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    /**
     * Play procedural death sound.
     */
    playDeath() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.5);

        gain.gain.setValueAtTime(0.35 * this.otherVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.start(now);
        osc.stop(now + 0.5);

        // Add a long white noise decay
        this.playNoise(0.25 * this.otherVolume, 0.6, now);
    }

    /**
     * Play game start countdown beeps.
     */
    playGameStart() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;

        const playBeep = (freq, time, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.15 * this.otherVolume, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
            
            osc.start(time);
            osc.stop(time + duration);
        };

        playBeep(440, now, 0.1);
        playBeep(440, now + 0.15, 0.1);
        playBeep(880, now + 0.3, 0.3);
    }

    playCountdownTick() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.12 * this.otherVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playMatchStart() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.2 * this.otherVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * Play customized procedural buff pickup tone based on type.
     */
    playPickup(itemType) {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (itemType === 'heal') {
            // Heartwarming ascending healing chord
            osc.type = 'sine';
            osc.frequency.setValueAtTime(261.63, now); // C4
            osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.2); // C5
            gain.gain.setValueAtTime(0.2 * this.otherVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (itemType === 'shield') {
            // High-resonance electronic shield boost tone
            const osc2 = this.ctx.createOscillator();
            osc2.connect(gain);
            osc.type = 'triangle';
            osc2.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.25);
            osc2.frequency.setValueAtTime(155, now);
            osc2.frequency.exponentialRampToValueAtTime(605, now + 0.25);
            gain.gain.setValueAtTime(0.18 * this.otherVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc2.start(now);
            osc.stop(now + 0.25);
            osc2.stop(now + 0.25);
        } else {
            // Generic buff pickup tone
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
            gain.gain.setValueAtTime(0.15 * this.otherVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    }

    /**
     * Generate synthetic white noise.
     */
    playNoise(volume, duration, time) {
        if (!this.ctx) return;
        
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, time);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(volume, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseNode.start(time);
        noiseNode.stop(time + duration);
    }

    /**
     * Play wooden crate hit sound.
     */
    playHitCrate() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

        gain.gain.setValueAtTime(0.12 * this.otherVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    /**
     * Play wooden crate shatter sound.
     */
    playBreakCrate() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        
        // 1. Low Thud
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.25);
        gain.gain.setValueAtTime(0.2 * this.otherVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);

        // 2. Wooden crunch noise
        this.playNoise(0.1 * this.otherVolume, 0.22, now);
    }

    /**
     * Play border ring shrink siren synth.
     */
    playBorderShrink() {
        if (this.isMuted || !this.ctx || this.otherVolume <= 0) return;
        this.init();

        const now = this.ctx.currentTime;
        const duration = 3.0; // 3-second alarm duration
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        // Fire engine siren wah-wah sweeps: 6 frequency sweep cycles in 3.0s (0.5s per cycle)
        for (let i = 0; i < 6; i++) {
            const t = now + i * 0.5;
            osc1.frequency.setValueAtTime(450, t);
            osc1.frequency.linearRampToValueAtTime(750, t + 0.25);
            osc1.frequency.linearRampToValueAtTime(450, t + 0.5);

            osc2.frequency.setValueAtTime(455, t);
            osc2.frequency.linearRampToValueAtTime(755, t + 0.25);
            osc2.frequency.linearRampToValueAtTime(455, t + 0.5);
        }

        gain.gain.setValueAtTime(0.12 * this.otherVolume, now);
        gain.gain.setValueAtTime(0.12 * this.otherVolume, now + duration - 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    }
}

// Global audio instance
window.audioSystem = new AudioSystem();
