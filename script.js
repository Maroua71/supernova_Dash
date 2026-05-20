const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const distElement = document.getElementById('dist-val');
const shieldElement = document.getElementById('shield-status');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const highScoreDisplayElement = document.getElementById('high-score-val');
const bestDisplayElement = document.getElementById('best-display');
const comboElement = document.getElementById('combo-display');

let isMobile = false;

function resizeCanvas() {
    isMobile = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
    if (isMobile) {
        canvas.width = window.innerHeight;
        canvas.height = window.innerWidth;
    } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}
resizeCanvas();

const soundExplosion = new Audio('sounds/daviddumaisaudio-large-underwater-explosion-190270 (1).mp3');
const soundPowerUp = new Audio('sounds/powerup.mp3');
const soundScore = new Audio('sounds/score.mp3');
const bgMusic = new Audio('sounds/desifreemusic-background-music-mp3-free-download-267823.mp3');

bgMusic.loop = true;
bgMusic.volume = 0.3;

function playSound(sound) {
    try {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio waiting..."));
    } catch(e) {
        console.log("Sound error: ", e);
    }
}

function initAudio() {
    bgMusic.play().catch(e => console.log("Music click restriction."));
    window.removeEventListener('click', initAudio);
    window.removeEventListener('mousemove', initAudio);
    window.removeEventListener('touchstart', initAudio);
}
window.addEventListener('click', initAudio);
window.addEventListener('mousemove', initAudio);
window.addEventListener('touchstart', initAudio);

let baseSpeed = 8; 
let gameSpeed = baseSpeed;
let distance = 0;
let gameOver = false;
let shield = false;
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let holeRadius = 0;
let isAbsorbing = false;
let deathX = 0;
let deathY = 0;

let gameStartTimer = 60; 
let slowMoActive = false;
let slowMoTimer = 0;
const SLOW_MO_DURATION = 60; 
let shakeIntensity = 0;

let combo = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 120; 

let trailParticles = [];
let explosionParticles = [];

let highScore = parseInt(localStorage.getItem('supernovaHS') || '0');
if (highScoreDisplayElement) highScoreDisplayElement.innerText = highScore;
if (bestDisplayElement) bestDisplayElement.innerText = highScore;

function updateCoordinates(clientX, clientY) {
    if (isMobile) {
        mouse.x = clientY;
        mouse.y = window.innerHeight - clientX;
    } else {
        mouse.x = clientX;
        mouse.y = clientY;
    }
}

window.addEventListener('mousemove', (e) => {
    updateCoordinates(e.clientX, e.clientY);
});

