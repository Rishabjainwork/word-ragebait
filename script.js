const GOAL = 36; // 3 points per level × 12 levels
const MAX_LEVEL = 12;
const BUTTON_W = 130;
const BUTTON_H = 40;
const SAFE_GAP = 10;
const livesIcons = ['', '❤️', '❤️❤️', '❤️❤️❤️'];

const taunts = [
  "lmao no.", "skill issue", "that was embarrassing", "oh honey...",
  "not even close 💀", "are you even trying?", "the label was RIGHT THERE",
  "incredible. wrong again.", "my grandma clicks faster", "bro what",
  "you had one job", "classic.", "use your eyes???",
  "it literally told you which one", "maybe try glasses",
  "how 💀", "touch grass and try again", "LMAOOO",
  "that hurt to watch", "respectfully, you're cooked",
  "the audacity", "delete your account", "truly shocking",
];

const deathTaunts = [
  "Uninstall your hands.",
  "We're genuinely concerned for you.",
  "This was painful to watch.",
  "Maybe try a different hobby.",
  "Error 404: Skill not found.",
  "Even the buttons feel bad for you.",
  "You died at level " + "?. Incredible.",
  "Your mouse called. It quit.",
];

const labels = [
  "Click me", "Yes this one", "HERE", "Not that one", "Obviously me",
  "This button", "Correct", "Me!!!", "Pick me", "Right here",
  "This one", "Choose me", "Press here", "→ ME ←", "YES",
  "Over here", "No wait, me", "CLICK!", "Try me", "I'm the one",
];

// Level definitions — each level has a name + description shown briefly
const LEVEL_DEFS = [
  { name: "TUTORIAL",    desc: "Just click the right one. Easy.",              color: "var(--green)"  },
  { name: "MOVING",      desc: "Buttons move now. Keep up.",                   color: "var(--green)"  },
  { name: "FASTER",      desc: "Speed increased. You got this... maybe.",      color: "var(--green)"  },
  { name: "THE TARGET RUNS", desc: "The correct button moves too now. Fun.",  color: "var(--yellow)" },
  { name: "CHAOS",       desc: "Everything moves. Reshuffles on wrong click.", color: "var(--yellow)" },
  { name: "BLINK",       desc: "Buttons randomly go invisible. Stay focused.", color: "var(--yellow)" },
  { name: "SWAP",        desc: "Labels swap randomly. Read fast.",             color: "var(--accent2)"},
  { name: "FAKE NEWS",   desc: "Instruction flickers to wrong labels. Trust nothing.", color: "var(--accent2)"},
  { name: "SHRINK",      desc: "Buttons shrink as time passes. Click fast.",   color: "var(--accent)" },
  { name: "SPEED DEMON", desc: "Everything is faster. Much faster.",           color: "var(--accent)" },
  { name: "NIGHTMARE",   desc: "All mechanics active. We're sorry.",           color: "var(--accent)" },
  { name: "FINAL BOSS",  desc: "One chance. One life. One click. Good luck.", color: "#ff00ff"       },
];

let score = 0, lives = 3, level = 1, combo = 0, attempts = 0, bestScore = 0;
let timer = 0; let timerInterval = null;
let targetIdx = 0, buttons = [], moveTimer = null, switchTimer = null;
let blinkTimer = null, shrinkTimer = null, fakeTimer = null;
let gameActive = false;
let shrinkAmount = 1.0;

function $(id) { return document.getElementById(id); }

function loadBestScore() {
  try {
    bestScore = Number(localStorage.getItem('ragebait-best-score')) || 0;
  } catch (e) {
    bestScore = 0;
  }
}

function saveBestScore() {
  if (score <= bestScore) return;
  bestScore = score;
  try {
    localStorage.setItem('ragebait-best-score', String(bestScore));
  } catch (e) {}
}

function accuracyText() {
  if (!attempts) return '100%';
  return Math.round((score / attempts) * 100) + '%';
}

