const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Lane system
const laneCount = 5; // Start with 5 lanes
function getLanes() {
    const bounds = getBridgeBounds();
    const lanes = [];
    const laneWidth = bounds.bridgeWidth / laneCount;
    for (let i = 0; i < laneCount; i++) {
        lanes.push(bounds.bridgeLeft + laneWidth * i + laneWidth / 2);
    }
    return lanes;
}

function snapToLane(x) {
    const lanes = getLanes();
    let closestLane = lanes[0];
    let minDist = Math.abs(x - lanes[0]);
    
    for (let i = 1; i < lanes.length; i++) {
        const dist = Math.abs(x - lanes[i]);
        if (dist < minDist) {
            minDist = dist;
            closestLane = lanes[i];
        }
    }
    return closestLane;
}

// Game state
let gameState = 'start'; // start, playing, paused, gameOver
let score = 0;
let wave = 1;
let damageLevel = 1;
let waveEnemiesKilled = 0;
let waveEnemyTarget = 10;
let lives = 100;
let isBossFight = false;
let bigBoss = null;

// Player
const player = {
    x: canvas.width / 2,
    y: canvas.height - 100,
    width: 25,
    height: 25,
    speed: 4,
    troops: [],
    targetLane: null
};

// Initialize player with one troop
player.troops.push({ offsetX: 0, offsetY: 0 });
player.x = snapToLane(player.x) - player.width / 2;
rebuildFormation = function() {
    // Rebuild the formation to maintain consistent 3x4 grid
    for (let i = 0; i < player.troops.length; i++) {
        const col = i % 3; // 0, 1, 2
        const row = Math.floor(i / 3); // 0, 1, 2, 3
        player.troops[i].offsetX = -col * (player.width + 5);
        player.troops[i].offsetY = row * (player.height + 5);
    }
};

// Input handling
const keys = {};
const keyPressed = {}; // Track if key was just pressed

// Touch control state
const touchControls = {
    joystickActive: false,
    joystickX: 0,
    joystickY: 0,
    shooting: false,
    rocketFiring: false
};

window.addEventListener('keydown', (e) => {
    if (!keys[e.key]) {
        keyPressed[e.key] = true;
    }
    keys[e.key] = true;
    
    // Pause with ESC
    if (e.key === 'Escape' && gameState === 'playing') {
        gameState = 'paused';
        stopMusic();
        e.preventDefault();
    } else if (e.key === 'Escape' && gameState === 'paused') {
        gameState = 'playing';
        startMusic();
        e.preventDefault();
    }
    
    // Return to main menu with M key when paused
    if (e.key === 'm' && gameState === 'paused') {
        returnToMainMenu();
        e.preventDefault();
    }
    
    if (e.key === ' ' && gameState === 'playing') {
        shoot();
        e.preventDefault();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    keyPressed[e.key] = false;
});

// Touch Controls Setup
function initTouchControls() {
    const joystickOuter = document.getElementById('joystick-outer');
    const joystickInner = document.getElementById('joystick-inner');
    const shootBtn = document.getElementById('shoot-btn');
    const rocketBtn = document.getElementById('rocket-btn');
    
    if (!joystickOuter) return; // Not in mobile version
    
    let joystickTouchId = null;
    const joystickMaxRadius = 35; // Max distance from center
    
    // Joystick handling
    joystickOuter.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (joystickTouchId === null && gameState === 'playing') {
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            handleJoystickMove(touch, joystickOuter, joystickInner, joystickMaxRadius);
        }
    });
    
    joystickOuter.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (joystickTouchId !== null && gameState === 'playing') {
            for (let touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) {
                    handleJoystickMove(touch, joystickOuter, joystickInner, joystickMaxRadius);
                    break;
                }
            }
        }
    });
    
    joystickOuter.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (let touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                joystickTouchId = null;
                touchControls.joystickActive = false;
                touchControls.joystickX = 0;
                touchControls.joystickY = 0;
                joystickInner.style.transform = 'translate(-50%, -50%)';
                break;
            }
        }
    });
    
    // Shoot button
    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'playing') {
            touchControls.shooting = true;
        }
    });
    
    shootBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchControls.shooting = false;
    });
    
    // Rocket button
    rocketBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'playing') {
            touchControls.rocketFiring = true;
        }
    });
    
    rocketBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchControls.rocketFiring = false;
    });
}

function handleJoystickMove(touch, outer, inner, maxRadius) {
    const rect = outer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > maxRadius) {
        const angle = Math.atan2(deltaY, deltaX);
        deltaX = Math.cos(angle) * maxRadius;
        deltaY = Math.sin(angle) * maxRadius;
    }
    
    touchControls.joystickActive = true;
    touchControls.joystickX = deltaX / maxRadius; // -1 to 1
    touchControls.joystickY = deltaY / maxRadius; // -1 to 1
    
    inner.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
}

// Game arrays
let bullets = [];
let enemyBullets = [];
let rockets = [];
let enemies = [];
let powerups = [];
let particles = [];
let muzzleFlashes = [];

// Enemy spawning
let enemySpawnTimer = 0;
let enemySpawnRate = 120; // frames between spawns
let bossSpawnTimer = 0;

// Powerup spawning
let powerupSpawnTimer = 0;
let powerupSpawnRate = 300;

// Animation
let frameCount = 0;
let speedMultiplier = 1; // Game speed multiplier

// Audio
const sounds = {
    shoot: createSound([0.3, 0, 100, 0.01, 0.05, 0.2, 1, 1.5, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0.01]),
    explosion: createSound([1, 0, 200, 0.02, 0.2, 0.4, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.1]),
    powerup: createSound([0.5, 0, 400, 0.01, 0.3, 0.3, 1, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01]),
    hit: createSound([0.2, 0, 150, 0.01, 0.05, 0.1, 1, 1.5, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0.01]),
    death: createSound([1.5, 0, 100, 0.01, 0.3, 0.8, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.2]),
    waveComplete: createSound([0.7, 0, 500, 0.05, 0.5, 0.5, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01])
};