window.addEventListener('touchmove', (e) => {
    if(e.touches.length > 0) {
        updateCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

window.addEventListener('touchstart', (e) => {
    if(e.touches.length > 0) {
        updateCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

const playerSvg = new Image();
playerSvg.src = 'images/ship.svg';

const obstacleFiles = [
    'images/planet 1.svg','images/planet 2.svg','images/planet 3.svg',
    'images/planet 4.svg','images/planet 5.svg',
    'images/planet 9.svg',
];
const obstacleImages = obstacleFiles.map(f => { const i = new Image(); i.src = f; return i; });

const powerUpSvg = new Image();
powerUpSvg.src = 'star.svg';

const STAR_COLORS = ['#ffffff','#ffe9c4','#c4d4ff','#ffd6f6'];
class Star {
    constructor() { this.reset(); this.x = Math.random() * canvas.width; }
    reset() {
        this.x = canvas.width + 20;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1; 
        this.speed = (Math.random() * 0.4 + 0.2) * this.size;
        this.color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
        this.alpha = Math.random();
    }
    update() {
        const sm = slowMoActive ? 0.3 : 1;
        this.x -= this.speed * (gameSpeed / 5) * sm;
        if (this.x < 0) this.reset();
    }
    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); 
        ctx.fill();
        ctx.restore();
    }
}

class Obstacle {
    constructor(isPowerUp = false) {
        this.isPowerUp = isPowerUp;
        this.vy = 0;
        this.dodged = false;
        this.behaviorType = 0; 
        this.waveTimer = 0;
        this.angleOffset = 0; 
        this.reset(true); 
    }
    reset(isInitial = false) {
        this.behaviorType = this.isPowerUp ? 0 : Math.floor(Math.random() * 3); 
        this.waveTimer = Math.random() * Math.PI * 2;

        const edgeSpawn = Math.random() < 0.4 && !this.isPowerUp;
        if (edgeSpawn) {
            const fromTop = Math.random() < 0.5;
            this.x = canvas.width * (0.5 + Math.random() * 0.5);
            this.y = fromTop ? -60 : canvas.height + 60;
            this.vy = fromTop ? (Math.random() * 2.5 + 1.5) : -(Math.random() * 2.5 + 1.5);
        } else {
            this.x = canvas.width + (isInitial ? 300 + Math.random() * canvas.width : Math.random() * 300);
            this.y = Math.random() * canvas.height;
            this.vy = 0;
        }
        
        this.size = this.isPowerUp ? 20 : 30 + Math.random() * 35; 
        this.speed = gameSpeed + (this.isPowerUp ? Math.random() * 2 : Math.random() * 5);
        this.color = this.isPowerUp ? '#ffd700' : '#ff4444';
        this.angle = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        
        if (this.isPowerUp) {
            this.img = powerUpSvg;
            this.angleOffset = 0;
        } else {
            const randomIndex = Math.floor(Math.random() * obstacleImages.length);
            this.img = obstacleImages[randomIndex];
            
            if (obstacleFiles[randomIndex].includes('planet 6.svg')) {
                this.angleOffset = Math.PI / 4; 
            } else {
                this.angleOffset = 0;
            }
        }
        
        this.dodged = false;
    }
    update() {
        const sm = slowMoActive ? 0.25 : 1;
        this.waveTimer += 0.05 * sm;

        this.x -= (this.speed + (gameSpeed - baseSpeed) * 0.5) * sm;
        
        if (!this.isPowerUp) {
            if (this.behaviorType === 1) { 
                this.y += Math.sin(this.waveTimer) * 4 * sm;
            } else if (this.behaviorType === 2) { 
                let dyPlayer = mouse.y - this.y;
                this.y += Math.sign(dyPlayer) * 1.5 * sm;
            }
        }
        
        this.y += this.vy * sm;
        this.angle += this.rotationSpeed * sm;

        if (this.x < -100 || this.y < -100 || this.y > canvas.height + 100) {
            this.reset();
        }

        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const hitDistance = this.size + 25; 

        if (!this.isPowerUp && dist < hitDistance + 30 && dist > hitDistance && !this.dodged) {
            this.dodged = true;
            incrementCombo();
        }

        if (dist < hitDistance) {
            if (this.isPowerUp) {
                shield = true;
                if (shieldElement) shieldElement.style.display = 'block';
                playSound(soundPowerUp); 
                spawnCollectParticles(this.x, this.y);
                this.reset();
            } else {
                if (gameStartTimer > 0) return;

                if (shield) {
                    shield = false;
                    if (shieldElement) shieldElement.style.display = 'none';
                    shakeIntensity = 15;
                    playSound(soundExplosion); 
                    spawnExplosionParticles(this.x, this.y, '#00f2ff');
                    this.reset();
                } else {
                    endGame();
                }
            }
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + this.angleOffset);
        if (this.img && this.img.complete && this.img.naturalWidth > 0) {
            ctx.drawImage(this.img, -this.size, -this.size, this.size * 2, this.size * 2);
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, vx, vy, size, life) {
        Object.assign(this, { x, y, color, vx, vy, size, life, maxLife: life });
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life--;
    }
    draw() {
        if (this.life <= 0) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size); 
    }
    get dead() { return this.life <= 0; }
}

function spawnTrailParticle() {
    if (trailParticles.length > 25) return; 
    const c = shield ? '#00f2ff' : '#ff00ff';
    trailParticles.push(new Particle(
        mouse.x - 15, mouse.y, c, 
        -4 - Math.random() * 3, (Math.random() - 0.5) * 2,
        2, 10
    ));
}

function spawnExplosionParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 4;
        explosionParticles.push(new Particle(x, y, color, Math.cos(angle)*spd, Math.sin(angle)*spd, 3, 25));
    }
}

function spawnCollectParticles(x, y) {
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3;
        explosionParticles.push(new Particle(x, y, '#ffd700', Math.cos(angle)*spd, Math.sin(angle)*spd, 2, 18));
    }
}

function updateDrawParticles(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].update(); arr[i].draw();
        if (arr[i].dead) arr.splice(i, 1);
    }
}

function incrementCombo() {
    combo++;
    comboTimer = COMBO_TIMEOUT;
    playSound(soundScore); 
    if (comboElement) {
        comboElement.innerText = combo > 1 ? `✕${combo} COMBO!` : 'NEAR MISS!';
        comboElement.style.opacity = '1';
    }
    distance += combo * 3; 
}

