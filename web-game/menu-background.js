// Animated Menu Background
class MenuBackground {
    constructor() {
        this.canvas = document.getElementById('menuCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.particles = [];
        this.gameIcons = [];
        this.stars = [];
        
        this.init();
    }
    
    init() {
        // Create floating particles
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: Math.random() * 800,
                y: Math.random() * 600,
                size: 2 + Math.random() * 4,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`
            });
        }
        
        // Create stars
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * 800,
                y: Math.random() * 600,
                size: 1 + Math.random() * 2,
                brightness: Math.random(),
                twinkleSpeed: 0.02 + Math.random() * 0.03
            });
        }
        
        // Create floating game icons (symbolic)
        this.gameIcons.push(
            // Top War symbols
            { x: 100, y: 150, type: 'soldier', rotation: 0, rotSpeed: 0.01, dy: 0, phase: 0 },
            { x: 200, y: 400, type: 'tank', rotation: 0, rotSpeed: -0.008, dy: 0, phase: 1 },
            { x: 700, y: 200, type: 'star', rotation: 0, rotSpeed: 0.015, dy: 0, phase: 2 },
            
            // Ski symbols
            { x: 600, y: 450, type: 'ski', rotation: 0.3, rotSpeed: 0, dy: 0, phase: 3 },
            { x: 150, y: 500, type: 'tree', rotation: 0, rotSpeed: 0, dy: 0, phase: 4 },
            { x: 650, y: 100, type: 'snowflake', rotation: 0, rotSpeed: 0.02, dy: 0, phase: 5 }
        );
    }
    
    update() {
        // Update particles
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > 800) p.vx *= -1;
            if (p.y < 0 || p.y > 600) p.vy *= -1;
        });
        
        // Update stars
        this.stars.forEach(s => {
            s.brightness += s.twinkleSpeed;
            if (s.brightness > 1 || s.brightness < 0) {
                s.twinkleSpeed *= -1;
            }
        });
        
        // Update game icons
        this.gameIcons.forEach(icon => {
            icon.rotation += icon.rotSpeed;
            icon.phase += 0.02;
            icon.dy = Math.sin(icon.phase) * 10;
        });
    }
    
    draw() {
        // Clear with gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 800, 600);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(0.5, '#764ba2');
        gradient.addColorStop(1, '#f093fb');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, 800, 600);
        
        // Draw stars
        this.stars.forEach(s => {
            this.ctx.globalAlpha = s.brightness;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
        
        // Draw particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
        
        // Draw game icons
        this.gameIcons.forEach(icon => {
            this.ctx.save();
            this.ctx.translate(icon.x, icon.y + icon.dy);
            this.ctx.rotate(icon.rotation);
            this.ctx.globalAlpha = 0.3;
            
            if (icon.type === 'soldier') {
                // Simple soldier silhouette
                this.ctx.fillStyle = '#4169E1';
                this.ctx.fillRect(-10, -15, 20, 25);
                this.ctx.beginPath();
                this.ctx.arc(0, -20, 8, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (icon.type === 'tank') {
                // Simple tank
                this.ctx.fillStyle = '#2F4F2F';
                this.ctx.fillRect(-20, -10, 40, 20);
                this.ctx.fillRect(-10, -20, 20, 15);
                this.ctx.strokeStyle = '#1a3a1a';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(0, -15);
                this.ctx.lineTo(25, -15);
                this.ctx.stroke();
            } else if (icon.type === 'star') {
                // Star powerup
                this.ctx.fillStyle = '#FFD700';
                this.ctx.strokeStyle = '#FFA500';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * 15;
                    const y = Math.sin(angle) * 15;
                    if (i === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
            } else if (icon.type === 'ski') {
                // Ski equipment
                this.ctx.strokeStyle = '#FFD700';
                this.ctx.lineWidth = 4;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                this.ctx.moveTo(-15, -20);
                this.ctx.lineTo(-10, 20);
                this.ctx.moveTo(10, -20);
                this.ctx.lineTo(15, 20);
                this.ctx.stroke();
            } else if (icon.type === 'tree') {
                // Pine tree
                this.ctx.fillStyle = '#228B22';
                this.ctx.beginPath();
                this.ctx.moveTo(0, -20);
                this.ctx.lineTo(-15, 10);
                this.ctx.lineTo(15, 10);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.fillStyle = '#654321';
                this.ctx.fillRect(-3, 10, 6, 10);
            } else if (icon.type === 'snowflake') {
                // Snowflake
                this.ctx.strokeStyle = '#E0F6FF';
                this.ctx.lineWidth = 2;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    this.ctx.moveTo(0, 0);
                    this.ctx.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
                }
                this.ctx.stroke();
            }
            
            this.ctx.restore();
        });
        this.ctx.globalAlpha = 1;
        
        // Add subtle grid pattern
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 800; i += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, 600);
            this.ctx.stroke();
        }
        for (let i = 0; i < 600; i += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(800, i);
            this.ctx.stroke();
        }
    }
    
    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
    
    show() {
        this.canvas.classList.remove('hidden');
        this.animate();
    }
    
    hide() {
        this.canvas.classList.add('hidden');
    }
}

// Initialize menu background
let menuBg = null;
document.addEventListener('DOMContentLoaded', () => {
    menuBg = new MenuBackground();
    menuBg.show();
});

// Show/hide menu background based on start screen visibility
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.id === 'start-screen') {
            if (mutation.target.classList.contains('hidden')) {
                if (menuBg) menuBg.hide();
            } else {
                if (menuBg) menuBg.show();
            }
        }
    });
});

// Observe start screen visibility changes
const startScreen = document.getElementById('start-screen');
if (startScreen) {
    observer.observe(startScreen, { attributes: true, attributeFilter: ['class'] });
}