// Simple procedural sound generation
function createSound(params) {
    return {
        params: params,
        play: function(volume = 1) {
            if (!window.audioContext) {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const audioContext = window.audioContext;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            const [vol, , freq, attack, sustain, release] = params;
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            
            const now = audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(vol * volume, now + attack);
            gainNode.gain.linearRampToValueAtTime(vol * volume * 0.7, now + attack + sustain);
            gainNode.gain.linearRampToValueAtTime(0, now + attack + sustain + release);
            
            oscillator.start(now);
            oscillator.stop(now + attack + sustain + release);
        }
    };
}

// Background music (epic battle theme)
let musicPlaying = false;
function startMusic() {
    if (musicPlaying) return;
    musicPlaying = true;
    playMusicLoop();
}

function playMusicLoop() {
    if (!musicPlaying || gameState !== 'playing') {
        musicPlaying = false;
        return;
    }
    
    // Epic battle theme pattern inspired by classical music
    // Uses dramatic intervals and rhythmic patterns
    const baseFreq = 196; // G3
    const pattern = [
        // Opening dramatic phrase (measures 1-2)
        {freq: baseFreq * 1.5, duration: 150, volume: 0.12},      // D4
        {freq: baseFreq * 1.5, duration: 150, volume: 0.12},      // D4
        {freq: baseFreq * 1.5, duration: 150, volume: 0.12},      // D4
        {freq: baseFreq * 1.682, duration: 400, volume: 0.15},    // E4
        
        // Rising phrase (measures 3-4)
        {freq: baseFreq * 1.26, duration: 150, volume: 0.12},     // B3
        {freq: baseFreq * 1.26, duration: 150, volume: 0.12},     // B3
        {freq: baseFreq * 1.26, duration: 150, volume: 0.12},     // B3
        {freq: baseFreq * 1.5, duration: 400, volume: 0.15},      // D4
        
        // Descending powerful phrase (measures 5-6)
        {freq: baseFreq * 2, duration: 150, volume: 0.13},        // G4
        {freq: baseFreq * 2, duration: 150, volume: 0.13},        // G4
        {freq: baseFreq * 2, duration: 150, volume: 0.13},        // G4
        {freq: baseFreq * 1.782, duration: 400, volume: 0.15},    // F4
        
        // Climactic finish (measures 7-8)
        {freq: baseFreq * 1.5, duration: 150, volume: 0.12},      // D4
        {freq: baseFreq * 1.5, duration: 150, volume: 0.12},      // D4
        {freq: baseFreq * 1.5, duration: 150, volume: 0.12},      // D4
        {freq: baseFreq * 1.682, duration: 600, volume: 0.15},    // E4 (longer)
        
        // New variation - heroic ascending section (measures 9-10)
        {freq: baseFreq * 1.682, duration: 200, volume: 0.12},    // E4
        {freq: baseFreq * 1.782, duration: 200, volume: 0.12},    // F4
        {freq: baseFreq * 2, duration: 200, volume: 0.13},        // G4
        {freq: baseFreq * 2.25, duration: 500, volume: 0.15},     // A4
        
        // Triumphant repeat (measures 11-12)
        {freq: baseFreq * 2, duration: 150, volume: 0.13},        // G4
        {freq: baseFreq * 2, duration: 150, volume: 0.13},        // G4
        {freq: baseFreq * 2, duration: 150, volume: 0.13},        // G4
        {freq: baseFreq * 2.25, duration: 400, volume: 0.15},     // A4
        
        // Power chords descending (measures 13-14)
        {freq: baseFreq * 2.25, duration: 150, volume: 0.13},     // A4
        {freq: baseFreq * 2, duration: 150, volume: 0.13},        // G4
        {freq: baseFreq * 1.782, duration: 150, volume: 0.12},    // F4
        {freq: baseFreq * 1.682, duration: 400, volume: 0.15},    // E4
        
        // Final dramatic resolution (measures 15-16)
        {freq: baseFreq * 1.5, duration: 200, volume: 0.12},      // D4
        {freq: baseFreq * 1.682, duration: 200, volume: 0.12},    // E4
        {freq: baseFreq * 1.5, duration: 200, volume: 0.12},      // D4
        {freq: baseFreq * 1.26, duration: 200, volume: 0.11},     // B3
        {freq: baseFreq * 1, duration: 800, volume: 0.15}         // G3 (long finale)
    ];
    
    let currentTime = 0;
    pattern.forEach((note) => {
        setTimeout(() => {
            if (musicPlaying && gameState === 'playing') {
                playMusicNote(note.freq, note.volume, note.duration / 1000);
            }
        }, currentTime);
        currentTime += note.duration;
    });
    
    setTimeout(() => {
        if (musicPlaying && gameState === 'playing') {
            playMusicLoop();
        }
    }, currentTime);
}

function playMusicNote(freq, volume, duration) {
    if (!window.audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioContext = window.audioContext;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = freq;
    oscillator.type = 'triangle'; // Richer sound for epic feel
    
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    oscillator.start(now);
    oscillator.stop(now + duration);
}

function stopMusic() {
    musicPlaying = false;
}

// Classes
class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 8;
        this.speed = 8;
        this.damage = damageLevel;
    }

    update() {
        this.y -= this.speed * speedMultiplier;
    }

    draw() {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(this.x - this.width / 2 + 1, this.y + 2, this.width - 2, this.height - 4);
    }
}

class EnemyBullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 8;
        this.speed = 5;
    }

    update() {
        this.y += this.speed * speedMultiplier;
    }

    draw() {
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.fillStyle = '#FF6347';
        ctx.fillRect(this.x - this.width / 2 + 1, this.y + 2, this.width - 2, this.height - 4);
    }
}