function updateCombo() {
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer <= 0) {
            combo = 0;
            if (comboElement) comboElement.style.opacity = '0';
        }
    }
}

function triggerSlowMo() {
    slowMoActive = true;
    slowMoTimer = SLOW_MO_DURATION;
}

function adjustObstaclesCount() {
    let targetCount = 3 + Math.floor(distance / 400); 
    if (targetCount > 9) targetCount = 9; 

    while (obstacles.length < targetCount) {
        obstacles.push(new Obstacle());
    }
}

function animate() {
    if (!gameOver) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        if (shakeIntensity > 0.5) {
            ctx.translate((Math.random()-0.5)*shakeIntensity, (Math.random()-0.5)*shakeIntensity);
            shakeIntensity *= 0.85;
        }

        if (!isAbsorbing) {
            if (gameStartTimer > 0) gameStartTimer--; 

            if (slowMoActive) {
                slowMoTimer--;
                if (slowMoTimer <= 0) slowMoActive = false;
            }

            stars.forEach(s => { s.update(); s.draw(); });

            const dm = slowMoActive ? 0.2 : 1;
            distance += 0.5 * dm; 
            if (distElement) distElement.innerText = Math.floor(distance);
            
            gameSpeed = baseSpeed + (distance * 0.035); 

            adjustObstaclesCount();

            obstacles.forEach(o => { o.update(); o.draw(); });
            powerUp.update(); powerUp.draw();

            if (Math.random() < 0.5) spawnTrailParticle();
            updateDrawParticles(trailParticles);
            updateDrawParticles(explosionParticles);

            updateCombo();

            ctx.save();
            ctx.translate(mouse.x, mouse.y);
            
            if (gameStartTimer > 0 && Math.floor(gameStartTimer / 6) % 2 === 0) {
                ctx.globalAlpha = 0.3; 
            }
            
            if (shield) {
                ctx.strokeStyle = '#00f2ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 42, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (playerSvg.complete && playerSvg.naturalWidth > 0) {
                ctx.drawImage(playerSvg, -30, -30, 60, 60);
            } else {
                ctx.fillStyle = '#ff00ff';
                ctx.beginPath();
                ctx.moveTo(22, 0);
                ctx.lineTo(-12, -15);
                ctx.lineTo(-6, 0);
                ctx.lineTo(-12, 15);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

        } else {
            stars.forEach(s => { s.update(); s.draw(); });
            updateDrawParticles(explosionParticles);
            drawBlackHole();
        }

        ctx.restore();
        requestAnimationFrame(animate);
    }
}

function drawBlackHole() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(deathX, deathY, holeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0014';
    ctx.fill();
    ctx.restore();

    holeRadius += 18;

    if (holeRadius > Math.max(canvas.width, canvas.height) * 1.2) {
        gameOver = true;
        updateHighScore();
        bgMusic.pause(); 
        canvas.style.pointerEvents = 'none'; 
        
        document.body.style.cursor = 'default';
        const container = document.getElementById('gameContainer');
        if (container) container.style.cursor = 'default';

        if (gameOverScreen) {
            gameOverScreen.style.display = 'flex';
            gameOverScreen.style.zIndex = '9999'; 
            gameOverScreen.style.pointerEvents = 'auto'; 
            const restartBtn = gameOverScreen.querySelector('button');
            if(restartBtn) restartBtn.focus();
        }
    }
}

function updateHighScore() {
    const score = Math.floor(distance);
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('supernovaHS', highScore);
    }
    if (highScoreDisplayElement) highScoreDisplayElement.innerText = highScore;
    if (bestDisplayElement) bestDisplayElement.innerText = highScore;
}

function endGame() {
    if (!isAbsorbing) {
        isAbsorbing = true;
        deathX = mouse.x;
        deathY = mouse.y;
        shakeIntensity = 20;
        playSound(soundExplosion); 
        spawnExplosionParticles(mouse.x, mouse.y, '#ff00ff');
        triggerSlowMo();
        const scoreValue = Math.floor(distance);
        if (finalScoreElement) finalScoreElement.innerText = scoreValue;
        updateHighScore();
    }
}

window.addEventListener('resize', () => {
    resizeCanvas();
});

canvas.style.pointerEvents = 'auto'; 
const stars = [];
for (let i = 0; i < 45; i++) stars.push(new Star()); 

const obstacles = [];
const powerUp = new Obstacle(true);

animate();