function startTimer() {
  clearInterval(timerInterval);

  timer = 0;
  $('timer').textContent = '0s';

  timerInterval = setInterval(() => {
    timer++;
    $('timer').textContent = timer + 's';
  }, 1000);
}

function toast(msg, color) {
  const t = $('toast');
  t.textContent = msg;
  t.style.borderLeftColor = color || 'var(--accent)';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2000);
}

function showLevelBanner(lvl) {
  const def = LEVEL_DEFS[lvl - 1] || LEVEL_DEFS[LEVEL_DEFS.length - 1];
  const banner = $('level-banner');
  $('banner-name').textContent = `LEVEL ${lvl}: ${def.name}`;
  $('banner-desc').textContent = def.desc;
  $('banner-name').style.color = def.color;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2200);
}

function showScreen(id) {
  ['start-screen', 'gameover-screen', 'win-screen'].forEach(s => {
    $(s).classList.remove('active');
  });
  if (id) $(id).classList.add('active');
}

function updateUI() {
  saveBestScore();
  $('score').textContent = score;
  $('lives').textContent = livesIcons[Math.max(0, Math.min(lives, 3))] || '';
  $('level').textContent = level;
  $('lvl-inner').textContent = level;
  const pct = (score / GOAL) * 100;
  $('progress-bar').style.width = pct + '%';
  $('progress-bar').style.background =
    pct > 80 ? '#ff00ff' :
    pct > 66 ? 'var(--yellow)' :
    pct > 33 ? 'var(--accent2)' : 'var(--green)';
  $('footer-hint').textContent =
    `LEVEL ${level}/12 — ${GOAL - score} points to win — BEST ${bestScore}`;
}

function getArena() {
  const a = $('arena');
  return { w: a.clientWidth, h: a.clientHeight };
}

function randPos(bw, bh) {
  const { w, h } = getArena();
  return {
    x: 12 + Math.random() * Math.max(0, w - bw - 24),
    y: 38 + Math.random() * Math.max(0, h - bh - 64),
  };
}

function overlaps(a, b) {
  return !(
    a.x + a.w + SAFE_GAP < b.x ||
    b.x + b.w + SAFE_GAP < a.x ||
    a.y + a.h + SAFE_GAP < b.y ||
    b.y + b.h + SAFE_GAP < a.y
  );
}

function buttonRect(btn) {
  return {
    x: parseFloat(btn.style.left) || 0,
    y: parseFloat(btn.style.top) || 0,
    w: btn.offsetWidth || BUTTON_W,
    h: btn.offsetHeight || BUTTON_H,
  };
}

function findFreePos(bw, bh, occupied) {
  let fallback = randPos(bw, bh);
  for (let tries = 0; tries < 40; tries++) {
    const pos = randPos(bw, bh);
    const rect = { x: pos.x, y: pos.y, w: bw, h: bh };
    if (!occupied.some(other => overlaps(rect, other))) return pos;
    fallback = pos;
  }
  return fallback;
}

function moveButtonTo(btn, excludedIndex) {
  const occupied = buttons
    .filter((_, i) => i !== excludedIndex)
    .map(buttonRect);
  const pos = findFreePos(BUTTON_W, BUTTON_H, occupied);
  btn.style.left = pos.x + 'px';
  btn.style.top = pos.y + 'px';
}

function keepButtonsInBounds() {
  const { w, h } = getArena();
  buttons.forEach(btn => {
    const maxX = Math.max(12, w - (btn.offsetWidth || BUTTON_W) - 12);
    const maxY = Math.max(38, h - (btn.offsetHeight || BUTTON_H) - 26);
    const x = Math.min(Math.max(12, parseFloat(btn.style.left) || 12), maxX);
    const y = Math.min(Math.max(38, parseFloat(btn.style.top) || 38), maxY);
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
  });
}

function clearTimers() {
  clearInterval(moveTimer);
  clearInterval(switchTimer);
  clearInterval(blinkTimer);
  clearInterval(shrinkTimer);
  clearInterval(fakeTimer);
  moveTimer = switchTimer = blinkTimer = shrinkTimer = fakeTimer = null;
}