class Rocket {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 8;
        this.height = 16;
        this.speed = 2.5;
        this.turnSpeed = 0.08;
        this.health = 3;
        this.trailParticles = [];
    }

    update() {
        // Home in on player
        const targetX = player.x + player.width / 2;
        const targetY = player.y + player.height / 2;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Gradually turn towards player
            const targetVx = (dx / distance) * this.speed;
            const targetVy = (dy / distance) * this.speed;
            
            if (!this.vx) this.vx = 0;
            if (!this.vy) this.vy = this.speed;
            
            this.vx += (targetVx - this.vx) * this.turnSpeed;
            this.vy += (targetVy - this.vy) * this.turnSpeed;
            
            // Normalize to maintain constant speed
            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (currentSpeed > 0) {
                this.vx = (this.vx / currentSpeed) * this.speed;
                this.vy = (this.vy / currentSpeed) * this.speed;
            }
        }
        
        this.x += this.vx * speedMultiplier;
        this.y += this.vy * speedMultiplier;
        
        // Add trail particle
        if (frameCount % 3 === 0) {
            this.trailParticles.push({x: this.x, y: this.y, life: 20});
        }
        
        // Update trail
        this.trailParticles = this.trailParticles.filter(p => {
            p.life--;
            return p.life > 0;
        });
    }

    draw() {
        // Draw smoke trail
        this.trailParticles.forEach(p => {
            ctx.globalAlpha = p.life / 20;
            ctx.fillStyle = '#555555';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        
        // Rocket body
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Calculate angle
        if (this.vx || this.vy) {
            const angle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
            ctx.rotate(angle);
        }
        
        // Rocket shape
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // Nose cone
        ctx.fillStyle = '#A00000';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -this.height / 2);
        ctx.lineTo(0, -this.height / 2 - 6);
        ctx.lineTo(this.width / 2, -this.height / 2);
        ctx.closePath();
        ctx.fill();
        
        // Fins
        ctx.fillStyle = '#600000';
        ctx.fillRect(-this.width / 2 - 3, this.height / 2 - 8, 3, 8);
        ctx.fillRect(this.width / 2, this.height / 2 - 8, 3, 8);
        
        // Flame
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2 + 2, this.height / 2);
        ctx.lineTo(0, this.height / 2 + 8 + Math.random() * 4);
        ctx.lineTo(this.width / 2 - 2, this.height / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2 + 3, this.height / 2);
        ctx.lineTo(0, this.height / 2 + 5 + Math.random() * 3);
        ctx.lineTo(this.width / 2 - 3, this.height / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

class BigBoss {
    constructor() {
        this.width = 80;
        this.height = 80;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = -this.height;
        this.speed = 0.3;
        this.maxHealth = 100 + wave * 50;
        this.health = this.maxHealth;
        this.shootTimer = 0;
        this.shootInterval = 90; // Shoot rockets every 1.5 seconds
        this.targetY = 100; // Stop position
        this.arrived = false;
    }

    update() {
        // Move to target position
        if (!this.arrived) {
            if (this.y < this.targetY) {
                this.y += this.speed * speedMultiplier;
            } else {
                this.arrived = true;
            }
        }
        
        // Shoot rockets when arrived
        if (this.arrived) {
            this.shootTimer += speedMultiplier;
            if (this.shootTimer >= this.shootInterval) {
                this.shootRocket();
                this.shootTimer = 0;
            }
        }
    }
    
    shootRocket() {
        const rocketX = this.x + this.width / 2;
        const rocketY = this.y + this.height;
        rockets.push(new Rocket(rocketX, rocketY));
        muzzleFlashes.push(new MuzzleFlash(rocketX, rocketY, true));
        sounds.shoot.play(0.4);
    }

    draw() {
        // Boss body - large tank-like vehicle
        ctx.fillStyle = '#2F4F2F';
        ctx.fillRect(this.x, this.y + 30, this.width, this.height - 30);
        
        // Turret
        ctx.fillStyle = '#1C3030';
        ctx.fillRect(this.x + 20, this.y + 10, this.width - 40, 30);
        
        // Cannon
        ctx.fillStyle = '#0D0D0D';
        ctx.fillRect(this.x + this.width / 2 - 5, this.y + 40, 10, 30);
        
        // Turret top
        ctx.fillStyle = '#3A5F5F';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 25, 18, 0, Math.PI * 2);
        ctx.fill();
        
        // Armor plates
        ctx.fillStyle = '#1A3030';
        ctx.fillRect(this.x + 5, this.y + 35, 15, 15);
        ctx.fillRect(this.x + this.width - 20, this.y + 35, 15, 15);
        ctx.fillRect(this.x + 10, this.y + 55, 12, 12);
        ctx.fillRect(this.x + this.width - 22, this.y + 55, 12, 12);
        
        // Treads
        ctx.fillStyle = '#0D0D0D';
        ctx.fillRect(this.x, this.y + this.height - 10, this.width, 10);
        
        // Tread details
        ctx.fillStyle = '#1A1A1A';
        for (let i = 0; i < this.width; i += 8) {
            ctx.fillRect(this.x + i, this.y + this.height - 8, 6, 6);
        }
        
        // Warning lights
        const blinkOn = Math.floor(frameCount / 15) % 2 === 0;
        if (blinkOn) {
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(this.x + 15, this.y + 20, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + this.width - 15, this.y + 20, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Health bar
        const healthBarWidth = this.width;
        const healthBarHeight = 6;
        const healthPercent = this.health / this.maxHealth;
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.x, this.y - 15, healthBarWidth, healthBarHeight);
        
        ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : (healthPercent > 0.25 ? '#FFA500' : '#FF0000');
        ctx.fillRect(this.x, this.y - 15, healthBarWidth * healthPercent, healthBarHeight);
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y - 15, healthBarWidth, healthBarHeight);
    }
}

class Enemy {
    constructor(isBoss = false, isShooter = false) {
        this.isBoss = isBoss;
        this.isShooter = isShooter;
        this.width = isBoss ? 40 : 25;
        this.height = isBoss ? 40 : 25;
        const lanes = getLanes();
        const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
        this.x = randomLane - this.width / 2;
        this.y = -this.height;
        this.speed = isShooter ? (0.3 + wave * 0.05) : (isBoss ? 0.5 + wave * 0.1 : 1 + wave * 0.1);
        this.maxHealth = isBoss ? 10 + wave * 5 : (isShooter ? 5 : 3);
        this.health = this.maxHealth;
        this.shootTimer = 0;
        this.shootInterval = 120; // Shoot every 2 seconds at 60fps
    }

    update() {
        this.y += this.speed * speedMultiplier;
        
        // Shooter enemies shoot periodically
        if (this.isShooter && this.y > 50 && this.y < canvas.height - 150) {
            this.shootTimer += speedMultiplier;
            if (this.shootTimer >= this.shootInterval) {
                this.shoot();
                this.shootTimer = 0;
            }
        }
    }
    
    shoot() {
        const bulletX = this.x + this.width / 2;
        const bulletY = this.y + this.height;
        enemyBullets.push(new EnemyBullet(bulletX, bulletY));
        muzzleFlashes.push(new MuzzleFlash(bulletX, bulletY, true));
        sounds.shoot.play(0.2);
    }

    draw() {
        const scale = this.isBoss ? 1.2 : 1;
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.ellipse(this.x + this.width / 2, this.y + this.height + 2, this.width * 0.4, this.height * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Color scheme for shooter enemies
        const bodyColor1 = this.isShooter ? '#8B008B' : (this.isBoss ? '#8B0000' : '#DC143C');
        const bodyColor2 = this.isShooter ? '#9932CC' : (this.isBoss ? '#A52A2A' : '#FF6347');
        const headColor = this.isShooter ? '#BA55D3' : (this.isBoss ? '#CD5C5C' : '#FF7F7F');
        const legColor = this.isShooter ? '#6B008B' : (this.isBoss ? '#6B0000' : '#B22222');
        
        // Draw legs
        ctx.fillStyle = legColor;
        ctx.fillRect(this.x + this.width * 0.2, this.y + this.height * 0.6, this.width * 0.2, this.height * 0.4);
        ctx.fillRect(this.x + this.width * 0.6, this.y + this.height * 0.6, this.width * 0.2, this.height * 0.4);
        
        // Draw body with gradient
        const bodyGradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
        bodyGradient.addColorStop(0, bodyColor1);
        bodyGradient.addColorStop(1, bodyColor2);
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(this.x + this.width * 0.1, this.y + this.height * 0.3, this.width * 0.8, this.height * 0.5);
        
        // Draw arms
        ctx.fillStyle = bodyColor2;
        ctx.fillRect(this.x, this.y + this.height * 0.35, this.width * 0.15, this.height * 0.4);
        ctx.fillRect(this.x + this.width * 0.85, this.y + this.height * 0.35, this.width * 0.15, this.height * 0.4);
        
        // Draw head
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height * 0.15, this.width * 0.35, this.height * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw helmet/hat
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height * 0.05, this.width * 0.3, this.height * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width * 0.35, this.y + this.height * 0.15, this.width * 0.08, this.height * 0.1, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x + this.width * 0.65, this.y + this.height * 0.15, this.width * 0.08, this.height * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width * 0.35, this.y + this.height * 0.15, this.width * 0.04, this.height * 0.05, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x + this.width * 0.65, this.y + this.height * 0.15, this.width * 0.04, this.height * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw angry eyebrows
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width * 0.25, this.y + this.height * 0.08);
        ctx.lineTo(this.x + this.width * 0.4, this.y + this.height * 0.12);
        ctx.moveTo(this.x + this.width * 0.75, this.y + this.height * 0.08);
        ctx.lineTo(this.x + this.width * 0.6, this.y + this.height * 0.12);
        ctx.stroke();
        
        // Draw weapon - larger gun for shooter
        if (this.isShooter) {
            ctx.fillStyle = '#2F2F2F';
            ctx.fillRect(this.x + this.width * 0.85, this.y + this.height * 0.3, this.width * 0.15, this.height * 0.2);
            ctx.fillStyle = '#4A4A4A';
            ctx.fillRect(this.x + this.width * 0.95, this.y + this.height * 0.32, this.width * 0.25, this.height * 0.15);
            // Gun barrel
            ctx.fillStyle = '#1A1A1A';
            ctx.fillRect(this.x + this.width * 1.15, this.y + this.height * 0.37, this.width * 0.1, this.height * 0.05);
        } else {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x + this.width * 0.85, this.y + this.height * 0.35, this.width * 0.1, this.height * 0.5);
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(this.x + this.width * 0.9, this.y + this.height * 0.2, this.width * 0.15, this.height * 0.15);
        }
        
        // Draw health bar
        if (this.health < this.maxHealth) {
            const barWidth = this.width;
            const barHeight = 5;
            const healthPercent = this.health / this.maxHealth;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x, this.y - 12, barWidth, barHeight);
            ctx.fillStyle = this.isBoss ? '#FFD700' : (this.isShooter ? '#9932CC' : '#00FF00');
            ctx.fillRect(this.x, this.y - 12, barWidth * healthPercent, barHeight);
            
            // Health bar border
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, this.y - 12, barWidth, barHeight);
        }
        
        // Boss indicator
        if (this.isBoss) {
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#8B4500';
            ctx.lineWidth = 2;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.strokeText('BOSS', this.x + this.width / 2, this.y - 20);
            ctx.fillText('BOSS', this.x + this.width / 2, this.y - 20);
        } else if (this.isShooter) {
            // Shooter indicator
            ctx.fillStyle = '#9932CC';
            ctx.strokeStyle = '#6B008B';
            ctx.lineWidth = 1;
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.strokeText('GUNNER', this.x + this.width / 2, this.y - 20);
            ctx.fillText('GUNNER', this.x + this.width / 2, this.y - 20);
        }
    }

    takeDamage(damage) {
        this.health -= damage;
        return this.health <= 0;
    }
}

