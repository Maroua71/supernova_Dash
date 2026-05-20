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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    canvas.style.width = "100vw";
    canvas.style.height = "100vh";

    isMobile = window.innerWidth < 768;
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
        sound.play().catch(e => console.log(e));
    } catch(e) {
        console.log(e);
    }
}

function startGlobalMusic() {
    if (bgMusic.paused) {
        bgMusic.play()
        .then(() => {
            window.removeEventListener('click', startGlobalMusic);
            window.removeEventListener('touchstart', startGlobalMusic);
            window.removeEventListener('keydown', startGlobalMusic);
        })
        .catch(e => console.log(e));
    }
}

window.addEventListener('click', startGlobalMusic);
window.addEventListener('touchstart', startGlobalMusic);
window.addEventListener('keydown', startGlobalMusic);

let baseSpeed = isMobile ? 5 : 8;
let gameSpeed = baseSpeed;

let distance = 0;
let gameOver = false;
let shield = false;

let mouse = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
};

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
    mouse.x = clientX;
    mouse.y = clientY;
}

window.addEventListener('mousemove', (e) => {
    updateCoordinates(e.clientX, e.clientY);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();

    if (e.touches.length > 0) {
        updateCoordinates(
            e.touches[0].clientX,
            e.touches[0].clientY
        );
    }
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        updateCoordinates(
            e.touches[0].clientX,
            e.touches[0].clientY
        );
    }
}, { passive: false });

const playerSvg = new Image();
playerSvg.src = 'images/ship.svg';

const obstacleFiles = [
    'images/planet 1.svg',
    'images/planet 2.svg',
    'images/planet 3.svg',
    'images/planet 4.svg',
    'images/planet 5.svg',
    'images/planet 9.svg'
];

const obstacleImages = obstacleFiles.map(f => {
    const i = new Image();
    i.src = f;
    return i;
});

const powerUpSvg = new Image();
powerUpSvg.src = 'star.svg';

const STAR_COLORS = [
    '#ffffff',
    '#ffe9c4',
    '#c4d4ff',
    '#ffd6f6'
];

class Star {
    constructor() {
        this.reset();
        this.x = Math.random() * canvas.width;
    }

    reset() {
        this.x = canvas.width + 20;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speed = (Math.random() * 0.4 + 0.2) * this.size;
        this.color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    }

    update() {
        const sm = slowMoActive ? 0.3 : 1;
        this.x -= this.speed * (gameSpeed / 5) * sm;

        if (this.x < 0) {
            this.reset();
        }
    }

    draw() {
        ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Obstacle {
    constructor(isPowerUp = false) {
        this.isPowerUp = isPowerUp;
        this.reset();
    }

    reset() {
        this.x = canvas.width + Math.random() * 300;
        this.y = Math.random() * canvas.height;

        this.size = this.isPowerUp ? 20 : 30 + Math.random() * 35;

        this.speed = gameSpeed + (this.isPowerUp ? 2 : 5);

        this.img = this.isPowerUp
            ? powerUpSvg
            : obstacleImages[Math.floor(Math.random() * obstacleImages.length)];

        this.angle = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
    }

    update() {
        const sm = slowMoActive ? 0.25 : 1;

        this.x -= this.speed * sm;
        this.angle += this.rotationSpeed * sm;

        if (this.x < -100) {
            this.reset();
        }

        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;

        const dist = Math.sqrt(dx * dx + dy * dy);

        const hitDistance = this.size + 25;

        if (dist < hitDistance) {
            if (this.isPowerUp) {
                shield = true;

                if (shieldElement) {
                    shieldElement.style.display = 'block';
                }

                playSound(soundPowerUp);
                this.reset();
            } else {
                if (gameStartTimer > 0) return;

                if (shield) {
                    shield = false;

                    if (shieldElement) {
                        shieldElement.style.display = 'none';
                    }

                    shakeIntensity = 15;

                    playSound(soundExplosion);

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
        ctx.rotate(this.angle);

        if (this.img.complete && this.img.naturalWidth > 0) {
            ctx.drawImage(
                this.img,
                -this.size,
                -this.size,
                this.size * 2,
                this.size * 2
            );
        }

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, vx, vy, size, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.life = life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

function spawnTrailParticle() {
    if (trailParticles.length > 25) return;

    const c = shield ? '#00f2ff' : '#ff00ff';

    trailParticles.push(
        new Particle(
            mouse.x - 15,
            mouse.y,
            c,
            -4 - Math.random() * 3,
            (Math.random() - 0.5) * 2,
            2,
            10
        )
    );
}

function updateDrawParticles(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].update();
        arr[i].draw();

        if (arr[i].life <= 0) {
            arr.splice(i, 1);
        }
    }
}

function animate() {
    if (!gameOver) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (shakeIntensity > 0.5) {
            ctx.save();

            ctx.translate(
                (Math.random() - 0.5) * shakeIntensity,
                (Math.random() - 0.5) * shakeIntensity
            );

            shakeIntensity *= 0.85;

            ctx.restore();
        }

        if (gameStartTimer > 0) {
            gameStartTimer--;
        }

        if (slowMoActive) {
            slowMoTimer--;

            if (slowMoTimer <= 0) {
                slowMoActive = false;
            }
        }

        stars.forEach(s => {
            s.update();
            s.draw();
        });

        const dm = slowMoActive ? 0.2 : 1;

        distance += 0.5 * dm;

        if (distElement) {
            distElement.innerText = Math.floor(distance);
        }

        gameSpeed = baseSpeed + (distance * 0.015);

        obstacles.forEach(o => {
            o.update();
            o.draw();
        });

        powerUp.update();
        powerUp.draw();

        if (Math.random() < 0.5) {
            spawnTrailParticle();
        }

        updateDrawParticles(trailParticles);

        ctx.save();

        ctx.translate(mouse.x, mouse.y);

        if (shield) {
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(0, 0, 42, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (playerSvg.complete && playerSvg.naturalWidth > 0) {
            ctx.drawImage(playerSvg, -30, -30, 60, 60);
        }

        ctx.restore();

        requestAnimationFrame(animate);
    }
}

function endGame() {
    gameOver = true;

    playSound(soundExplosion);

    bgMusic.pause();

    const scoreValue = Math.floor(distance);

    if (finalScoreElement) {
        finalScoreElement.innerText = scoreValue;
    }

    if (scoreValue > highScore) {
        highScore = scoreValue;

        localStorage.setItem('supernovaHS', highScore);
    }

    if (highScoreDisplayElement) {
        highScoreDisplayElement.innerText = highScore;
    }

    if (bestDisplayElement) {
        bestDisplayElement.innerText = highScore;
    }

    if (gameOverScreen) {
        gameOverScreen.style.display = 'flex';
    }
}

window.addEventListener('resize', () => {
    resizeCanvas();
});

canvas.style.pointerEvents = 'auto';

const stars = [];

for (let i = 0; i < 45; i++) {
    stars.push(new Star());
}

const obstacles = [];

for (let i = 0; i < 5; i++) {
    obstacles.push(new Obstacle());
}

const powerUp = new Obstacle(true);

animate();