function clearButtons() {
  const arena = $('arena');
  buttons.forEach(b => { try { arena.removeChild(b); } catch(e){} });
  buttons = [];
}

function createButtons() {
  clearButtons();
  shrinkAmount = 1.0;
  const arena = $('arena');

  // Level 12: only 2 buttons, 1 life
  const count = level === MAX_LEVEL
    ? 2
    : Math.min(2 + Math.floor(level * 0.75), 9);

  const pool = [...labels].sort(() => Math.random() - 0.5).slice(0, count);
  const occupied = [];
  targetIdx = Math.floor(Math.random() * count);
  $('target-label').textContent = '"' + pool[targetIdx] + '"';
  $('target-label').style.opacity = '1';

  pool.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn-target';
    btn.textContent = label;
    btn.style.width = BUTTON_W + 'px';
    const pos = findFreePos(BUTTON_W, BUTTON_H, occupied);
    btn.style.left = pos.x + 'px';
    btn.style.top = pos.y + 'px';
    btn.dataset.index = i;
    btn.addEventListener('click', () => handleClick(i, btn));
    arena.appendChild(btn);
    buttons.push(btn);
    occupied.push({ x: pos.x, y: pos.y, w: BUTTON_W, h: BUTTON_H });
  });
}

function startMoving() {
  clearTimers();

  // --- MOVE TIMER (level 2+) ---
  if (level >= 2) {
    const speed = Math.max(180, 1600 - level * 120);
    moveTimer = setInterval(() => {
      if (!gameActive) return;
      const wrongIdxs = buttons.map((_, i) => i).filter(i => i !== targetIdx);
      if (wrongIdxs.length > 0) {
        const pick = wrongIdxs[Math.floor(Math.random() * wrongIdxs.length)];
        moveButtonTo(buttons[pick], pick);
      }
      // Level 4+: correct button also moves
      if (level >= 4 && Math.random() < 0.55) {
        moveButtonTo(buttons[targetIdx], targetIdx);
      }
    }, speed);
  }

  // --- BLINK (level 6+) ---
  if (level >= 6) {
    blinkTimer = setInterval(() => {
      if (!gameActive) return;
      const wrongIdxs = buttons.map((_, i) => i).filter(i => i !== targetIdx);
      if (wrongIdxs.length === 0) return;
      const pick = wrongIdxs[Math.floor(Math.random() * wrongIdxs.length)];
      const btn = buttons[pick];
      btn.style.opacity = '0';
      setTimeout(() => { if (btn) btn.style.opacity = '1'; }, 350 + Math.random() * 300);
      // Level 10+: correct button blinks too
      if (level >= 10 && Math.random() < 0.4) {
        const tb = buttons[targetIdx];
        tb.style.opacity = '0';
        setTimeout(() => { if (tb) tb.style.opacity = '1'; }, 300);
      }
    }, Math.max(500, 1400 - level * 80));
  }

  // --- LABEL SWAP (level 7+) ---
  if (level >= 7) {
    switchTimer = setInterval(() => {
      if (!gameActive || buttons.length < 2) return;
      const i = Math.floor(Math.random() * buttons.length);
      const j = (i + 1 + Math.floor(Math.random() * (buttons.length - 1))) % buttons.length;
      const tmp = buttons[i].textContent;
      buttons[i].textContent = buttons[j].textContent;
      buttons[j].textContent = tmp;
      $('target-label').textContent = '"' + buttons[targetIdx].textContent + '"';
    }, Math.max(600, 1200 - level * 60));
  }

  // --- FAKE INSTRUCTION FLICKER (level 8+) ---
  if (level >= 8) {
    fakeTimer = setInterval(() => {
      if (!gameActive) return;
      const realLabel = buttons[targetIdx] ? buttons[targetIdx].textContent : '';
      // flash a random wrong label for 400ms
      const wrongBtns = buttons.filter((_, i) => i !== targetIdx);
      if (wrongBtns.length === 0) return;
      const fakeLabel = wrongBtns[Math.floor(Math.random() * wrongBtns.length)].textContent;
      $('target-label').textContent = '"' + fakeLabel + '"';
      $('target-label').style.color = 'var(--accent)';
      setTimeout(() => {
        if (!gameActive) return;
        const current = buttons[targetIdx] ? buttons[targetIdx].textContent : realLabel;
        $('target-label').textContent = '"' + current + '"';
        $('target-label').style.color = '';
      }, 400);
    }, Math.max(1200, 2800 - level * 150));
  }

  // --- SHRINK (level 9+) ---
  if (level >= 9) {
    shrinkAmount = 1.0;
    shrinkTimer = setInterval(() => {
      if (!gameActive) return;
      shrinkAmount = Math.max(0.55, shrinkAmount - 0.04);
      buttons.forEach(btn => {
        btn.style.transform = `scale(${shrinkAmount})`;
        btn.style.fontSize = Math.max(9, 13 * shrinkAmount) + 'px';
      });
      if (shrinkAmount <= 0.56) {
        // reset sizes
        shrinkAmount = 1.0;
        buttons.forEach(btn => {
          btn.style.transform = 'scale(1)';
          btn.style.fontSize = '13px';
        });
      }
    }, 600);
  }
}

