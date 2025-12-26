type Obstacle = {
  x: number;
  width: number;
  height: number;
  y: number;
  type: 'air' | 'ground';
  spawnTime: number;
  fake?: boolean;
};

type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  falling: boolean;
  ducking: boolean;
  displayHeight: number;
  duckTimer: number;
};

type BehaviorStore = {
  earlyJump: number;
  lastSecond: number;
  safeBias: number;
  consistency: number;
  reaction: number;
  adaptability: number;
  highScoreChase: number;
  totalRuns: number;
  highScore: number;
  highScoreStreak: number;
  [k: string]: any;
};

type BehaviorMetrics = {
  jumpCount: number;
  duckCount: number;
  jumpLeadTotal: number;
  lastSecondJumps: number;
  reactionTotal: number;
  reactionCount: number;
  highScoreAggression: number;
  actions: string[];
};

const GROUND_OFFSET = 70;
const BASE_SPEED = 4;
const MAX_SPEED = 14;
const GRAVITY = 0.45;
const JUMP_FORCE = -12.5;
const HUD_Y = 90;
const BEHAVIOR_KEY = 'adaptive-dino-behavior';

let currentCleanup: (() => void) | null = null;

export function initGame(): () => void {
  // ensure any previous instance cleaned up
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas #gameCanvas not found');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to get 2D context');

  let DPR = 1;
  let VIEW_W = 0;
  let VIEW_H = 0;

  let playerColor = localStorage.getItem('adaptiveDinoColor') || '#1d1f1c';

  const startButton = document.getElementById('start-button') as HTMLButtonElement | null;
  const restartButton = document.getElementById('restart-button') as HTMLButtonElement | null;
  const pauseButton = document.getElementById('pause-button') as HTMLButtonElement | null;
  const homeButton = document.getElementById('home-button') as HTMLButtonElement | null;

  const uiOverlay = document.getElementById('ui-overlay') as HTMLElement | null;
  const reflectionPanel = document.getElementById('reflection-panel') as HTMLElement | null;
  const finalScoreEl = document.getElementById('final-score') as HTMLElement | null;
  const insightEl = document.getElementById('insight-text') as HTMLElement | null;

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  function loadBehavior(): BehaviorStore {
    const defaults: BehaviorStore = {
      earlyJump: 0.5,
      lastSecond: 0.2,
      safeBias: 0.3,
      consistency: 0.5,
      reaction: 280,
      adaptability: 0.4,
      highScoreChase: 0.2,
      totalRuns: 0,
      highScore: 0,
      highScoreStreak: 0,
    };
    try {
      const raw = localStorage.getItem(BEHAVIOR_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      }
    } catch (err) {
      // ignore
    }
    return defaults;
  }

  const BehaviorTracker = {
    store: loadBehavior() as BehaviorStore,
    metrics: null as BehaviorMetrics | null,

    startRun(): void {
      this.metrics = {
        jumpCount: 0,
        duckCount: 0,
        jumpLeadTotal: 0,
        lastSecondJumps: 0,
        reactionTotal: 0,
        reactionCount: 0,
        highScoreAggression: 0,
        actions: [],
      };
    },

    logJump(leadDistance: number, reactionTime: number, currentScore: number) {
      if (!this.metrics) return;
      this.metrics.jumpCount += 1;
      this.metrics.jumpLeadTotal += leadDistance;
      if (leadDistance < 55) this.metrics.lastSecondJumps += 1;
      if (reactionTime > 0) {
        this.metrics.reactionTotal += reactionTime;
        this.metrics.reactionCount += 1;
      }
      if (currentScore > this.store.highScore && leadDistance < 75) {
        this.metrics.highScoreAggression += 1;
      }
      this.metrics.actions.push('jump');
    },

    logDuck() {
      if (!this.metrics) return;
      this.metrics.duckCount += 1;
      this.metrics.actions.push('duck');
    },

    finishRun(score: number) {
      const m = this.metrics;
      if (!m) return null;
      const jumpCount = Math.max(m.jumpCount, 1);
      const actionTotal = Math.max(jumpCount + m.duckCount, 1);
      const averageLead = m.jumpLeadTotal / jumpCount;
      const earlyJumpScore = clamp((averageLead - 60) / 120, 0, 1);
      const lastSecondRate = m.lastSecondJumps / jumpCount;
      const safeBias = m.duckCount / actionTotal;
      const consistency = this.calculateConsistency(m.actions);
      const reactionAverage = m.reactionCount ? m.reactionTotal / m.reactionCount : 320;
      const adaptability = clamp((320 - reactionAverage) / 260, 0, 1);
      const highScoreChase = m.highScoreAggression / jumpCount;

      const summary = {
        earlyJump: earlyJumpScore,
        lastSecond: lastSecondRate,
        safeBias,
        consistency,
        reaction: reactionAverage,
        adaptability,
        highScoreChase,
        score,
      };

      this.updateStore(summary, score > this.store.highScore);
      this.persist();
      return summary;
    },

    calculateConsistency(actions: string[]) {
      if (actions.length < 2) return 0.5;
      let matches = 0;
      for (let i = 1; i < actions.length; i += 1) {
        if (actions[i] === actions[i - 1]) matches += 1;
      }
      return matches / (actions.length - 1);
    },

    updateStore(summary: any, isNewHighScore: boolean) {
      const prevRuns = this.store.totalRuns;
      const nextRuns = prevRuns + 1;
      const blend = (oldValue: number, newValue: number) => (prevRuns ? (oldValue * prevRuns + newValue) / nextRuns : newValue);

      this.store.earlyJump = blend(this.store.earlyJump, summary.earlyJump);
      this.store.lastSecond = blend(this.store.lastSecond, summary.lastSecond);
      this.store.safeBias = blend(this.store.safeBias, summary.safeBias);
      this.store.consistency = blend(this.store.consistency, summary.consistency);
      this.store.reaction = blend(this.store.reaction, summary.reaction) || summary.reaction;
      this.store.adaptability = blend(this.store.adaptability, summary.adaptability);
      this.store.highScoreChase = blend(this.store.highScoreChase, summary.highScoreChase);
      this.store.totalRuns = nextRuns;

      if (isNewHighScore) {
        this.store.highScore = summary.score;
        this.store.highScoreStreak = (this.store.highScoreStreak || 0) + 1;
      } else {
        this.store.highScoreStreak = 0;
      }
    },

    persist() {
      try {
        localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(this.store));
      } catch (err) {
        // ignore
      }
    },

    getInsight(summary: any) {
      const candidates: string[] = [];
      if (summary.earlyJump > 0.65) candidates.push(`You jump early under uncertainty.`);
      if (summary.safeBias > 0.65) candidates.push("You tend to play it safe, even when a precise risk could pay off.");
      if (summary.highScoreChase > 0.35 && this.store.highScoreStreak >= 2) candidates.push("After long streaks, accuracy drops—a subtle reminder to breathe.");
      if (summary.reaction < 230) candidates.push("Your reactions stay sharp, especially when new patterns emerge.");
      if (summary.consistency > 0.7) candidates.push("Consistency is your anchor, and it keeps you alive.");
      if (!candidates.length) candidates.push("You kept a steady rhythm this run, nice and calm.");
      return candidates[Math.floor(Math.random() * candidates.length)];
    },
  } as {
    store: BehaviorStore;
    metrics: BehaviorMetrics | null;
    startRun: () => void;
    logJump: (leadDistance: number, reactionTime: number, currentScore: number) => void;
    logDuck: () => void;
    finishRun: (score: number) => any;
    calculateConsistency: (actions: string[]) => number;
    updateStore: (summary: any, isNewHighScore: boolean) => void;
    persist: () => void;
    getInsight: (summary: any) => string;
  };

  function deriveAdaptiveSettings() {
    const stored = BehaviorTracker.store;
    return {
      fakeChance: clamp(stored.earlyJump * 0.6, 0.05, 0.7),
      wideBoost: clamp(stored.safeBias * 0.6, 0, 0.8),
      densityMultiplier: 1 + clamp(stored.highScoreStreak * 0.15, 0, 0.6),
      speedModifier: 1 + clamp(stored.adaptability * 0.3, 0, 0.5),
    };
  }

  const player: Player = {
    x: 90,
    y: 0,
    width: 34,
    height: 42,
    vy: 0,
    falling: false,
    ducking: false,
    displayHeight: 42,
    duckTimer: 0,
  };

  const state = {
    running: false,
    paused: false,
    lastTime: 0,
    speed: BASE_SPEED,
    score: 0,
    spawnAccumulator: 0,
    spawnInterval: 1700,
    shakeTimer: 0,
  };

  const obstacles: Obstacle[] = [];
  let adaptiveSettings = deriveAdaptiveSettings();

  function canvasSize() {
    DPR = window.devicePixelRatio || 1;
    const vv = (window as any).visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    VIEW_W = Math.round(w);
    VIEW_H = Math.round(h);
    canvas.style.width = VIEW_W + 'px';
    canvas.style.height = VIEW_H + 'px';
    canvas.width = Math.round(VIEW_W * DPR);
    canvas.height = Math.round(VIEW_H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function resetGameState() {
    state.speed = BASE_SPEED;
    state.score = 0;
    state.spawnAccumulator = 0;
    state.spawnInterval = 1700;
    state.lastTime = 0;
    state.shakeTimer = 0;
    obstacles.length = 0;
    player.y = VIEW_H - GROUND_OFFSET - player.height;
    player.vy = 0;
    player.ducking = false;
    player.displayHeight = player.height;
    player.duckTimer = 0;
    player.falling = false;
  }

  function startRun() {
    resetGameState();
    adaptiveSettings = deriveAdaptiveSettings();
    BehaviorTracker.startRun();
    state.paused = false;
    state.running = true;
    reflectionPanel?.classList.remove('visible');
    reflectionPanel?.classList.add('hidden');
    uiOverlay?.classList.remove('visible');
    uiOverlay?.classList.add('hidden');
    requestAnimationFrame(step);
    updatePauseButtonState();
  }

  function endRun() {
    state.running = false;
    const summary = BehaviorTracker.finishRun(Math.floor(state.score));
    adaptiveSettings = deriveAdaptiveSettings();
    if (finalScoreEl) finalScoreEl.textContent = Math.floor(state.score).toString();
    if (insightEl) insightEl.textContent = BehaviorTracker.getInsight(summary);
    reflectionPanel?.classList.remove('hidden');
    reflectionPanel?.classList.add('visible');
    state.shakeTimer = 90;
    state.paused = false;
    updatePauseButtonState();
  }

  function goHome() {
    state.running = false;
    reflectionPanel?.classList.remove('visible');
    reflectionPanel?.classList.add('hidden');
    uiOverlay?.classList.remove('hidden');
    uiOverlay?.classList.add('visible');
  }

  const inputState = { duck: false };
  const activeDuckTouches = new Set<number>();
  const touchSideById = new Map<number, 'left' | 'right'>();

  function determineTouchSide(touch: Touch, rect: DOMRect) {
    const x = touch.clientX - rect.left;
    return x < rect.width / 2 ? 'left' : 'right';
  }

  function attemptJump() {
    if (!state.running) return;
    if (player.falling || player.ducking) return;
    player.vy = JUMP_FORCE;
    player.falling = true;
    const leadObstacle = obstacles.find((obs) => obs.x > player.x + player.width + 10);
    const leadDistance = leadObstacle ? Math.max(0, leadObstacle.x - (player.x + player.width)) : 120;
    const reactionTime = leadObstacle ? Math.max(0, performance.now() - leadObstacle.spawnTime) : 0;
    BehaviorTracker.logJump(leadDistance, reactionTime, state.score);
  }

  function attemptDuck() {
    if (!state.running) return;
    player.duckTimer = 220;
    BehaviorTracker.logDuck();
  }

  function updatePlayer(dt: number) {
    const groundY = VIEW_H - GROUND_OFFSET;
    player.ducking = inputState.duck || player.duckTimer > 0;
    if (player.duckTimer > 0) player.duckTimer -= dt;
    const targetHeight = player.ducking ? player.height * 0.6 : player.height;
    const bottom = player.y + player.displayHeight;
    if (player.displayHeight !== targetHeight) {
      player.displayHeight = targetHeight;
      player.y = bottom - player.displayHeight;
    }
    player.y += player.vy;
    player.vy += GRAVITY * dt * 0.08;
    if (player.y + player.displayHeight >= groundY) {
      player.y = groundY - player.displayHeight;
      player.vy = 0;
      player.falling = false;
    } else {
      player.falling = true;
    }
  }

  function spawnObstacle() {
    const isAir = Math.random() < 0.35;
    const airBaseWidth = 18 + Math.random() * 18;
    const groundBaseWidth = 24 + Math.random() * 26;
    const airBaseHeight = 40 + Math.random() * 18;
    const width = isAir
      ? Math.min(airBaseWidth + adaptiveSettings.wideBoost * 24, 48)
      : groundBaseWidth + adaptiveSettings.wideBoost * 60;
    const baseHeight = isAir ? airBaseHeight : 32;
    const height = baseHeight + (isAir ? adaptiveSettings.wideBoost * 8 : adaptiveSettings.wideBoost * 12);
    const x = VIEW_W + width + Math.random() * 40;
    let y: number;
    if (isAir) {
      y = VIEW_H - GROUND_OFFSET - player.displayHeight - 60 - Math.random() * 40;
    } else {
      y = VIEW_H - GROUND_OFFSET - height;
    }

    const obstacle: Obstacle = {
      x,
      width,
      height,
      y,
      type: isAir ? 'air' : 'ground',
      spawnTime: performance.now(),
      fake: Math.random() < adaptiveSettings.fakeChance,
    };

    if (obstacle.fake) {
      obstacle.type = 'air';
      obstacle.y -= 30;
      obstacle.height = 26;
    }

    obstacles.push(obstacle);
  }

  const FRAME_MS = 16.67;

  function updateObstacles(dt: number) {
    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = obstacles[i];
      const scaledSpeed = state.speed * (dt / FRAME_MS);
      obstacle.x -= scaledSpeed;
      if (obstacle.x + obstacle.width < 0) obstacles.splice(i, 1);
    }
  }

  function rectIntersect(a: any, b: any) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function applyCollision() {
    const playerRect = { x: player.x, y: player.y, width: player.width, height: player.displayHeight };
    for (const obstacle of obstacles) {
      const obstacleRect = { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };
      if (rectIntersect(playerRect, obstacleRect)) {
        endRun();
        return;
      }
    }
  }

  function updateDifficulty(dt: number) {
    state.speed += dt * 0.00006 * adaptiveSettings.speedModifier;
    state.speed = clamp(state.speed, BASE_SPEED, MAX_SPEED);
    const baseInterval = 1700;
    const density = adaptiveSettings.densityMultiplier;
    state.spawnAccumulator += dt * density;
    state.spawnInterval = Math.max(720, baseInterval / density + adaptiveSettings.wideBoost * 120) - state.speed * 6;
    if (state.spawnAccumulator > state.spawnInterval) {
      spawnObstacle();
      state.spawnAccumulator = 0;
    }
  }

  function drawScene() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    if (state.shakeTimer > 0) {
      const shake = Math.random() * 2.5;
      ctx.translate(shake, -shake);
      state.shakeTimer -= 1;
    }
    const groundY = VIEW_H - GROUND_OFFSET;
    ctx.fillStyle = '#040404ff';
    ctx.fillRect(0, groundY, VIEW_W, 6);
    ctx.fillStyle = playerColor;
    ctx.fillRect(player.x, player.y, player.width, player.displayHeight);
    obstacles.forEach((obstacle) => {
      ctx.fillStyle = obstacle.fake ? '#5c5b58' : '#1d1f1c';
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
    ctx.restore();
    ctx.fillStyle = '#1d1f1c';
    ctx.font = "600 14px 'Segoe UI', system-ui";
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(`Score ${Math.floor(state.score)}`, 24, HUD_Y);
    ctx.textAlign = 'right';
    ctx.fillText(`High ${BehaviorTracker.store.highScore || 0}`, VIEW_W - 24, HUD_Y);
  }

  function step(timestamp: number) {
    if (!state.running) return;
    if (!state.lastTime) state.lastTime = timestamp;
    const dt = Math.min(timestamp - state.lastTime, 40);
    state.lastTime = timestamp;
    if (!state.paused) {
      updateDifficulty(dt);
      updatePlayer(dt);
      updateObstacles(dt);
      applyCollision();
      state.score += dt * 0.027;
    }
    drawScene();
    requestAnimationFrame(step);
  }

  // Input handlers
  function onKeyDown(event: KeyboardEvent) {
    if ((event as any).repeat) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      attemptJump();
    }
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      inputState.duck = true;
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code === 'ArrowDown') inputState.duck = false;
  }

  function handleTouchRelease(touch: Touch, rect: DOMRect, triggerJump: boolean) {
    const id = touch.identifier;
    const side = touchSideById.get(id) ?? determineTouchSide(touch, rect);
    touchSideById.delete(id);
    if (side === 'left') {
      activeDuckTouches.delete(id);
      if (activeDuckTouches.size === 0) {
        inputState.duck = false;
      }
    } else if (triggerJump) {
      attemptJump();
    }
  }

  function onTouchStart(ev: TouchEvent) {
    if (!state.running) return;
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < ev.changedTouches.length; i += 1) {
      const touch = ev.changedTouches[i];
      const side = determineTouchSide(touch, rect);
      touchSideById.set(touch.identifier, side);
      if (side === 'left') {
        activeDuckTouches.add(touch.identifier);
        inputState.duck = true;
      }
    }
    ev.preventDefault();
  }

  function onTouchEnd(ev: TouchEvent) {
    if (!state.running) return;
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < ev.changedTouches.length; i += 1) {
      const touch = ev.changedTouches[i];
      handleTouchRelease(touch, rect, true);
    }
    ev.preventDefault();
  }

  function onTouchCancel(ev: TouchEvent) {
    if (!state.running) return;
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < ev.changedTouches.length; i += 1) {
      const touch = ev.changedTouches[i];
      handleTouchRelease(touch, rect, false);
    }
    ev.preventDefault();
  }

  // Pause button state
  const colorButtons = Array.from(document.querySelectorAll('.color-btn')) as HTMLButtonElement[];
  const updatePauseButtonState = () => {
    if (!pauseButton) return;
    if (!state.running) {
      pauseButton.classList.add('hidden');
      return;
    }
    pauseButton.classList.remove('hidden');
    pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
  };

  function applyColorSelection(color: string) {
    playerColor = color;
    document.documentElement.style.setProperty('--player-color', color);
    colorButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.color === color));
  }

  // attach listeners
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false } as AddEventListenerOptions);
  canvas.addEventListener('touchend', onTouchEnd, { passive: false } as AddEventListenerOptions);
  canvas.addEventListener('touchcancel', onTouchCancel, { passive: false } as AddEventListenerOptions);

  function onResize() { canvasSize(); }
  window.addEventListener('resize', onResize);
  if ((window as any).visualViewport) {
    (window as any).visualViewport.addEventListener('resize', onResize);
    (window as any).visualViewport.addEventListener('scroll', onResize);
  }

  // color buttons
  colorButtons.forEach((btn) => {
    const handler = () => {
      const selected = btn.dataset.color || '#1d1f1c';
      applyColorSelection(selected);
      localStorage.setItem('adaptiveDinoColor', selected);
    };
    btn.addEventListener('click', handler);
    // store handler reference so it can be removed later via closure
    (btn as any).__handler = handler;
  });

  if (pauseButton) {
    const onPause = () => {
      if (!state.running) return;
      state.paused = !state.paused;
      updatePauseButtonState();
    };
    pauseButton.addEventListener('click', onPause);
    (pauseButton as any).__handler = onPause;
  }

  applyColorSelection(playerColor);
  updatePauseButtonState();

  if (startButton) startButton.addEventListener('click', startRun);
  if (restartButton) restartButton.addEventListener('click', startRun);
  if (reflectionPanel) reflectionPanel.classList.add('hidden');
  if (uiOverlay) uiOverlay.classList.add('visible');
  if (homeButton) homeButton.addEventListener('click', goHome);

  // initial size
  canvasSize();

  // expose behavior for debugging
  (window as any).adaptiveDino = { behavior: BehaviorTracker.store };

  // Return cleanup function
  const cleanup = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('touchstart', onTouchStart as any);
    canvas.removeEventListener('touchend', onTouchEnd as any);
    canvas.removeEventListener('touchcancel', onTouchCancel as any);
    window.removeEventListener('resize', onResize);
    if ((window as any).visualViewport) {
      (window as any).visualViewport.removeEventListener('resize', onResize);
      (window as any).visualViewport.removeEventListener('scroll', onResize);
    }
    colorButtons.forEach((btn) => {
      const h = (btn as any).__handler;
      if (h) btn.removeEventListener('click', h);
      delete (btn as any).__handler;
    });
    if (pauseButton) {
      const h = (pauseButton as any).__handler;
      if (h) pauseButton.removeEventListener('click', h);
      delete (pauseButton as any).__handler;
    }
    if (startButton) startButton.removeEventListener('click', startRun);
    if (restartButton) restartButton.removeEventListener('click', startRun);
    if (homeButton) homeButton.removeEventListener('click', goHome);
  };

  currentCleanup = () => {
    cleanup();
    currentCleanup = null;
  };

  return currentCleanup;
}