class Powerup {
    constructor() {
        this.width = 20;
        this.height = 20;
        const lanes = getLanes();
        const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
        this.x = randomLane - this.width / 2;
        this.y = -this.height;
        this.speed = 2;
        this.type = Math.random() > 0.5 ? 'damage' : 'troop'; // damage boost or extra troop
    }

    update() {
        this.y += this.speed * speedMultiplier;
    }

    draw() {
        // Draw glow effect
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.type === 'damage' ? '#FFD700' : '#00FF00';
        
        if (this.type === 'damage') {
            // Draw damage powerup (3D star)
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            
            // Outer star
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                const x = centerX + Math.cos(angle) * this.width / 2;
                const y = centerY + Math.sin(angle) * this.height / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            
            // Inner star (smaller, brighter)
            ctx.fillStyle = '#FFED4E';
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                const x = centerX + Math.cos(angle) * this.width / 3;
                const y = centerY + Math.sin(angle) * this.height / 3;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            
            // Star outline
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                const x = centerX + Math.cos(angle) * this.width / 2;
                const y = centerY + Math.sin(angle) * this.height / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            
            // Add sparkle
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(centerX - this.width * 0.15, centerY - this.height * 0.15, this.width * 0.08, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Draw troop powerup (3D plus with soldier silhouette)
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            
            // Background circle
            ctx.fillStyle = '#32CD32';
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width * 0.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Plus sign with 3D effect
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(this.x + this.width * 0.1, this.y + this.width * 0.35, this.width * 0.8, this.height * 0.3);
            ctx.fillRect(this.x + this.width * 0.35, this.y + this.width * 0.1, this.width * 0.3, this.height * 0.8);
            
            // Highlight on plus
            ctx.fillStyle = '#90EE90';
            ctx.fillRect(this.x + this.width * 0.12, this.y + this.width * 0.37, this.width * 0.35, this.height * 0.08);
            ctx.fillRect(this.x + this.width * 0.37, this.y + this.width * 0.12, this.width * 0.08, this.height * 0.35);
            
            // Outline
            ctx.strokeStyle = '#228B22';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width * 0.5, 0, Math.PI * 2);
            ctx.stroke();
            
            // Small soldier icon in center
            ctx.fillStyle = '#1E90FF';
            ctx.fillRect(centerX - this.width * 0.08, centerY - this.height * 0.05, this.width * 0.16, this.height * 0.15);
            ctx.beginPath();
            ctx.arc(centerX, centerY - this.height * 0.08, this.width * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.size = Math.random() * 4 + 2;
        this.life = 30;
        this.maxLife = 30;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw() {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

class MuzzleFlash {
    constructor(x, y, isEnemy = false) {
        this.x = x;
        this.y = y;
        this.life = 5;
        this.maxLife = 5;
        this.size = 8;
        this.isEnemy = isEnemy;
    }

    update() {
        this.life--;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        
        // Bright flash
        const color = this.isEnemy ? '#FF6347' : '#FFD700';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright core
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// Game functions
function getBridgeWidth() {
    // Start with narrow bridge (200px) and increase by 40px per wave, max 600px
    return Math.min(200 + (wave - 1) * 40, 600);
}

function getBridgeBounds() {
    const bridgeWidth = getBridgeWidth();
    const bridgeLeft = (canvas.width - bridgeWidth) / 2;
    const bridgeRight = bridgeLeft + bridgeWidth;
    return { bridgeLeft, bridgeRight, bridgeWidth };
}

function shoot() {
    player.troops.forEach(troop => {
        const bulletX = player.x + troop.offsetX + player.width / 2;
        const bulletY = player.y + troop.offsetY;
        bullets.push(new Bullet(bulletX, bulletY));
        muzzleFlashes.push(new MuzzleFlash(bulletX, bulletY, false));
    });
    sounds.shoot.play(0.3);
}

function spawnEnemy(isBoss = false) {
    // 20% chance to spawn a shooter enemy (if not spawning a boss)
    const isShooter = !isBoss && Math.random() < 0.2;
    enemies.push(new Enemy(isBoss, isShooter));
}

function spawnPowerup() {
    powerups.push(new Powerup());
}

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function rebuildFormation() {
    // Rebuild the formation to maintain consistent 3x4 grid
    for (let i = 0; i < player.troops.length; i++) {
        const col = i % 3; // 0, 1, 2
        const row = Math.floor(i / 3); // 0, 1, 2, 3
        player.troops[i].offsetX = -col * (player.width + 5);
        player.troops[i].offsetY = row * (player.height + 5);
    }
}

function updatePlayer() {
    // Lane-based movement
    const lanes = getLanes();
    const bounds = getBridgeBounds();
    const bridgeTop = 50;
    
    // Calculate how much vertical space the troop formation takes
    // Troops extend downward with positive offsetY
    let maxOffsetY = 0;
    let minOffsetX = 0;
    let maxOffsetX = 0;
    
    player.troops.forEach(troop => {
        maxOffsetY = Math.max(maxOffsetY, troop.offsetY);
        minOffsetX = Math.min(minOffsetX, troop.offsetX);
        maxOffsetX = Math.max(maxOffsetX, troop.offsetX);
    });
    
    const formationBottom = maxOffsetY + player.height;
    const bridgeBottom = canvas.height - 80; // Account for military base
    
    // Vertical movement (free) - but keep formation on bridge
    // Support both keyboard and touch
    const moveUp = keys['ArrowUp'] || keys['w'] || (touchControls.joystickActive && touchControls.joystickY < -0.3);
    const moveDown = keys['ArrowDown'] || keys['s'] || (touchControls.joystickActive && touchControls.joystickY > 0.3);
    const moveLeft = keyPressed['ArrowLeft'] || keyPressed['a'] || (touchControls.joystickActive && touchControls.joystickX < -0.3);
    const moveRight = keyPressed['ArrowRight'] || keyPressed['d'] || (touchControls.joystickActive && touchControls.joystickX > 0.3);
    
    if (moveUp) {
        player.y = Math.max(bridgeTop, player.y - player.speed * speedMultiplier);
    }
    if (moveDown) {
        const maxY = bridgeBottom - formationBottom;
        player.y = Math.min(maxY, player.y + player.speed * speedMultiplier);
    }
    
    // Horizontal movement (snap to lanes) - only when not moving between lanes
    if (player.targetLane === null) {
        // Get current lane index
        const playerCenterX = player.x + player.width / 2;
        let currentLaneIndex = 0;
        let minDist = Math.abs(playerCenterX - lanes[0]);
        
        for (let i = 1; i < lanes.length; i++) {
            const dist = Math.abs(playerCenterX - lanes[i]);
            if (dist < minDist) {
                minDist = dist;
                currentLaneIndex = i;
            }
        }
        
        if (moveLeft && currentLaneIndex > 0) {
            player.targetLane = lanes[currentLaneIndex - 1];
            keyPressed['ArrowLeft'] = false;
            keyPressed['a'] = false;
        } else if (moveRight && currentLaneIndex < lanes.length - 1) {
            player.targetLane = lanes[currentLaneIndex + 1];
            keyPressed['ArrowRight'] = false;
            keyPressed['d'] = false;
        }
    }
    
    // Move towards target lane
    if (player.targetLane !== null) {
        const targetX = player.targetLane - player.width / 2;
        const diff = targetX - player.x;
        
        if (Math.abs(diff) < 1) {
            player.x = targetX;
            player.targetLane = null;
        } else {
            player.x += Math.sign(diff) * Math.min(Math.abs(diff), player.speed * 2 * speedMultiplier);
        }
    }
}

function drawPlayer() {
    player.troops.forEach(troop => {
        const x = player.x + troop.offsetX;
        const y = player.y + troop.offsetY;
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x + player.width / 2, y + player.height + 2, player.width * 0.4, player.height * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw legs
        ctx.fillStyle = '#104E8B';
        ctx.fillRect(x + player.width * 0.2, y + player.height * 0.6, player.width * 0.2, player.height * 0.4);
        ctx.fillRect(x + player.width * 0.6, y + player.height * 0.6, player.width * 0.2, player.height * 0.4);
        
        // Draw boots
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(x + player.width * 0.15, y + player.height * 0.95, player.width * 0.25, player.height * 0.1);
        ctx.fillRect(x + player.width * 0.55, y + player.height * 0.95, player.width * 0.25, player.height * 0.1);
        
        // Draw body with gradient (blue uniform)
        const bodyGradient = ctx.createLinearGradient(x, y, x + player.width, y);
        bodyGradient.addColorStop(0, '#1E90FF');
        bodyGradient.addColorStop(1, '#4169E1');
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(x + player.width * 0.1, y + player.height * 0.3, player.width * 0.8, player.height * 0.5);
        
        // Draw belt
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(x + player.width * 0.1, y + player.height * 0.6, player.width * 0.8, player.height * 0.1);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + player.width * 0.4, y + player.height * 0.6, player.width * 0.2, player.height * 0.1);
        
        // Draw arms
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(x, y + player.height * 0.35, player.width * 0.15, player.height * 0.4);
        ctx.fillRect(x + player.width * 0.85, y + player.height * 0.35, player.width * 0.15, player.height * 0.4);
        
        // Draw hands
        ctx.fillStyle = '#FFE4B5';
        ctx.beginPath();
        ctx.ellipse(x + player.width * 0.07, y + player.height * 0.7, player.width * 0.1, player.height * 0.1, 0, 0, Math.PI * 2);
        ctx.ellipse(x + player.width * 0.93, y + player.height * 0.7, player.width * 0.1, player.height * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw head
        ctx.fillStyle = '#FFE4B5';
        ctx.beginPath();
        ctx.ellipse(x + player.width / 2, y + player.height * 0.15, player.width * 0.35, player.height * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw helmet
        ctx.fillStyle = '#4682B4';
        ctx.beginPath();
        ctx.ellipse(x + player.width / 2, y + player.height * 0.05, player.width * 0.32, player.height * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Helmet shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + player.width * 0.4, y + player.height * 0.02, player.width * 0.12, player.height * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.ellipse(x + player.width * 0.35, y + player.height * 0.15, player.width * 0.08, player.height * 0.1, 0, 0, Math.PI * 2);
        ctx.ellipse(x + player.width * 0.65, y + player.height * 0.15, player.width * 0.08, player.height * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(x + player.width * 0.35, y + player.height * 0.16, player.width * 0.04, player.height * 0.05, 0, 0, Math.PI * 2);
        ctx.ellipse(x + player.width * 0.65, y + player.height * 0.16, player.width * 0.04, player.height * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw determined eyebrows
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + player.width * 0.25, y + player.height * 0.1);
        ctx.lineTo(x + player.width * 0.42, y + player.height * 0.09);
        ctx.moveTo(x + player.width * 0.75, y + player.height * 0.1);
        ctx.lineTo(x + player.width * 0.58, y + player.height * 0.09);
        ctx.stroke();
        
        // Draw smile
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + player.width / 2, y + player.height * 0.2, player.width * 0.15, 0.2, Math.PI - 0.2);
        ctx.stroke();
        
        // Draw gun
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(x + player.width * 0.85, y + player.height * 0.35, player.width * 0.15, player.height * 0.15);
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(x + player.width * 0.95, y + player.height * 0.37, player.width * 0.2, player.height * 0.1);
        
        // Gun detail
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + player.width * 1.1, y + player.height * 0.39, player.width * 0.05, player.height * 0.06);
    });
}

function checkCollisions() {
    // Bullets vs Rockets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        for (let j = rockets.length - 1; j >= 0; j--) {
            const rocket = rockets[j];
            
            if (bullet.x > rocket.x - rocket.width / 2 &&
                bullet.x < rocket.x + rocket.width / 2 &&
                bullet.y > rocket.y - rocket.height / 2 &&
                bullet.y < rocket.y + rocket.height / 2) {
                
                rocket.health -= bullet.damage;
                bullets.splice(i, 1);
                
                if (rocket.health <= 0) {
                    rockets.splice(j, 1);
                    score += 50;
                    createParticles(rocket.x, rocket.y, '#FF4500', 15);
                    sounds.explosion.play(0.6);
                    updateUI();
                }
                break;
            }
        }
    }
    
    // Bullets vs Big Boss
    if (bigBoss) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            
            if (bullet.x > bigBoss.x &&
                bullet.x < bigBoss.x + bigBoss.width &&
                bullet.y > bigBoss.y &&
                bullet.y < bigBoss.y + bigBoss.height) {
                
                bigBoss.health -= bullet.damage;
                bullets.splice(i, 1);
                createParticles(bullet.x, bullet.y, '#FFA500', 5);
                sounds.hit.play(0.3);
                
                if (bigBoss.health <= 0) {
                    score += 1000 + wave * 500;
                    createParticles(bigBoss.x + bigBoss.width / 2, bigBoss.y + bigBoss.height / 2, '#FF4500', 50);
                    sounds.explosion.play(1);
                    bigBoss = null;
                    waveEnemiesKilled = waveEnemyTarget; // Complete wave when boss dies
                    updateUI();
                }
            }
        }
    }
    
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                
                createParticles(bullet.x, bullet.y, '#FF6347', 5);
                bullets.splice(i, 1);
                sounds.hit.play(0.4);
                
                if (enemy.takeDamage(bullet.damage)) {
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#DC143C', 15);
                    enemies.splice(j, 1);
                    score += enemy.isBoss ? 50 : 10;
                    waveEnemiesKilled++;
                    sounds.explosion.play(enemy.isBoss ? 0.8 : 0.5);
                    updateUI();
                }
                break;
            }
        }
    }
    
    // Player vs Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        
        // Check collision with any troop
        let collected = false;
        for (let t = 0; t < player.troops.length; t++) {
            const troop = player.troops[t];
            const troopX = player.x + troop.offsetX;
            const troopY = player.y + troop.offsetY;
            
            if (troopX < powerup.x + powerup.width &&
                troopX + player.width > powerup.x &&
                troopY < powerup.y + powerup.height &&
                troopY + player.height > powerup.y) {
                
                if (powerup.type === 'damage') {
                    damageLevel++;
                    createParticles(powerup.x, powerup.y, '#FFD700', 20);
                    sounds.powerup.play(0.6);
                } else {
                    // Add new troop in formation (max 9 troops, 3 wide x 3 deep)
                    if (player.troops.length < 9) {
                        const troopCount = player.troops.length;
                        const col = troopCount % 3; // 0, 1, 2
                        const row = Math.floor(troopCount / 3); // 0, 1, 2
                        player.troops.push({
                            offsetX: -col * (player.width + 5),
                            offsetY: row * (player.height + 5)
                        });
                    }
                    createParticles(powerup.x, powerup.y, '#00FF00', 20);
                    sounds.powerup.play(0.6);
                }
                
                powerups.splice(i, 1);
                updateUI();
                collected = true;
                break;
            }
        }
    }
    
