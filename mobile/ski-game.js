// Ski Slope Game
let currentGame = null;

class SkiGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.gameState = 'playing';
        this.score = 0;
        this.distance = 0;
        this.speed = 3;
        this.maxSpeed = 12;
        
        // Player
        this.player = {
            x: 400,
            y: 100,
            width: 30,
            height: 40,
            vx: 0,
            direction: 0 // -1 left, 0 straight, 1 right
        };
        
        // Obstacles
        this.obstacles = [];
        this.obstacleSpawnTimer = 0;
        this.obstacleSpawnRate = 60;
        
        // Parallax background
        this.trees = [];
        this.clouds = [];
        this.sideTrees = []; // Trees on the edges of the slope
        this.snowflakes = []; // Falling snow effect
        this.slopeTracks = []; // Ski tracks on the slope
        this.flags = []; // Racing flags on the sides
        
        // Generate initial background
        this.generateBackground();
        
        // Input
        this.keys = {};
        this.touchLeft = false;
        this.touchRight = false;
        this.setupInput();
        this.setupTouchControls();
        
        // Audio context
        this.audioContext = null;
        this.musicInterval = null;
        this.initAudio();
        
        // Update UI
        this.updateUI();
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playNote(frequency, startTime, duration, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }
    
    playBass(frequency, startTime, duration) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sawtooth';
        
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 5;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }
    
    playDrum(type, startTime) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        if (type === 'kick') {
            oscillator.frequency.setValueAtTime(150, startTime);
            oscillator.frequency.exponentialRampToValueAtTime(0.01, startTime + 0.5);
            gainNode.gain.setValueAtTime(0.8, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
            oscillator.type = 'sine';
        } else if (type === 'snare') {
            const noise = this.audioContext.createBufferSource();
            const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.2, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            noise.buffer = buffer;
            
            const noiseGain = this.audioContext.createGain();
            const noiseFilter = this.audioContext.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1000;
            
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.audioContext.destination);
            
            noiseGain.gain.setValueAtTime(0.3, startTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            
            noise.start(startTime);
            noise.stop(startTime + 0.2);
            return;
        } else if (type === 'hihat') {
            const noise = this.audioContext.createBufferSource();
            const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.05, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            noise.buffer = buffer;
            
            const noiseGain = this.audioContext.createGain();
            const noiseFilter = this.audioContext.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 8000;
            
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.audioContext.destination);
            
            noiseGain.gain.setValueAtTime(0.1, startTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);
            
            noise.start(startTime);
            noise.stop(startTime + 0.05);
            return;
        }
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.5);
    }
    
    startMusic() {
        if (!this.audioContext) return;
        
        const bpm = 126;
        const beatDuration = 60 / bpm;
        const barDuration = beatDuration * 4;
        
        // Disco house chord progression (inspired by French house style)
        const playPattern = () => {
            if (this.gameState !== 'playing') return;
            
            const now = this.audioContext.currentTime;
            
            // 4-bar pattern
            for (let bar = 0; bar < 4; bar++) {
                const barStart = now + bar * barDuration;
                
                // Four-on-the-floor kick pattern
                for (let beat = 0; beat < 4; beat++) {
                    this.playDrum('kick', barStart + beat * beatDuration);
                }
                
                // Snare on beats 2 and 4
                this.playDrum('snare', barStart + beatDuration * 1);
                this.playDrum('snare', barStart + beatDuration * 3);
                
                // Hi-hats on eighth notes
                for (let i = 0; i < 8; i++) {
                    this.playDrum('hihat', barStart + i * beatDuration / 2);
                }
                
                // Bass line (funky pattern)
                const bassNotes = [
                    [110, 0, 0.4],      // A2
                    [110, 0.5, 0.3],    // A2
                    [146.83, 1, 0.4],   // D3
                    [110, 1.5, 0.3],    // A2
                    [123.47, 2, 0.4],   // B2
                    [123.47, 2.5, 0.3], // B2
                    [164.81, 3, 0.4],   // E3
                    [123.47, 3.5, 0.3]  // B2
                ];
                
                bassNotes.forEach(([freq, offset, dur]) => {
                    this.playBass(freq, barStart + offset * beatDuration, dur);
                });
                
                // Chord stabs (house style)
                if (bar % 2 === 0) {
                    // Major chord (A major)
                    const chordStart = barStart + beatDuration * 0.5;
                    this.playNote(440, chordStart, 0.3, 'sawtooth');    // A
                    this.playNote(554.37, chordStart, 0.3, 'sawtooth'); // C#
                    this.playNote(659.25, chordStart, 0.3, 'sawtooth'); // E
                    
                    const chordStart2 = barStart + beatDuration * 2.5;
                    this.playNote(440, chordStart2, 0.3, 'sawtooth');
                    this.playNote(554.37, chordStart2, 0.3, 'sawtooth');
                    this.playNote(659.25, chordStart2, 0.3, 'sawtooth');
                } else {
                    // Different chord (D major)
                    const chordStart = barStart + beatDuration * 0.5;
                    this.playNote(293.66, chordStart, 0.3, 'sawtooth'); // D
                    this.playNote(369.99, chordStart, 0.3, 'sawtooth'); // F#
                    this.playNote(440, chordStart, 0.3, 'sawtooth');    // A
                    
                    const chordStart2 = barStart + beatDuration * 2.5;
                    this.playNote(293.66, chordStart2, 0.3, 'sawtooth');
                    this.playNote(369.99, chordStart2, 0.3, 'sawtooth');
                    this.playNote(440, chordStart2, 0.3, 'sawtooth');
                }
                
                // Add some melody notes (filtered lead)
                if (bar === 0 || bar === 2) {
                    const melodyStart = barStart + beatDuration * 3.75;
                    this.playNote(880, melodyStart, 0.2, 'square');
                    this.playNote(1108.73, melodyStart + 0.1, 0.2, 'square');
                }
            }
            
            // Schedule next pattern
            this.musicInterval = setTimeout(playPattern, barDuration * 4 * 1000 - 100);
        };
        
        playPattern();
    }
    
    stopMusic() {
        if (this.musicInterval) {
            clearTimeout(this.musicInterval);
            this.musicInterval = null;
        }
    }
    
    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            if (e.key === 'Escape' && this.gameState === 'playing') {
                this.gameState = 'paused';
                this.stopMusic();
                e.preventDefault();
            } else if (e.key === 'Escape' && this.gameState === 'paused') {
                this.gameState = 'playing';
                this.startMusic();
                e.preventDefault();
            }
            
            // Return to main menu with M key when paused
            if (e.key === 'm' && this.gameState === 'paused') {
                this.returnToMainMenu();
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }
    
    setupTouchControls() {
        const leftBtn = document.getElementById('ski-left-btn');
        const rightBtn = document.getElementById('ski-right-btn');
        
        if (!leftBtn || !rightBtn) return; // Not in mobile version
        
        // Left button
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameState === 'playing') {
                this.touchLeft = true;
            }
        });
        
        leftBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchLeft = false;
        });
        
        // Right button
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameState === 'playing') {
                this.touchRight = true;
            }
        });
        
        rightBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchRight = false;
        });
    }
    
    showSkiControls() {
        const topwarControls = document.getElementById('topwar-touch-controls');
        const skiControls = document.getElementById('ski-touch-controls');
        if (topwarControls) topwarControls.classList.add('hidden');
        if (skiControls) skiControls.classList.remove('hidden');
    }
    
    hideAllTouchControls() {
        const topwarControls = document.getElementById('topwar-touch-controls');
        const skiControls = document.getElementById('ski-touch-controls');
        if (topwarControls) topwarControls.classList.add('hidden');
        if (skiControls) skiControls.classList.add('hidden');
    }
    
    generateBackground() {
        // No side trees needed - slope is full screen
        // Keep trees array empty but maintain structure for compatibility
        this.trees = [];
        
        // Generate edge markers (subtle trees at the very edges)
        for (let i = 0; i < 12; i++) {
            this.sideTrees.push({
                x: Math.random() < 0.5 ? 10 + Math.random() * 20 : this.canvas.width - 30 + Math.random() * 20,
                y: Math.random() * 700,
                size: 20 + Math.random() * 10
            });
        }
        
        // Generate clouds
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * 800,
                y: Math.random() * 200,
                size: 40 + Math.random() * 30,
                speed: 0.2 + Math.random() * 0.3
            });
        }
        
        // Generate snowflakes
        for (let i = 0; i < 50; i++) {
            this.snowflakes.push({
                x: Math.random() * 800,
                y: Math.random() * 600,
                size: 2 + Math.random() * 3,
                speed: 0.5 + Math.random() * 1,
                drift: (Math.random() - 0.5) * 0.5
            });
        }
        
        // Generate racing flags on the sides
        for (let i = 0; i < 10; i++) {
            this.flags.push({
                x: Math.random() < 0.5 ? 30 : this.canvas.width - 30,
                y: i * 80 + Math.random() * 40,
                color: i % 2 === 0 ? '#FF0000' : '#FFD700',
                sway: Math.random() * Math.PI * 2
            });
        }
    }
    
    spawnObstacle() {
        const types = ['tree', 'skier', 'bear', 'rock', 'snowman', 'log', 'sign', 'jump'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        // Spawn across full screen width
        const obstacle = {
            x: 50 + Math.random() * 700,
            y: this.canvas.height + 50,
            type: type,
            width: type === 'bear' ? 50 : (type === 'skier' ? 25 : (type === 'snowman' ? 45 : (type === 'log' ? 50 : (type === 'sign' ? 30 : (type === 'jump' ? 60 : 30))))),
            height: type === 'bear' ? 40 : (type === 'skier' ? 35 : (type === 'snowman' ? 50 : (type === 'log' ? 20 : (type === 'sign' ? 45 : (type === 'jump' ? 15 : 40))))),
            speed: type === 'skier' ? this.speed * 0.6 : -this.speed * 0.5,
            vx: 0, // Horizontal velocity for AI skiers
            aiTimer: 0,
            targetX: null,
            animFrame: 0
        };
        
        this.obstacles.push(obstacle);
    }
    
    updatePlayer() {
        // Horizontal movement - support both keyboard and touch
        const movingLeft = this.keys['ArrowLeft'] || this.keys['a'] || this.touchLeft;
        const movingRight = this.keys['ArrowRight'] || this.keys['d'] || this.touchRight;
        
        if (movingLeft) {
            this.player.vx = -5;
            this.player.direction = -1;
        } else if (movingRight) {
            this.player.vx = 5;
            this.player.direction = 1;
        } else {
            this.player.vx *= 0.9;
            if (Math.abs(this.player.vx) < 0.1) {
                this.player.vx = 0;
                this.player.direction = 0;
            }
        }
        
        this.player.x += this.player.vx;
        
        // Keep player in bounds (full screen)
        if (this.player.x < 20) this.player.x = 20;
        if (this.player.x > this.canvas.width - 20 - this.player.width) this.player.x = this.canvas.width - 20 - this.player.width;
    }
    
    updateObstacles() {
        this.obstacleSpawnTimer++;
        if (this.obstacleSpawnTimer >= this.obstacleSpawnRate) {
            this.spawnObstacle();
            this.obstacleSpawnTimer = 0;
        }
        
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.y -= this.speed - obs.speed;
            obs.animFrame = (obs.animFrame || 0) + 0.1;
            
            // AI for skiers - they try to avoid obstacles
            if (obs.type === 'skier') {
                obs.aiTimer++;
                
                // Check for obstacles ahead
                if (obs.aiTimer > 10) { // Check every 10 frames
                    obs.aiTimer = 0;
                    obs.targetX = null;
                    
                    // Look for obstacles behind (coming from below)
                    for (let j = 0; j < this.obstacles.length; j++) {
                        if (i === j) continue;
                        const other = this.obstacles[j];
                        
                        // Check if obstacle is behind and in path
                        if (other.y > obs.y && 
                            other.y < obs.y + 150 &&
                            Math.abs(other.x - obs.x) < 60) {
                            
                            // Decide which way to dodge
                            if (other.x > obs.x) {
                                // Obstacle is to the right, go left
                                obs.targetX = obs.x - 80;
                            } else {
                                // Obstacle is to the left, go right
                                obs.targetX = obs.x + 80;
                            }
                            
                            // Keep within bounds
                            if (obs.targetX < 200) obs.targetX = 200;
                            if (obs.targetX > 570) obs.targetX = 570;
                            break;
                        }
                    }
                }
                
                // Move towards target if set
                if (obs.targetX !== null) {
                    const dx = obs.targetX - obs.x;
                    if (Math.abs(dx) > 2) {
                        obs.vx = dx > 0 ? 2 : -2;
                        obs.x += obs.vx;
                    } else {
                        obs.vx = 0;
                        obs.targetX = null;
                    }
                } else {
                    obs.vx *= 0.8;
                    obs.x += obs.vx;
                }
                
                // Keep skiers in bounds
                if (obs.x < 180) obs.x = 180;
                if (obs.x > 595) obs.x = 595;
            }
            
            if (obs.y < -100) {
                this.obstacles.splice(i, 1);
                this.score += 10;
            }
        }
    }
    
    checkCollisions() {
        for (let i = 0; i < this.obstacles.length; i++) {
            const obs = this.obstacles[i];
            
            if (this.player.x < obs.x + obs.width &&
                this.player.x + this.player.width > obs.x &&
                this.player.y < obs.y + obs.height &&
                this.player.y + this.player.height > obs.y) {
                
                this.gameOver();
                return true;
            }
        }
        return false;
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        this.distance += this.speed;
        
        // Gradually increase speed
        if (this.speed < this.maxSpeed) {
            this.speed += 0.002;
        }
        
        // Make spawning faster as speed increases
        this.obstacleSpawnRate = Math.max(30, 60 - Math.floor(this.speed * 3));
        
        this.updatePlayer();
        this.updateObstacles();
        
        // Update background
        this.trees.forEach(tree => {
            tree.y -= this.speed * 1.2;
            if (tree.y < -100) {
                tree.y = this.canvas.height + 100;
                tree.x = Math.random() < 0.5 ? Math.random() * 150 : 650 + Math.random() * 150;
            }
        });
        
        // Update side trees
        this.sideTrees.forEach(tree => {
            tree.y -= this.speed * 1.5;
            if (tree.y < -100) {
                tree.y = this.canvas.height + 100;
                tree.x = Math.random() < 0.5 ? 150 + Math.random() * 30 : 620 + Math.random() * 30;
            }
        });
        
        // Update clouds
        this.clouds.forEach(cloud => {
            cloud.y -= cloud.speed;
            if (cloud.y < -50) {
                cloud.y = 250;
                cloud.x = Math.random() * 800;
            }
        });
        
        // Update snowflakes
        this.snowflakes.forEach(flake => {
            flake.y -= this.speed * 0.3 + flake.speed;
            flake.x += flake.drift;
            
            if (flake.y < -10) {
                flake.y = this.canvas.height + 10;
                flake.x = Math.random() * 800;
            }
            if (flake.x < 0) flake.x = 800;
            if (flake.x > 800) flake.x = 0;
        });
        
        // Update flags
        this.flags.forEach(flag => {
            flag.y -= this.speed * 1.5;
            flag.sway += 0.1;
            if (flag.y < -50) {
                flag.y = this.canvas.height + 50;
            }
        });
        
        this.checkCollisions();
        this.updateUI();
    }
    
    drawBackground() {
        // Sky
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F6FF');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Clouds
        this.clouds.forEach(cloud => {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + cloud.size * 0.6, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
            this.ctx.arc(cloud.x - cloud.size * 0.6, cloud.y, cloud.size * 0.7, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Side trees (forest)
        this.trees.forEach(tree => {
            // Pine tree
            this.ctx.fillStyle = '#2F4F2F';
            this.ctx.beginPath();
            this.ctx.moveTo(tree.x, tree.y - tree.size);
            this.ctx.lineTo(tree.x - tree.size * 0.4, tree.y);
            this.ctx.lineTo(tree.x + tree.size * 0.4, tree.y);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Trunk
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(tree.x - tree.size * 0.1, tree.y, tree.size * 0.2, tree.size * 0.3);
        });
        
        // Ski slope (full screen)
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Add subtle slope shading for depth
        const slopeGradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        slopeGradient.addColorStop(0, 'rgba(200, 200, 255, 0.1)');
        slopeGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        slopeGradient.addColorStop(1, 'rgba(200, 200, 255, 0.1)');
        this.ctx.fillStyle = slopeGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Side trees (on edge of slope)
        this.sideTrees.forEach(tree => {
            // Pine tree
            this.ctx.fillStyle = '#1a4d1a';
            this.ctx.strokeStyle = '#0f2e0f';
            this.ctx.lineWidth = 1.5;
            
            // Bottom tier
            this.ctx.beginPath();
            this.ctx.moveTo(tree.x, tree.y - tree.size);
            this.ctx.lineTo(tree.x - tree.size * 0.5, tree.y);
            this.ctx.lineTo(tree.x + tree.size * 0.5, tree.y);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Top tier
            this.ctx.beginPath();
            this.ctx.moveTo(tree.x, tree.y - tree.size * 1.3);
            this.ctx.lineTo(tree.x - tree.size * 0.35, tree.y - tree.size * 0.5);
            this.ctx.lineTo(tree.x + tree.size * 0.35, tree.y - tree.size * 0.5);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Snow
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(tree.x, tree.y - tree.size * 1.3 + 2, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Trunk
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(tree.x - tree.size * 0.1, tree.y - 6, tree.size * 0.2, 6);
        });
        
        // Racing flags
        this.flags.forEach(flag => {
            // Pole
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(flag.x, flag.y);
            this.ctx.lineTo(flag.x, flag.y - 40);
            this.ctx.stroke();
            
            // Flag with sway
            const swayOffset = Math.sin(flag.sway) * 3;
            this.ctx.fillStyle = flag.color;
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(flag.x, flag.y - 40);
            this.ctx.lineTo(flag.x + 20 + swayOffset, flag.y - 35);
            this.ctx.lineTo(flag.x + 15 + swayOffset, flag.y - 30);
            this.ctx.lineTo(flag.x, flag.y - 25);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        });
        
        // Animated snowflakes
        this.snowflakes.forEach(flake => {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Sparkle effect
            if (Math.random() > 0.7) {
                this.ctx.strokeStyle = 'rgba(200, 220, 255, 0.6)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(flake.x - flake.size, flake.y);
                this.ctx.lineTo(flake.x + flake.size, flake.y);
                this.ctx.moveTo(flake.x, flake.y - flake.size);
                this.ctx.lineTo(flake.x, flake.y + flake.size);
                this.ctx.stroke();
            }
        });
        
        // Snow banks on sides
        this.ctx.fillStyle = '#F0F8FF';
        this.ctx.fillRect(0, 0, 150, this.canvas.height);
        this.ctx.fillRect(650, 0, 150, this.canvas.height);
    }
    
    drawObstacle(obs) {
        this.ctx.save();
        this.ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
        
        if (obs.type === 'tree') {
            // Enhanced cartoonish pine tree with more detail
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.ellipse(0, obs.height / 2 + 5, obs.width * 0.6, obs.height * 0.15, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Tree layers (4 tiers for more detail)
            this.ctx.fillStyle = '#2D5016';
            this.ctx.strokeStyle = '#1A3010';
            this.ctx.lineWidth = 2.5;
            
            // Bottom tier
            this.ctx.beginPath();
            this.ctx.moveTo(0, obs.height / 2 - 8);
            this.ctx.lineTo(-obs.width * 0.65, obs.height / 2 + 10);
            this.ctx.lineTo(obs.width * 0.65, obs.height / 2 + 10);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Second tier
            this.ctx.fillStyle = '#2D5016';
            this.ctx.beginPath();
            this.ctx.moveTo(0, obs.height / 4);
            this.ctx.lineTo(-obs.width * 0.55, obs.height / 2);
            this.ctx.lineTo(obs.width * 0.55, obs.height / 2);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Third tier
            this.ctx.fillStyle = '#2F5518';
            this.ctx.beginPath();
            this.ctx.moveTo(0, -obs.height / 8);
            this.ctx.lineTo(-obs.width * 0.45, obs.height / 4);
            this.ctx.lineTo(obs.width * 0.45, obs.height / 4);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Top tier
            this.ctx.fillStyle = '#335A1A';
            this.ctx.beginPath();
            this.ctx.moveTo(0, -obs.height / 2);
            this.ctx.lineTo(-obs.width * 0.3, 0);
            this.ctx.lineTo(obs.width * 0.3, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Snow on tree (multiple patches)
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.strokeStyle = '#E0E0E0';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height / 2 + 3, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.3, -obs.height / 8, 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(obs.width * 0.35, obs.height / 4, 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.45, obs.height / 2 - 5, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Trunk with texture
            this.ctx.fillStyle = '#654321';
            this.ctx.strokeStyle = '#4A2511';
            this.ctx.lineWidth = 1.5;
            this.ctx.fillRect(-obs.width * 0.18, obs.height / 2 - 12, obs.width * 0.36, 12);
            this.ctx.strokeRect(-obs.width * 0.18, obs.height / 2 - 12, obs.width * 0.36, 12);
            
            // Trunk texture lines
            this.ctx.strokeStyle = '#3A1A08';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.1, obs.height / 2 - 10);
            this.ctx.lineTo(-obs.width * 0.1, obs.height / 2);
            this.ctx.moveTo(obs.width * 0.08, obs.height / 2 - 9);
            this.ctx.lineTo(obs.width * 0.08, obs.height / 2);
            this.ctx.stroke();
            
        } else if (obs.type === 'bear') {
            // Enhanced cartoonish brown bear with more detail
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.ellipse(0, obs.height / 2 + 3, obs.width * 0.6, obs.height * 0.15, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Body with gradient
            const bodyGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, obs.width * 0.5);
            bodyGradient.addColorStop(0, '#A0653F');
            bodyGradient.addColorStop(1, '#8B4513');
            this.ctx.fillStyle = bodyGradient;
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, obs.width * 0.5, obs.height * 0.4, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Head
            this.ctx.fillStyle = '#A0653F';
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height / 3, obs.width * 0.38, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Ears with inner detail
            this.ctx.fillStyle = '#A0653F';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.27, -obs.height / 2, obs.width * 0.17, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.27, -obs.height / 2, obs.width * 0.17, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Inner ears
            this.ctx.fillStyle = '#D2691E';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.27, -obs.height / 2, obs.width * 0.08, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.27, -obs.height / 2, obs.width * 0.08, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Snout
            this.ctx.fillStyle = '#D2691E';
            this.ctx.strokeStyle = '#654321';
            this.ctx.beginPath();
            this.ctx.ellipse(0, -obs.height / 4, obs.width * 0.25, obs.height * 0.18, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Nose with highlight
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height / 4, obs.width * 0.1, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.03, -obs.height / 4 - obs.width * 0.03, obs.width * 0.04, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Mouth
            this.ctx.strokeStyle = '#1a1a1a';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height / 4 + obs.height * 0.05, obs.width * 0.12, 0.2, Math.PI - 0.2);
            this.ctx.stroke();
            
            // Eyes with pupils and highlights
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.15, -obs.height / 3, obs.width * 0.12, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.15, -obs.height / 3, obs.width * 0.12, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.15, -obs.height / 3, obs.width * 0.06, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.15, -obs.height / 3, obs.width * 0.06, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.17, -obs.height / 3 - obs.width * 0.02, obs.width * 0.025, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.13, -obs.height / 3 - obs.width * 0.02, obs.width * 0.025, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Paws
            this.ctx.fillStyle = '#8B4513';
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(-obs.width * 0.32, obs.height * 0.18, obs.width * 0.22, obs.height * 0.32);
            this.ctx.fillRect(obs.width * 0.1, obs.height * 0.18, obs.width * 0.22, obs.height * 0.32);
            this.ctx.strokeRect(-obs.width * 0.32, obs.height * 0.18, obs.width * 0.22, obs.height * 0.32);
            this.ctx.strokeRect(obs.width * 0.1, obs.height * 0.18, obs.width * 0.22, obs.height * 0.32);
            
            // Paw pads
            this.ctx.fillStyle = '#654321';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.21, obs.height * 0.45, obs.width * 0.05, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.21, obs.height * 0.45, obs.width * 0.05, 0, Math.PI * 2);
            this.ctx.fill();
            
        } else if (obs.type === 'skier') {
            // Cartoonish skier with animation based on movement
            const lean = obs.vx * 0.15;
            this.ctx.rotate(lean);
            
            // Jacket colors (random but consistent per skier)
            if (!obs.color) {
                const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
                obs.color = colors[Math.floor(Math.random() * colors.length)];
            }
            
            // Body (jacket)
            this.ctx.fillStyle = obs.color;
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(-obs.width * 0.45, -obs.height * 0.2, obs.width * 0.9, obs.height * 0.55, 5);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Arms
            this.ctx.lineWidth = 6;
            this.ctx.strokeStyle = obs.color;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.4, -obs.height * 0.1);
            this.ctx.lineTo(-obs.width * 0.6, obs.height * 0.1);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.4, -obs.height * 0.1);
            this.ctx.lineTo(obs.width * 0.6, obs.height * 0.1);
            this.ctx.stroke();
            
            // Ski poles
            this.ctx.strokeStyle = '#555555';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.6, obs.height * 0.1);
            this.ctx.lineTo(-obs.width * 0.65, obs.height * 0.5);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.6, obs.height * 0.1);
            this.ctx.lineTo(obs.width * 0.65, obs.height * 0.5);
            this.ctx.stroke();
            
            // Pole baskets
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.75, obs.height * 0.5);
            this.ctx.lineTo(-obs.width * 0.55, obs.height * 0.5);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.75, obs.height * 0.5);
            this.ctx.lineTo(obs.width * 0.55, obs.height * 0.5);
            this.ctx.stroke();
            
            // Head with helmet
            this.ctx.fillStyle = '#FFD700';
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height * 0.45, obs.width * 0.35, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Face
            this.ctx.fillStyle = '#FFDBAC';
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height * 0.4, obs.width * 0.25, 0.2, Math.PI - 0.2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Goggles
            this.ctx.fillStyle = '#1E90FF';
            this.ctx.beginPath();
            this.ctx.ellipse(0, -obs.height * 0.45, obs.width * 0.3, obs.height * 0.12, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            // Goggle reflection
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.beginPath();
            this.ctx.ellipse(-obs.width * 0.1, -obs.height * 0.48, obs.width * 0.12, obs.height * 0.06, -0.3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Legs (pants)
            this.ctx.fillStyle = '#2C3E50';
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(-obs.width * 0.25, obs.height * 0.3, obs.width * 0.2, obs.height * 0.25);
            this.ctx.fillRect(obs.width * 0.05, obs.height * 0.3, obs.width * 0.2, obs.height * 0.25);
            this.ctx.strokeRect(-obs.width * 0.25, obs.height * 0.3, obs.width * 0.2, obs.height * 0.25);
            this.ctx.strokeRect(obs.width * 0.05, obs.height * 0.3, obs.width * 0.2, obs.height * 0.25);
            
            // Skis
            this.ctx.strokeStyle = '#FF6347';
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.15, obs.height * 0.55);
            this.ctx.lineTo(-obs.width * 0.2, obs.height * 0.75);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.15, obs.height * 0.55);
            this.ctx.lineTo(obs.width * 0.2, obs.height * 0.75);
            this.ctx.stroke();
            
            // Ski tips (curved)
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.2, obs.height * 0.73, 3, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.2, obs.height * 0.73, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
        } else if (obs.type === 'rock') {
            // Enhanced rock with texture and depth
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            this.ctx.ellipse(0, obs.height / 2 + 4, obs.width * 0.7, obs.height * 0.2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Main rock body with gradient
            const rockGradient = this.ctx.createRadialGradient(-obs.width * 0.15, -obs.height * 0.15, 0, 0, 0, obs.width * 0.6);
            rockGradient.addColorStop(0, '#A0A0A0');
            rockGradient.addColorStop(0.5, '#808080');
            rockGradient.addColorStop(1, '#606060');
            this.ctx.fillStyle = rockGradient;
            this.ctx.strokeStyle = '#404040';
            this.ctx.lineWidth = 2.5;
            
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.45, obs.height * 0.3);
            this.ctx.lineTo(-obs.width * 0.35, -obs.height * 0.4);
            this.ctx.lineTo(0, -obs.height * 0.5);
            this.ctx.lineTo(obs.width * 0.4, -obs.height * 0.35);
            this.ctx.lineTo(obs.width * 0.5, obs.height * 0.25);
            this.ctx.lineTo(obs.width * 0.1, obs.height * 0.5);
            this.ctx.lineTo(-obs.width * 0.2, obs.height * 0.45);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Cracks and texture details
            this.ctx.strokeStyle = '#505050';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.15, -obs.height * 0.25);
            this.ctx.lineTo(obs.width * 0.15, -obs.height * 0.1);
            this.ctx.lineTo(obs.width * 0.25, obs.height * 0.15);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.25, 0);
            this.ctx.lineTo(-obs.width * 0.05, obs.height * 0.25);
            this.ctx.stroke();
            
            // Highlights
            this.ctx.strokeStyle = '#B0B0B0';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.1, -obs.height * 0.35);
            this.ctx.lineTo(obs.width * 0.05, -obs.height * 0.4);
            this.ctx.moveTo(obs.width * 0.15, -obs.height * 0.2);
            this.ctx.lineTo(obs.width * 0.28, -obs.height * 0.15);
            this.ctx.stroke();
            
            // Moss patches
            this.ctx.fillStyle = 'rgba(76, 153, 76, 0.6)';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.28, obs.height * 0.1, obs.width * 0.12, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.arc(obs.width * 0.32, obs.height * 0.25, obs.width * 0.1, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Snow patch
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.strokeStyle = '#E0E0E0';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height * 0.4, obs.width * 0.15, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
        } else if (obs.type === 'snowman') {
            // Detailed snowman obstacle
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.ellipse(0, obs.height / 2 + 3, obs.width * 0.5, obs.height * 0.12, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bottom snowball
            const bottomGradient = this.ctx.createRadialGradient(-obs.width * 0.1, obs.height * 0.15, 0, 0, obs.height * 0.2, obs.width * 0.45);
            bottomGradient.addColorStop(0, '#FFFFFF');
            bottomGradient.addColorStop(1, '#E8F4F8');
            this.ctx.fillStyle = bottomGradient;
            this.ctx.strokeStyle = '#B0D4E8';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(0, obs.height * 0.25, obs.width * 0.42, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Middle snowball
            const middleGradient = this.ctx.createRadialGradient(-obs.width * 0.08, -obs.height * 0.05, 0, 0, 0, obs.width * 0.35);
            middleGradient.addColorStop(0, '#FFFFFF');
            middleGradient.addColorStop(1, '#E8F4F8');
            this.ctx.fillStyle = middleGradient;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, obs.width * 0.32, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Head
            const headGradient = this.ctx.createRadialGradient(-obs.width * 0.07, -obs.height * 0.32, 0, 0, -obs.height * 0.28, obs.width * 0.25);
            headGradient.addColorStop(0, '#FFFFFF');
            headGradient.addColorStop(1, '#E8F4F8');
            this.ctx.fillStyle = headGradient;
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height * 0.28, obs.width * 0.22, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Carrot nose
            this.ctx.fillStyle = '#FF8C00';
            this.ctx.strokeStyle = '#E67300';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -obs.height * 0.28);
            this.ctx.lineTo(obs.width * 0.25, -obs.height * 0.25);
            this.ctx.lineTo(obs.width * 0.22, -obs.height * 0.3);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Coal eyes
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.08, -obs.height * 0.33, obs.width * 0.045, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.08, -obs.height * 0.33, obs.width * 0.045, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Coal mouth (smile)
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.1, -obs.height * 0.2, obs.width * 0.035, 0, Math.PI * 2);
            this.ctx.arc(-obs.width * 0.04, -obs.height * 0.18, obs.width * 0.035, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.04, -obs.height * 0.18, obs.width * 0.035, 0, Math.PI * 2);
            this.ctx.arc(obs.width * 0.1, -obs.height * 0.2, obs.width * 0.035, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Coal buttons
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height * 0.05, obs.width * 0.05, 0, Math.PI * 2);
            this.ctx.arc(0, obs.height * 0.08, obs.width * 0.05, 0, Math.PI * 2);
            this.ctx.arc(0, obs.height * 0.2, obs.width * 0.05, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Stick arms
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            
            // Left arm
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.28, 0);
            this.ctx.lineTo(-obs.width * 0.55, -obs.height * 0.15);
            this.ctx.stroke();
            
            // Left arm branches
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width * 0.48, -obs.height * 0.12);
            this.ctx.lineTo(-obs.width * 0.58, -obs.height * 0.08);
            this.ctx.moveTo(-obs.width * 0.52, -obs.height * 0.14);
            this.ctx.lineTo(-obs.width * 0.6, -obs.height * 0.18);
            this.ctx.stroke();
            
            // Right arm
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.28, 0);
            this.ctx.lineTo(obs.width * 0.55, -obs.height * 0.15);
            this.ctx.stroke();
            
            // Right arm branches
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.48, -obs.height * 0.12);
            this.ctx.lineTo(obs.width * 0.58, -obs.height * 0.08);
            this.ctx.moveTo(obs.width * 0.52, -obs.height * 0.14);
            this.ctx.lineTo(obs.width * 0.6, -obs.height * 0.18);
            this.ctx.stroke();
            
        } else if (obs.type === 'log') {
            // Fallen log obstacle
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            this.ctx.fillRect(-obs.width / 2 + 2, obs.height / 2 - 5, obs.width, obs.height * 0.15);
            
            // Log body with wood grain
            const logGradient = this.ctx.createLinearGradient(0, -obs.height / 2, 0, obs.height / 2);
            logGradient.addColorStop(0, '#8B6F47');
            logGradient.addColorStop(0.5, '#A0826D');
            logGradient.addColorStop(1, '#8B6F47');
            this.ctx.fillStyle = logGradient;
            this.ctx.strokeStyle = '#5D4E37';
            this.ctx.lineWidth = 2;
            
            // Main cylinder
            this.ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
            this.ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
            
            // End rings (tree rings)
            this.ctx.fillStyle = '#D2B48C';
            this.ctx.strokeStyle = '#8B6F47';
            this.ctx.lineWidth = 1.5;
            
            // Left end
            this.ctx.beginPath();
            this.ctx.ellipse(-obs.width / 2, 0, obs.height * 0.3, obs.height * 0.45, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Tree rings on left end
            this.ctx.strokeStyle = '#A0826D';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.ellipse(-obs.width / 2, 0, obs.height * 0.2, obs.height * 0.3, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.ellipse(-obs.width / 2, 0, obs.height * 0.1, obs.height * 0.15, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Right end
            this.ctx.fillStyle = '#D2B48C';
            this.ctx.strokeStyle = '#8B6F47';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.ellipse(obs.width / 2, 0, obs.height * 0.3, obs.height * 0.45, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Tree rings on right end
            this.ctx.strokeStyle = '#A0826D';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.ellipse(obs.width / 2, 0, obs.height * 0.2, obs.height * 0.3, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.ellipse(obs.width / 2, 0, obs.height * 0.1, obs.height * 0.15, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Bark texture lines
            this.ctx.strokeStyle = '#5D4E37';
            this.ctx.lineWidth = 1.5;
            for (let i = -obs.width / 2 + 5; i < obs.width / 2; i += 8) {
                this.ctx.beginPath();
                this.ctx.moveTo(i, -obs.height / 2);
                this.ctx.lineTo(i + 2, obs.height / 2);
                this.ctx.stroke();
            }
            
            // Knots in wood
            this.ctx.fillStyle = '#654321';
            this.ctx.beginPath();
            this.ctx.ellipse(-obs.width * 0.25, 0, obs.width * 0.04, obs.height * 0.15, Math.PI / 6, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.ellipse(obs.width * 0.15, obs.height * 0.2, obs.width * 0.035, obs.height * 0.12, -Math.PI / 8, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Snow on top
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.strokeStyle = '#E0E0E0';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.ellipse(-obs.width * 0.3, -obs.height / 2, obs.width * 0.1, obs.height * 0.2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.ellipse(obs.width * 0.1, -obs.height / 2, obs.width * 0.12, obs.height * 0.2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
        } else if (obs.type === 'sign') {
            // Warning sign obstacle
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(-obs.width * 0.1, obs.height / 2 + 2, obs.width * 0.2, obs.height * 0.1);
            
            // Post
            this.ctx.fillStyle = '#654321';
            this.ctx.strokeStyle = '#4A2511';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(-obs.width * 0.08, -obs.height * 0.25, obs.width * 0.16, obs.height * 0.75);
            this.ctx.strokeRect(-obs.width * 0.08, -obs.height * 0.25, obs.width * 0.16, obs.height * 0.75);
            
            // Post texture
            this.ctx.strokeStyle = '#3A1A08';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -obs.height * 0.15);
            this.ctx.lineTo(0, obs.height * 0.45);
            this.ctx.stroke();
            
            // Sign board (triangle with sway animation)
            const sway = Math.sin(obs.animFrame * 0.3) * 0.05;
            this.ctx.save();
            this.ctx.rotate(sway);
            
            // Sign background (yellow warning triangle)
            const signGradient = this.ctx.createLinearGradient(-obs.width * 0.45, -obs.height / 2, obs.width * 0.45, -obs.height / 2);
            signGradient.addColorStop(0, '#FFD700');
            signGradient.addColorStop(0.5, '#FFC700');
            signGradient.addColorStop(1, '#FFD700');
            this.ctx.fillStyle = signGradient;
            this.ctx.strokeStyle = '#FF8C00';
            this.ctx.lineWidth = 3;
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, -obs.height / 2);
            this.ctx.lineTo(obs.width * 0.45, -obs.height * 0.05);
            this.ctx.lineTo(-obs.width * 0.45, -obs.height * 0.05);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Exclamation mark
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            
            // Top part of !
            this.ctx.fillRect(-obs.width * 0.05, -obs.height * 0.42, obs.width * 0.1, obs.height * 0.22);
            this.ctx.strokeRect(-obs.width * 0.05, -obs.height * 0.42, obs.width * 0.1, obs.height * 0.22);
            
            // Dot of !
            this.ctx.beginPath();
            this.ctx.arc(0, -obs.height * 0.12, obs.width * 0.06, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.restore();
            
            // Snow on sign
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(-obs.width * 0.3, -obs.height * 0.45, obs.width * 0.08, 0, Math.PI * 2);
            this.ctx.fill();
            
        } else if (obs.type === 'jump') {
            // Ski jump ramp
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(-obs.width / 2 + 3, obs.height / 2 + 2, obs.width, obs.height * 0.15);
            
            // Ramp structure with gradient
            const rampGradient = this.ctx.createLinearGradient(0, -obs.height / 2, 0, obs.height / 2);
            rampGradient.addColorStop(0, '#E0E0E0');
            rampGradient.addColorStop(0.5, '#FFFFFF');
            rampGradient.addColorStop(1, '#D0D0D0');
            this.ctx.fillStyle = rampGradient;
            this.ctx.strokeStyle = '#A0A0A0';
            this.ctx.lineWidth = 2.5;
            
            // Main ramp shape (curved upward)
            this.ctx.beginPath();
            this.ctx.moveTo(-obs.width / 2, obs.height / 2);
            this.ctx.lineTo(-obs.width / 2, 0);
            this.ctx.quadraticCurveTo(-obs.width * 0.1, -obs.height / 2, obs.width / 2, -obs.height / 2);
            this.ctx.lineTo(obs.width / 2, obs.height / 2);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Support beams
            this.ctx.fillStyle = '#8B4513';
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 1.5;
            
            // Left support
            this.ctx.fillRect(-obs.width * 0.42, 0, obs.width * 0.08, obs.height / 2);
            this.ctx.strokeRect(-obs.width * 0.42, 0, obs.width * 0.08, obs.height / 2);
            
            // Middle support
            this.ctx.fillRect(-obs.width * 0.04, obs.height * 0.1, obs.width * 0.08, obs.height * 0.4);
            this.ctx.strokeRect(-obs.width * 0.04, obs.height * 0.1, obs.width * 0.08, obs.height * 0.4);
            
            // Right support
            this.ctx.fillRect(obs.width * 0.34, obs.height * 0.25, obs.width * 0.08, obs.height * 0.25);
            this.ctx.strokeRect(obs.width * 0.34, obs.height * 0.25, obs.width * 0.08, obs.height * 0.25);
            
            // Ice/snow texture on ramp
            this.ctx.strokeStyle = '#B8E6F0';
            this.ctx.lineWidth = 1;
            for (let i = -obs.width / 2 + 5; i < obs.width / 2; i += 10) {
                this.ctx.beginPath();
                this.ctx.moveTo(i, obs.height / 2);
                const curveY = -obs.height / 2 + (i + obs.width / 2) / obs.width * obs.height;
                this.ctx.lineTo(i, curveY);
                this.ctx.stroke();
            }
            
            // Danger stripes on edge
            this.ctx.fillStyle = '#FF0000';
            this.ctx.strokeStyle = '#CC0000';
            this.ctx.lineWidth = 1;
            for (let i = -obs.width / 2; i < obs.width / 2; i += 10) {
                const curveY = -obs.height / 2 + (i + obs.width / 2) / obs.width * (obs.height * 0.15);
                this.ctx.fillRect(i, curveY - obs.height / 2, 5, obs.height * 0.08);
            }
            
            // Warning flag
            this.ctx.fillStyle = '#FF4500';
            this.ctx.strokeStyle = '#CC0000';
            this.ctx.lineWidth = 1.5;
            
            // Flag pole
            this.ctx.strokeStyle = '#4A2511';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.45, -obs.height / 2 - 15);
            this.ctx.lineTo(obs.width * 0.45, -obs.height / 2);
            this.ctx.stroke();
            
            // Flag with flutter animation
            const flutter = Math.sin(obs.animFrame * 0.5) * 3;
            this.ctx.fillStyle = '#FF4500';
            this.ctx.strokeStyle = '#CC0000';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width * 0.45, -obs.height / 2 - 15);
            this.ctx.lineTo(obs.width * 0.45 + 12 + flutter, -obs.height / 2 - 12);
            this.ctx.lineTo(obs.width * 0.45 + 10 + flutter * 0.5, -obs.height / 2 - 8);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    drawPlayer() {
        this.ctx.save();
        this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
        
        if (this.player.direction !== 0) {
            this.ctx.rotate(this.player.direction * 0.15);
        }
        
        // Player skier (blue) - more detailed cartoonish style
        // Body (blue jacket with details)
        this.ctx.fillStyle = '#4169E1';
        this.ctx.strokeStyle = '#1E3A8A';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.roundRect(-this.player.width * 0.45, -this.player.height * 0.2, this.player.width * 0.9, this.player.height * 0.6, 6);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Jacket stripe
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(-this.player.width * 0.45, 0, this.player.width * 0.9, this.player.height * 0.08);
        
        // Arms with gloves
        this.ctx.lineWidth = 7;
        this.ctx.strokeStyle = '#4169E1';
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(-this.player.width * 0.4, -this.player.height * 0.15);
        this.ctx.lineTo(-this.player.width * 0.65, this.player.height * 0.15);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.width * 0.4, -this.player.height * 0.15);
        this.ctx.lineTo(this.player.width * 0.65, this.player.height * 0.15);
        this.ctx.stroke();
        
        // Gloves
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(-this.player.width * 0.65, this.player.height * 0.15, 5, 0, Math.PI * 2);
        this.ctx.arc(this.player.width * 0.65, this.player.height * 0.15, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Ski poles
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.player.width * 0.65, this.player.height * 0.15);
        this.ctx.lineTo(-this.player.width * 0.7, this.player.height * 0.6);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.width * 0.65, this.player.height * 0.15);
        this.ctx.lineTo(this.player.width * 0.7, this.player.height * 0.6);
        this.ctx.stroke();
        
        // Pole baskets
        this.ctx.strokeStyle = '#FF6347';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.player.width * 0.8, this.player.height * 0.6);
        this.ctx.lineTo(-this.player.width * 0.6, this.player.height * 0.6);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.width * 0.8, this.player.height * 0.6);
        this.ctx.lineTo(this.player.width * 0.6, this.player.height * 0.6);
        this.ctx.stroke();
        
        // Head with helmet
        this.ctx.fillStyle = '#1E90FF';
        this.ctx.strokeStyle = '#1E3A8A';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.arc(0, -this.player.height * 0.5, this.player.width * 0.38, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Helmet vent
        this.ctx.strokeStyle = '#0F52BA';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.player.width * 0.2, -this.player.height * 0.55);
        this.ctx.lineTo(this.player.width * 0.2, -this.player.height * 0.55);
        this.ctx.stroke();
        
        // Face
        this.ctx.fillStyle = '#FFDBAC';
        this.ctx.beginPath();
        this.ctx.arc(0, -this.player.height * 0.45, this.player.width * 0.28, 0.3, Math.PI - 0.3);
        this.ctx.fill();
        this.ctx.strokeStyle = '#D4A574';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        
        // Goggles
        this.ctx.fillStyle = '#FF6347';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.ellipse(0, -this.player.height * 0.5, this.player.width * 0.32, this.player.height * 0.13, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Goggle strap
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, -this.player.height * 0.5, this.player.width * 0.38, Math.PI * 0.4, Math.PI * 0.6);
        this.ctx.stroke();
        
        // Goggle reflection (shiny)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.ellipse(-this.player.width * 0.12, -this.player.height * 0.53, this.player.width * 0.15, this.player.height * 0.07, -0.4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Smile (visible below goggles)
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.arc(0, -this.player.height * 0.4, this.player.width * 0.15, 0.2, Math.PI - 0.2);
        this.ctx.stroke();
        
        // Legs (blue pants)
        this.ctx.fillStyle = '#1E3A8A';
        this.ctx.strokeStyle = '#0F1E47';
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(-this.player.width * 0.28, this.player.height * 0.35, this.player.width * 0.22, this.player.height * 0.3);
        this.ctx.fillRect(this.player.width * 0.06, this.player.height * 0.35, this.player.width * 0.22, this.player.height * 0.3);
        this.ctx.strokeRect(-this.player.width * 0.28, this.player.height * 0.35, this.player.width * 0.22, this.player.height * 0.3);
        this.ctx.strokeRect(this.player.width * 0.06, this.player.height * 0.35, this.player.width * 0.22, this.player.height * 0.3);
        
        // Boots
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(-this.player.width * 0.28, this.player.height * 0.6, this.player.width * 0.22, this.player.height * 0.1);
        this.ctx.fillRect(this.player.width * 0.06, this.player.height * 0.6, this.player.width * 0.22, this.player.height * 0.1);
        
        // Skis (golden/yellow)
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 5;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(-this.player.width * 0.17, this.player.height * 0.65);
        this.ctx.lineTo(-this.player.width * 0.23, this.player.height * 0.9);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.width * 0.17, this.player.height * 0.65);
        this.ctx.lineTo(this.player.width * 0.23, this.player.height * 0.9);
        this.ctx.stroke();
        
        // Ski tips (curved front)
        this.ctx.fillStyle = '#FFA500';
        this.ctx.beginPath();
        this.ctx.arc(-this.player.width * 0.23, this.player.height * 0.88, 4, 0, Math.PI * 2);
        this.ctx.arc(this.player.width * 0.23, this.player.height * 0.88, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Ski bindings
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.player.width * 0.25, this.player.height * 0.65);
        this.ctx.lineTo(-this.player.width * 0.09, this.player.height * 0.65);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.width * 0.25, this.player.height * 0.65);
        this.ctx.lineTo(this.player.width * 0.09, this.player.height * 0.65);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    draw() {
        this.drawBackground();
        
        this.obstacles.forEach(obs => this.drawObstacle(obs));
        this.drawPlayer();
        
        // Draw pause screen
        if (this.gameState === 'paused') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2 - 60);
            
            this.ctx.font = '24px Arial';
            this.ctx.fillText('Press ESC to Resume', this.canvas.width / 2, this.canvas.height / 2 - 10);
            
            this.ctx.font = '20px Arial';
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillText('Press M for Main Menu', this.canvas.width / 2, this.canvas.height / 2 + 30);
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = Math.floor(this.score);
        document.getElementById('wave-counter').textContent = Math.floor(this.distance / 100);
        document.getElementById('troop-count').textContent = Math.floor(this.speed * 10) + ' km/h';
        document.getElementById('damage-level').textContent = '-';
        document.getElementById('lives').textContent = '-';
        
        // Update labels
        const labels = document.querySelectorAll('.stat-label');
        labels[0].textContent = 'Distance:';
        labels[1].textContent = 'Score:';
        labels[2].textContent = 'Speed:';
        labels[3].textContent = '';
        labels[4].textContent = '';
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.stopMusic();
        document.getElementById('final-score').textContent = Math.floor(this.score);
        document.getElementById('final-wave').textContent = Math.floor(this.distance / 100) + 'm';
        
        // Update label for ski game
        const gameOverDiv = document.getElementById('game-over');
        const waveLabel = gameOverDiv.querySelector('p:nth-child(3)');
        if (waveLabel) {
            waveLabel.innerHTML = 'Distance Reached: <span id="final-wave">' + Math.floor(this.distance / 100) + 'm</span>';
        }
        
        document.getElementById('game-over').classList.remove('hidden');
    }
    
    returnToMainMenu() {
        this.stopMusic();
        this.hideAllTouchControls();
        
        // Clear the canvas
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Show start screen
        document.getElementById('start-screen').classList.remove('hidden');
        document.getElementById('game-over').classList.add('hidden');
        
        // Reset UI labels back
        document.getElementById('speed-controls').style.display = 'flex';
        document.getElementById('controls-hint').textContent = 'Use Arrow Keys to Move • Space to Shoot';
        
        // Clear current game
        currentGame = null;
        this.gameState = 'start';
    }
    
    reset() {
        this.gameState = 'playing';
        this.score = 0;
        this.distance = 0;
        this.speed = 3;
        this.player.x = 400;
        this.player.y = 100;
        this.player.vx = 0;
        this.player.direction = 0;
        this.touchLeft = false;
        this.touchRight = false;
        this.obstacles = [];
        this.obstacleSpawnTimer = 0;
        this.updateUI();
        this.showSkiControls();
        this.startMusic();
    }
}

// Game mode selection
document.querySelectorAll('.game-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const gameType = btn.dataset.game;
        document.getElementById('start-screen').classList.add('hidden');
        
        // Hide speed controls for ski game
        const speedControls = document.getElementById('speed-controls');
        const controlsHint = document.getElementById('controls-hint');
        
        if (gameType === 'ski') {
            currentGame = new SkiGame();
            speedControls.style.display = 'none';
            controlsHint.textContent = 'Use Arrow Keys to Dodge Obstacles';
            currentGame.showSkiControls();
            currentGame.startMusic();
            startSkiGameLoop();
        } else {
            currentGame = null; // Clear ski game reference
            speedControls.style.display = 'flex';
            controlsHint.textContent = 'Use Arrow Keys to Move • Space to Shoot';
            resetGame(); // Start Top War game
            gameLoop(); // Start Top War game loop
        }
    });
});

// Ski game loop
function startSkiGameLoop() {
    function loop() {
        if (currentGame && currentGame.gameState !== 'gameOver') {
            currentGame.update();
            currentGame.draw();
            requestAnimationFrame(loop);
        }
    }
    loop();
}

// Update restart button for ski game
const originalRestartHandler = document.getElementById('restart-btn').onclick;
document.getElementById('restart-btn').addEventListener('click', () => {
    if (currentGame instanceof SkiGame) {
        document.getElementById('game-over').classList.add('hidden');
        currentGame.reset();
        startSkiGameLoop();
    }
});

// Main menu button handler
document.getElementById('menu-btn-gameover').addEventListener('click', () => {
    if (currentGame instanceof SkiGame) {
        currentGame.returnToMainMenu();
    } else {
        // Top War game - handled in game.js
        returnToMainMenu();
    }
});
