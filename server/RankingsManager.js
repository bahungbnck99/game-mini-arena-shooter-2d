const fs = require('fs');
const path = require('path');

class RankingsManager {
    constructor() {
        this.filePath = path.join(__dirname, 'rankings.json');
        this.scores = [];
        this.loadScores();
    }

    /**
     * Load historical scores from rankings.json.
     */
    loadScores() {
        try {
            let fileLoaded = false;
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                if (data.trim()) {
                    this.scores = JSON.parse(data);
                    if (!Array.isArray(this.scores)) {
                        this.scores = [];
                    } else {
                        fileLoaded = true;
                    }
                }
            }

            // Seed mock scores if empty
            if (!fileLoaded || this.scores.length === 0) {
                const mockBots = [
                    { name: "SlayerBot", score: 95, duration: 320 },
                    { name: "NeoShooter", score: 82, duration: 390 },
                    { name: "CyberSoldier", score: 71, duration: 440 },
                    { name: "AlphaPhantom", score: 63, duration: 510 },
                    { name: "RangerElite", score: 55, duration: 580 },
                    { name: "GhostStalker", score: 48, duration: 620 },
                    { name: "StormTracer", score: 39, duration: 690 },
                    { name: "ViperZero", score: 28, duration: 750 },
                    { name: "ShadowFiend", score: 19, duration: 810 },
                    { name: "RecruitBot", score: 8, duration: 890 }
                ];
                const now = Date.now();
                this.scores = mockBots.map((b, index) => ({
                    name: b.name,
                    score: b.score,
                    duration: b.duration,
                    timestamp: now - index * 60 * 1000 // interval of 1 minute
                }));
                this.saveScores();
            }
        } catch (err) {
            console.error('Lỗi load file rankings.json, reset rỗng:', err);
            this.scores = [];
        }
    }

    /**
     * Save scores back to rankings.json.
     */
    saveScores() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.scores, null, 2), 'utf8');
        } catch (err) {
            console.error('Không thể ghi file rankings.json:', err);
        }
    }

    /**
     * Submit a new ranked score.
     */
    submitScore(name, score, duration) {
        if (!name || score <= 0) return this.getTopRankings();

        // Add new score record
        this.scores.push({
            name: String(name).substring(0, 16),
            score: parseInt(score) || 0,
            duration: parseInt(duration) || 0,
            timestamp: Date.now()
        });

        // Optimize storage: Keep only last 1000 scores to avoid massive JSON growth
        if (this.scores.length > 1000) {
            this.scores.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                const aDur = a.duration !== undefined ? a.duration : 999999;
                const bDur = b.duration !== undefined ? b.duration : 999999;
                if (aDur !== bDur) return aDur - bDur;
                return b.timestamp - a.timestamp;
            });
            this.scores = this.scores.slice(0, 1000);
        }

        this.saveScores();
        return this.getTopRankings();
    }

    /**
     * Get dynamically filtered Top 10 rankings for Day, Week, and Month.
     */
    getTopRankings() {
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const oneWeekMs = 7 * oneDayMs;
        const oneMonthMs = 30 * oneDayMs;
        const oneYearMs = 365 * oneDayMs;

        const filterAndSort = (timeLimitMs) => {
            return this.scores
                .filter(s => now - s.timestamp <= timeLimitMs)
                .sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    const aDur = a.duration !== undefined ? a.duration : 999999;
                    const bDur = b.duration !== undefined ? b.duration : 999999;
                    if (aDur !== bDur) return aDur - bDur;
                    return b.timestamp - a.timestamp;
                })
                .slice(0, 10)
                .map(s => ({ name: s.name, score: s.score, duration: s.duration, timestamp: s.timestamp }));
        };

        return {
            day: filterAndSort(oneDayMs),
            week: filterAndSort(oneWeekMs),
            month: filterAndSort(oneMonthMs),
            year: filterAndSort(oneYearMs)
        };
    }
}

module.exports = new RankingsManager();