    // Player vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Check collision with any troop
        for (let t = player.troops.length - 1; t >= 0; t--) {
            const troop = player.troops[t];
            const troopX = player.x + troop.offsetX;
            const troopY = player.y + troop.offsetY;
            
            if (troopX < enemy.x + enemy.width &&
                troopX + player.width > enemy.x &&
                troopY < enemy.y + enemy.height &&
                troopY + player.height > enemy.y) {
                
                // Determine how many troops to lose
                let troopsToLose = 1;
                if (enemy.isBoss) {
                    // Calculate troops lost based on wave: 2 for waves 1-5, 3 for waves 6-10, etc.
                    troopsToLose = Math.floor((wave - 1) / 5) + 2;
                }
                
                // Remove troops from the back
                const actualLoss = Math.min(troopsToLose, player.troops.length);
                for (let loss = 0; loss < actualLoss; loss++) {
                    if (player.troops.length > 0) {
                        player.troops.pop();
                    }
                }
                
                // Rebuild formation to maintain 3x4 grid structure
                rebuildFormation();
                
                enemies.splice(i, 1);
                createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#1E90FF', 20);
                sounds.hit.play(0.5);
                updateUI();
                
                // Check if player has no troops left
                if (player.troops.length === 0) {
                    sounds.death.play(1);
                    stopMusic();
                    gameOver();
                    return;
                }
                break;
            }
        }
    }
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('wave-counter').textContent = wave;
    const troopCount = document.getElementById('troop-count');
    troopCount.textContent = player.troops.length;
    
    // Add MAX indicator when at 9 troops
    if (player.troops.length >= 9) {
        troopCount.innerHTML = player.troops.length + ' <span style="color: #FFD700; font-size: 12px; font-weight: bold;">MAX</span>';
    } else {
        troopCount.textContent = player.troops.length;
    }
    
    document.getElementById('damage-level').textContent = damageLevel;
    document.getElementById('lives').textContent = lives;
}

