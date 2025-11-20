const container = document.getElementById('game-container');
const canvas = document.getElementById('game-canvas');

if (container && !container.hasAttribute('tabindex')) {
    container.setAttribute('tabindex', '0'); // make focusable so it can receive keyboard focus
}

// Focus container when clicked so keyboard controls are obvious
container?.addEventListener('click', () => {
    container.focus();
    console.log('Game container focused');
});

// Log canvas clicks (useful for debugging/touch start)
canvas?.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    console.log('Canvas click at', { x, y });
});

// ...existing code...

// Replace the previous handleKeyDown logging-only behavior with real actions
function handleKeyDown(e) {
    const k = e.key;
    let action = null;

    if (['ArrowUp', 'w', 'W'].includes(k)) {
        action = 'up';
        e.preventDefault();
    } else if (['ArrowDown', 's', 'S'].includes(k)) {
        action = 'down';
        e.preventDefault();
    } else if (['ArrowLeft', 'a', 'A'].includes(k)) {
        action = 'left';
        e.preventDefault();
    } else if (['ArrowRight', 'd', 'D'].includes(k)) {
        action = 'right';
        e.preventDefault();
    } else if (k === ' ' || k === 'Spacebar') {
        action = 'pause';
        e.preventDefault();
    } else if (k === 'Enter') {
        action = 'restart';
    } else {
        console.log('Key pressed:', k);
    }

    if (action) {
        console.log('Input action:', action, '(key:', k + ')');
        if (action === 'pause') togglePause();
        else if (action === 'restart') restartGame();
        else setDirection(action);
    }
}

// Use window listener so input is captured even if focus isn't perfect
window.addEventListener('keydown', handleKeyDown);

// Basic swipe detection for touch controls (mobile)
let touchStart = null;
canvas?.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
}, { passive: true });

canvas?.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const elapsed = Date.now() - touchStart.time;

    // require a short-ish swipe with some minimum distance
    if (elapsed < 1000 && Math.max(absX, absY) > 30) {
        let swipe = null;
        if (absX > absY) swipe = dx > 0 ? 'right' : 'left';
        else swipe = dy > 0 ? 'down' : 'up';
        console.log('Touch swipe action:', swipe);
        setDirection(swipe);
    }

    touchStart = null;
}, { passive: true });

// Inform that the input system is ready
console.log('Input listeners attached: keyboard, click, touch (if available).');

// ----------------------
// Game logic and rendering
// ----------------------

const ctx = canvas.getContext('2d');

// Grid configuration
const CELL = 20; // grid cell size in pixels
const COLS = Math.floor(canvas.width / CELL);
const ROWS = Math.floor(canvas.height / CELL);

let snake = []; // array of {x,y} positions on grid
let dir = { x: 1, y: 0 }; // current movement direction
let nextDir = { x: 1, y: 0 }; // to queue direction without immediate reversal
let food = null;
let score = 0;
let running = false;
let paused = false;
let gameOver = false;

// Timing control
const SPEED = 8; // moves per second
let accumulator = 0;
let lastTime = 0;

function initGame() {
    snake = [
        { x: Math.floor(COLS / 2) - 1, y: Math.floor(ROWS / 2) },
        { x: Math.floor(COLS / 2) - 2, y: Math.floor(ROWS / 2) },
        { x: Math.floor(COLS / 2) - 3, y: Math.floor(ROWS / 2) }
    ];
    dir = { x: 1, y: 0 };
    nextDir = { ...dir };
    score = 0;
    paused = false;
    gameOver = false;
    placeFood();
    running = true;
    accumulator = 0;
    lastTime = performance.now();
    window.requestAnimationFrame(gameLoop);
    console.log('Game started');
}

function restartGame() {
    console.log('Restarting game');
    initGame();
}

function togglePause() {
    if (gameOver) return;
    paused = !paused;
    console.log(paused ? 'Game paused' : 'Game resumed');
    if (!paused) {
        // reset time so the loop continues smoothly
        lastTime = performance.now();
        window.requestAnimationFrame(gameLoop);
    }
}

function placeFood() {
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
    let fx, fy;
    do {
        fx = Math.floor(Math.random() * COLS);
        fy = Math.floor(Math.random() * ROWS);
    } while (occupied.has(`${fx},${fy}`));
    food = { x: fx, y: fy };
}

function setDirection(action) {
    const map = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
    };
    if (!map[action]) return;
    const nd = map[action];

    // Prevent reversing into itself: disallow if nd is opposite of current dir
    if (nd.x === -dir.x && nd.y === -dir.y) {
        // ignore
        return;
    }
    nextDir = nd;
}

function update() {
    if (!running || paused || gameOver) return;

    // Apply queued direction
    dir = { ...nextDir };

    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
        gameOver = true;
        running = false;
        console.log('Game over: hit wall');
        return;
    }

    // Self collision
    if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        gameOver = true;
        running = false;
        console.log('Game over: collided with self');
        return;
    }

    // Add new head
    snake.unshift(newHead);

    // Check food
    if (food && newHead.x === food.x && newHead.y === food.y) {
        score += 1;
        console.log('Ate food. Score:', score);
        placeFood();
        // do not remove tail -> snake grows
    } else {
        // remove tail -> snake moves
        snake.pop();
    }
}

function draw() {
    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background (dark)
    ctx.fillStyle = '#081325';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw grid (optional subtle)
    /*
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    for (let x = 0; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(canvas.width, y * CELL);
        ctx.stroke();
    }
    */

    // draw food
    if (food) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(food.x * CELL + 1, food.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // draw snake
    for (let i = 0; i < snake.length; i++) {
        const s = snake[i];
        ctx.fillStyle = i === 0 ? '#10b981' : '#34d399';
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // draw score / state
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '16px system-ui, Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${score}`, 8, 8);

    if (paused) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '24px system-ui, Arial';
        ctx.fillText('Paused', canvas.width / 2 - 36, canvas.height / 2 - 12);
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '28px system-ui, Arial';
        ctx.fillText('Game Over', canvas.width / 2 - 72, canvas.height / 2 - 14);
        ctx.font = '16px system-ui, Arial';
        ctx.fillText('Press Enter to restart', canvas.width / 2 - 84, canvas.height / 2 + 18);
    }
}

function gameLoop(time) {
    if (!running) return;
    if (paused) {
        // still draw paused screen
        draw();
        return;
    }

    const dt = (time - lastTime) / 1000; // seconds
    lastTime = time;
    accumulator += dt;

    const step = 1 / SPEED;
    while (accumulator >= step) {
        update();
        accumulator -= step;
    }

    draw();

    if (running) {
        window.requestAnimationFrame(gameLoop);
    }
}

// Start game automatically when file loads
initGame();

// ...existing code...