function handleClick(i, btn) {
  if (!gameActive) return;
  attempts++;

  if (i === targetIdx) {
    combo++;
    score++;
    btn.classList.add('correct-flash');
    setTimeout(() => btn.classList.remove('correct-flash'), 200);

    if (combo >= 3) {
      $('combo').textContent = `🔥 COMBO x${combo}`;
      $('combo').classList.add('hot');
    }

    // level up every 3 points
    const newLevel = Math.min(Math.floor(score / 3) + 1, MAX_LEVEL);
    if (newLevel > level) {
      level = newLevel;
      showLevelBanner(level);
      // Level 12: steal a life
      if (level === MAX_LEVEL) {
        lives = 1;
        toast("FINAL BOSS — ONE LIFE REMAINING", "#ff00ff");
      }
    }

    updateUI();

    if (score >= GOAL) {
      gameActive = false;
      clearTimers();
      clearInterval(timerInterval);
      saveBestScore();
      $('win-score').textContent =
        `SCORE: ${score} | BEST: ${bestScore} | ACCURACY: ${accuracyText()}`;
      showScreen('win-screen');
      return;
    }

    createButtons();
    startMoving();

  } else {
    combo = 0;
    lives--;
    $('combo').textContent = '';
    $('combo').classList.remove('hot');
    btn.classList.add('wrong-flash');
    document.body.classList.add('miss-flash');
    setTimeout(() => btn.classList.remove('wrong-flash'), 400);
    setTimeout(() => document.body.classList.remove('miss-flash'), 180);
    toast(taunts[Math.floor(Math.random() * taunts.length)]);
    updateUI();

    if (lives <= 0) {
      gameActive = false;
      clearTimers();
      clearInterval(timerInterval);
      saveBestScore();
      $('go-score').textContent =
        `SCORE: ${score} | LEVEL: ${level} | ACCURACY: ${accuracyText()}`;
      const dt = deathTaunts[Math.floor(Math.random() * deathTaunts.length)];
      $('go-taunt').textContent = dt.replace('?', level);
      showScreen('gameover-screen');
      return;
    }

    // level 5+: reshuffle on wrong click
    if (level >= 5) {
      createButtons();
      startMoving();
    }
  }
}

function startGame() {
  score = 0; lives = 3; level = 1; combo = 0; attempts = 0;
  gameActive = true;
  startTimer();
  clearTimers();
  updateUI();
  $('combo').textContent = '';
  $('combo').classList.remove('hot');
  $('target-label').style.color = '';
  showScreen(null);
  showLevelBanner(1);
  createButtons();
  startMoving();
}

loadBestScore();
updateUI();

window.addEventListener('resize', keepButtonsInBounds);

document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && !gameActive) {
    event.preventDefault();
    startGame();
  }
});