function nextWave() {
    wave++;
    waveEnemiesKilled = 0;
    
    // Check if this is a boss fight wave (every 3rd wave)
    if (wave % 3 === 0) {
        isBossFight = true;
        bigBoss = new BigBoss();
        waveEnemyTarget = 5; // Fewer regular enemies during boss fight
        enemySpawnRate = Math.max(60, 200 - wave * 5); // Much slower spawn rate
    } else {
        isBossFight = false;
        bigBoss = null;
        waveEnemyTarget = 10 + wave * 5;
        enemySpawnRate = Math.max(30, 120 - wave * 5);
    }
    
    sounds.waveComplete.play(0.7);
    updateUI();
}

function gameOver() {
    gameState = 'gameOver';
    // Reset label to "Wave Reached:" for Top War
    const gameOverDiv = document.getElementById('game-over');
    const paragraphs = gameOverDiv.querySelectorAll('p');
    paragraphs[1].innerHTML = 'Wave Reached: <span id="final-wave"></span>';
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-wave').textContent = wave;
    gameOverDiv.classList.remove('hidden');
}

function returnToMainMenu() {
    // Stop music and reset state
    stopMusic();
    gameState = 'start';
    
    // Hide touch controls
    hideAllTouchControls();
    
    // Clear the canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Show start screen
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    
    // Reset game variables
    bullets = [];
    enemyBullets = [];
    rockets = [];
    enemies = [];
    powerups = [];
    particles = [];
    muzzleFlashes = [];
    bigBoss = null;
}

function resetGame() {
    gameState = 'playing';
    score = 0;
    wave = 1;
    damageLevel = 1;
    waveEnemiesKilled = 0;
    waveEnemyTarget = 10;
    enemySpawnRate = 120;
    lives = 100;
    
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.x = snapToLane(player.x) - player.width / 2;
    player.targetLane = null;
    player.troops = [{ offsetX: 0, offsetY: 0 }];
    
    bullets = [];
    enemyBullets = [];
    rockets = [];
    enemies = [];
    powerups = [];
    particles = [];
    muzzleFlashes = [];
    isBossFight = false;
    bigBoss = null;
    
    enemySpawnTimer = 0;
    bossSpawnTimer = 0;
    powerupSpawnTimer = 0;
    frameCount = 0;
    
    updateUI();
    showTopWarControls();
    startMusic();
}

function drawBackground() {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw water on both sides with animated waves
    drawWater();
    
    // Bridge with dynamic width
    const bounds = getBridgeBounds();
    const { bridgeLeft, bridgeRight, bridgeWidth } = bounds;
    
    // Bridge main surface
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(bridgeLeft, 0, bridgeWidth, canvas.height);
    
    // Bridge planks
    ctx.fillStyle = '#A0826D';
    for (let i = 0; i < canvas.height; i += 30) {
        ctx.fillRect(bridgeLeft, i, bridgeWidth, 5);
    }
    
    // Bridge railings
    ctx.fillStyle = '#654321';
    ctx.fillRect(bridgeLeft - 10, 0, 10, canvas.height);
    ctx.fillRect(bridgeRight, 0, 10, canvas.height);
    
    // Railing posts
    ctx.fillStyle = '#4A3210';
    for (let i = 0; i < canvas.height; i += 60) {
        ctx.fillRect(bridgeLeft - 15, i, 15, 8);
        ctx.fillRect(bridgeRight, i, 15, 8);
    }
    
    // Draw lane guides (subtle lines)
    const lanes = getLanes();
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 10]);
    for (let i = 0; i < lanes.length; i++) {
        ctx.beginPath();
        ctx.moveTo(lanes[i], 0);
        ctx.lineTo(lanes[i], canvas.height);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Draw military base at the bottom
    drawMilitaryBase(bridgeLeft, bridgeRight);
}

function drawWater() {
    const bounds = getBridgeBounds();
    const bridgeLeft = bounds.bridgeLeft;
    const bridgeRight = bounds.bridgeRight;
    
    // Water gradient
    const waterGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    waterGradient.addColorStop(0, '#1E90FF');
    waterGradient.addColorStop(0.5, '#4682B4');
    waterGradient.addColorStop(1, '#1C4B82');
    
    // Left water
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, 0, bridgeLeft, canvas.height);
    
    // Right water
    ctx.fillRect(bridgeRight + 10, 0, canvas.width - bridgeRight - 10, canvas.height);
    
    // Animated waves on left side
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.height; i += 40) {
        const offset = Math.sin((frameCount * 0.05) + (i * 0.1)) * 5;
        ctx.beginPath();
        for (let x = 0; x < bridgeLeft; x += 10) {
            const y = i + Math.sin((frameCount * 0.05) + (x * 0.1)) * 3 + offset;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    
    // Animated waves on right side
    for (let i = 0; i < canvas.height; i += 40) {
        const offset = Math.sin((frameCount * 0.05) + (i * 0.1)) * 5;
        ctx.beginPath();
        for (let x = bridgeRight + 10; x < canvas.width; x += 10) {
            const y = i + Math.sin((frameCount * 0.05) + (x * 0.1)) * 3 + offset;
            if (x === bridgeRight + 10) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    
    // Water highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 10; i++) {
        const x = (i % 2 === 0) ? Math.random() * bridgeLeft : bridgeRight + 10 + Math.random() * (canvas.width - bridgeRight - 10);
        const y = (i * 60 + frameCount * 2) % canvas.height;
        ctx.beginPath();
        ctx.ellipse(x, y, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawMilitaryBase(bridgeLeft, bridgeRight) {
    const baseY = canvas.height - 80;
    const baseWidth = bridgeRight - bridgeLeft;
    const centerX = (bridgeLeft + bridgeRight) / 2;
    
    // Calculate damage level (0-1, where 0 is full health, 1 is destroyed)
    const damageLevel = 1 - (lives / 100);
    
    // Base platform
    ctx.fillStyle = damageLevel > 0.7 ? '#4A4A4A' : '#696969';
    ctx.fillRect(bridgeLeft, baseY + 50, baseWidth, 30);
    
    // Base walls - main building
    const wallHeight = 40;
    ctx.fillStyle = damageLevel > 0.5 ? '#5A5A5A' : '#808080';
    ctx.fillRect(centerX - 60, baseY + 10, 120, wallHeight);
    
    // Add cracks based on damage
    if (damageLevel > 0.3) {
        ctx.strokeStyle = '#2F2F2F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 40, baseY + 15);
        ctx.lineTo(centerX - 35, baseY + 40);
        ctx.moveTo(centerX + 20, baseY + 20);
        ctx.lineTo(centerX + 25, baseY + 45);
        ctx.stroke();
    }
    if (damageLevel > 0.6) {
        ctx.beginPath();
        ctx.moveTo(centerX - 10, baseY + 10);
        ctx.lineTo(centerX - 5, baseY + 35);
        ctx.moveTo(centerX + 40, baseY + 15);
        ctx.lineTo(centerX + 45, baseY + 50);
        ctx.stroke();
    }
    
    // Roof
    if (damageLevel < 0.8) {
        ctx.fillStyle = damageLevel > 0.5 ? '#654321' : '#8B4513';
        ctx.beginPath();
        ctx.moveTo(centerX - 70, baseY + 10);
        ctx.lineTo(centerX, baseY - 10);
        ctx.lineTo(centerX + 70, baseY + 10);
        ctx.closePath();
        ctx.fill();
    } else {
        // Partially destroyed roof
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.moveTo(centerX - 70, baseY + 10);
        ctx.lineTo(centerX - 20, baseY - 5);
        ctx.lineTo(centerX, baseY + 10);
        ctx.closePath();
        ctx.fill();
    }
    
    // Windows - broken if damaged
    if (damageLevel < 0.4) {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(centerX - 45, baseY + 20, 15, 15);
        ctx.fillRect(centerX - 15, baseY + 20, 15, 15);
        ctx.fillRect(centerX + 15, baseY + 20, 15, 15);
    } else if (damageLevel < 0.7) {
        // Some broken windows
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(centerX - 45, baseY + 20, 15, 15);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(centerX - 15, baseY + 20, 15, 15);
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(centerX + 15, baseY + 20, 15, 15);
    } else {
        // All windows broken
        ctx.fillStyle = '#2F2F2F';
        ctx.fillRect(centerX - 45, baseY + 20, 15, 15);
        ctx.fillRect(centerX - 15, baseY + 20, 15, 15);
        ctx.fillRect(centerX + 15, baseY + 20, 15, 15);
    }
    
    // Door
    if (damageLevel < 0.7) {
        ctx.fillStyle = '#4A3210';
        ctx.fillRect(centerX - 8, baseY + 35, 16, 15);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(centerX + 3, baseY + 42, 3, 3);
    }
    
    // Side towers
    if (damageLevel < 0.5) {
        ctx.fillStyle = '#808080';
        ctx.fillRect(bridgeLeft + 10, baseY + 20, 25, 30);
        ctx.fillRect(bridgeRight - 35, baseY + 20, 25, 30);
        
        // Tower tops
        ctx.fillStyle = '#696969';
        ctx.fillRect(bridgeLeft + 8, baseY + 15, 29, 8);
        ctx.fillRect(bridgeRight - 37, baseY + 15, 29, 8);
    } else if (damageLevel < 0.8) {
        // Damaged towers
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(bridgeLeft + 10, baseY + 30, 25, 20);
        ctx.fillRect(bridgeRight - 35, baseY + 25, 25, 25);
    }
    
    // Flag - only if not heavily damaged
    if (damageLevel < 0.6) {
        ctx.strokeStyle = '#4A4A4A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, baseY - 10);
        ctx.lineTo(centerX, baseY - 35);
        ctx.stroke();
        
        // Flag
        ctx.fillStyle = damageLevel > 0.3 ? '#B22222' : '#FF0000';
        ctx.fillRect(centerX, baseY - 35, 20, 12);
    }
    
    // Smoke/fire if heavily damaged
    if (damageLevel > 0.7) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        for (let i = 0; i < 3; i++) {
            const smokeY = baseY + 20 - (frameCount * 0.5 + i * 15) % 40;
            ctx.beginPath();
            ctx.arc(centerX - 30 + i * 30, smokeY, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function gameLoop() {
    // Clear canvas
    drawBackground();
    
    if (gameState === 'playing') {
        frameCount++;
        
        // Handle touch shooting
        if (touchControls.shooting && frameCount % 10 === 0) {
            shoot();
        }
        if (touchControls.rocketFiring && frameCount % 60 === 0) {
            fireRocket();
        }
        
        // Update
        updatePlayer();
        
        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].update();
            if (bullets[i].y + bullets[i].height < 0) {
                bullets.splice(i, 1);
            }
        }
        
        // Update enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            enemyBullets[i].update();
            if (enemyBullets[i].y > canvas.height) {
                enemyBullets.splice(i, 1);
            }
        }
        
        // Update big boss
        if (bigBoss) {
            bigBoss.update();
        }
        
        // Update rockets
        for (let i = rockets.length - 1; i >= 0; i--) {
            rockets[i].update();
            // Remove if off screen
            if (rockets[i].x < -50 || rockets[i].x > canvas.width + 50 || 
                rockets[i].y < -50 || rockets[i].y > canvas.height + 50) {
                rockets.splice(i, 1);
            }
        }
        
        // Update enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            enemies[i].update();
            if (enemies[i].y > canvas.height) {
                // Enemy passed through - reduce lives
                lives -= enemies[i].isBoss ? 20 : 10;
                updateUI();
                enemies.splice(i, 1);
                if (lives <= 0) {
                    gameOver();
                    return;
                }
            }
        }
        
        // Update powerups
        for (let i = powerups.length - 1; i >= 0; i--) {
            powerups[i].update();
            if (powerups[i].y > canvas.height) {
                powerups.splice(i, 1);
            }
        }
        
        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }
        
        // Update muzzle flashes
        for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
            muzzleFlashes[i].update();
            if (muzzleFlashes[i].life <= 0) {
                muzzleFlashes.splice(i, 1);
            }
        }
        
        // Spawn enemies (reduced during boss fight)
        if (waveEnemiesKilled < waveEnemyTarget || isBossFight) {
            enemySpawnTimer += speedMultiplier;
            if (enemySpawnTimer >= enemySpawnRate) {
                spawnEnemy(false);
                enemySpawnTimer = 0;
            }
            
            // Spawn boss every wave (but not during big boss fight)
            if (!isBossFight) {
                bossSpawnTimer += speedMultiplier;
                if (bossSpawnTimer >= 600 && enemies.filter(e => e.isBoss).length === 0) {
                    spawnEnemy(true);
                    bossSpawnTimer = 0;
                }
            }
        }
        
        // Spawn powerups
        powerupSpawnTimer += speedMultiplier;
        if (powerupSpawnTimer >= powerupSpawnRate) {
            spawnPowerup();
            powerupSpawnTimer = 0;
        }
        
        // Check for wave completion
        if (waveEnemiesKilled >= waveEnemyTarget && enemies.length === 0) {
            // For boss fight waves, also check if big boss is defeated
            if (isBossFight && bigBoss !== null) {
                // Wait for big boss to be defeated
            } else {
                nextWave();
            }
        }
        
        // Check collisions
        checkCollisions();
        
        // Rockets vs player troops
        for (let i = rockets.length - 1; i >= 0; i--) {
            const rocket = rockets[i];
            
            for (let t = player.troops.length - 1; t >= 0; t--) {
                const troop = player.troops[t];
                const troopX = player.x + troop.offsetX;
                const troopY = player.y + troop.offsetY;
                
                if (troopX < rocket.x + rocket.width / 2 &&
                    troopX + player.width > rocket.x - rocket.width / 2 &&
                    troopY < rocket.y + rocket.height / 2 &&
                    troopY + player.height > rocket.y - rocket.height / 2) {
                    
                    // Rockets deal heavy damage - lose 3 troops
                    const actualLoss = Math.min(3, player.troops.length);
                    for (let loss = 0; loss < actualLoss; loss++) {
                        if (player.troops.length > 0) {
                            player.troops.pop();
                        }
                    }
                    
                    rebuildFormation();
                    rockets.splice(i, 1);
                    createParticles(rocket.x, rocket.y, '#FF4500', 30);
                    sounds.explosion.play(0.8);
                    updateUI();
                    
                    if (player.troops.length === 0) {
                        sounds.death.play(1);
                        stopMusic();
                        gameOver();
                        return;
                    }
                    break;
                }
            }
        }
        
        // Enemy bullets vs Player
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];
            
            // Check collision with any troop
            for (let t = player.troops.length - 1; t >= 0; t--) {
                const troop = player.troops[t];
                const troopX = player.x + troop.offsetX;
                const troopY = player.y + troop.offsetY;
                
                if (bullet.x < troopX + player.width &&
                    bullet.x + bullet.width > troopX &&
                    bullet.y < troopY + player.height &&
                    bullet.y + bullet.height > troopY) {
                    
                    // Remove the troop and bullet
                    player.troops.splice(t, 1);
                    enemyBullets.splice(i, 1);
                    
                    // Rebuild formation to maintain 3x4 grid structure
                    rebuildFormation();
                    
                    createParticles(bullet.x, bullet.y, '#1E90FF', 10);
                    sounds.hit.play(0.4);
                    updateUI();
                    
                    // Check if player has no troops left
                    if (player.troops.length === 0) {
                        sounds.death.play(1);
                        stopMusic();
                        gameOver();
                        return;
                    }
                    break;
                }
            }
        }
        
        // Draw everything
        drawPlayer();
        bullets.forEach(bullet => bullet.draw());
        enemyBullets.forEach(bullet => bullet.draw());
        rockets.forEach(rocket => rocket.draw());
        enemies.forEach(enemy => enemy.draw());
        if (bigBoss) {
            bigBoss.draw();
        }
        powerups.forEach(powerup => powerup.draw());
        particles.forEach(particle => particle.draw());
        muzzleFlashes.forEach(flash => flash.draw());
    }
    
    // Draw pause screen
    if (gameState === 'paused') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 60);
        
        ctx.font = '24px Arial';
        ctx.fillText('Press ESC to Resume', canvas.width / 2, canvas.height / 2 - 10);
        
        ctx.font = '20px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('Press M for Main Menu', canvas.width / 2, canvas.height / 2 + 30);
    }
    
    // Only continue loop if Top War is active (not ski game)
    if (typeof currentGame === 'undefined' || currentGame === null || !(currentGame instanceof SkiGame)) {
        requestAnimationFrame(gameLoop);
    }
}

// Event listeners - Now handled by ski-game.js for game mode selection

document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('game-over').classList.add('hidden');
    resetGame();
});

document.getElementById('menu-btn-gameover').addEventListener('click', () => {
    returnToMainMenu();
});

// Speed control buttons
document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        speedMultiplier = speed;
        
        // Update active state
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Initialize touch controls
initTouchControls();

// Show/hide touch controls based on game
function showTopWarControls() {
    const topwarControls = document.getElementById('topwar-touch-controls');
    const skiControls = document.getElementById('ski-touch-controls');
    if (topwarControls) topwarControls.classList.remove('hidden');
    if (skiControls) skiControls.classList.add('hidden');
}

function hideAllTouchControls() {
    const topwarControls = document.getElementById('topwar-touch-controls');
    const skiControls = document.getElementById('ski-touch-controls');
    if (topwarControls) topwarControls.classList.add('hidden');
    if (skiControls) skiControls.classList.add('hidden');
}

// Don't auto-start game loop - will be started when game mode is selected

