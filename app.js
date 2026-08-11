/**
 * 對對碰（Memory）— 介面與互動。翻牌找相同配對，全部配對完成即過關。
 */
import { newGame, flip, collapse, isComplete, score, hint } from "./game.js";
import { MemoryAudio } from "./audio.js";

const audio = new MemoryAudio();

const els = {
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  statMoves: document.getElementById("stat-moves"),
  statMatches: document.getElementById("stat-matches"),
  statCombo: document.getElementById("stat-combo"),
  statTime: document.getElementById("stat-time"),
  btnNew: document.getElementById("btn-new"),
  btnHint: document.getElementById("btn-hint"),
  btnMusic: document.getElementById("btn-music"),
  best: document.getElementById("best-label"),
  gridSel: document.getElementById("grid-size"),
};

const BEST_KEY = "pg-memory-best";

const CARD_FACES = [
  "card_hearts_A.png",
  "card_diamonds_A.png",
  "card_clubs_A.png",
  "card_spades_A.png",
  "card_hearts_K.png",
  "card_diamonds_K.png",
  "card_clubs_K.png",
  "card_hearts_Q.png",
  "card_diamonds_Q.png",
  "card_clubs_Q.png",
  "card_spades_Q.png",
  "card_hearts_J.png",
  "card_diamonds_J.png",
  "card_clubs_J.png",
  "card_spades_J.png",
  "card_hearts_02.png",
  "card_diamonds_02.png",
  "card_clubs_02.png",
  "card_spades_02.png",
];

const cardFace = (id) => `assets/cards/${CARD_FACES[id % CARD_FACES.length]}`;

let game = null;
let timer = 0;
let timerId = null;
let best = null;
let busy = false;

function gridSize() {
  return els.gridSel.value === "6x6" ? 6 : 4;
}

function startGame() {
  audio.unlock();
  const n = gridSize();
  game = newGame({ rows: n, cols: n });
  resetTimer();
  busy = false;
  render();
  setStatus(`翻開兩張相同的牌來配對（${game.pairs} 對）。`);
}

function resetTimer() {
  if (timerId) clearInterval(timerId);
  timer = 0;
  timerId = setInterval(() => {
    timer++;
    els.statTime.textContent = fmtTime(timer);
  }, 1000);
}

function fmtTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

function setStatus(msg, tone = "") {
  els.status.textContent = msg;
  els.status.dataset.tone = tone;
}

function handleFlip(i) {
  if (busy || !game || game.over) return;
  const { state, event } = flip(game, i);
  if (event.kind === "invalid") return;
  game = state;
  audio.select();
  render();
  if (event.kind === "match") {
    audio.match();
    setStatus(`配對成功！（連對 ×${game.combo}）`, "win");
    if (isComplete(game)) {
      const s = score(game);
      updateBest(s);
      audio.win();
      setStatus(`🎉 全部配對完成！分數 ${s} 分`, "win");
    }
  } else if (event.kind === "mismatch") {
    audio.miss();
    setStatus("不是一對，兩張翻回。");
    busy = true;
    setTimeout(() => {
      game = collapse(game);
      busy = false;
      render();
    }, 900);
  }
}

function doHint() {
  if (!game || game.over) return;
  const h = hint(game);
  if (!h) {
    setStatus("沒有可提示的牌。");
    return;
  }
  audio.hint();
  const idx = h.kind === "pair" ? h.cards : [h.card];
  idx.forEach((i) => {
    const btn = els.board.querySelector(`[data-i="${i}"]`);
    if (btn) btn.classList.add("hinted");
  });
  setStatus(h.kind === "pair" ? "提示：這兩張一對。" : "提示：翻開這張探索。");
  setTimeout(render, 1200);
}

function updateBest(s) {
  const isNew = best === null || s > best;
  if (isNew) best = s;
  els.best.textContent = best === null ? "—" : `${best} 分`;
  if (isNew) saveBest(s);
}

/* ---------- 渲染 ---------- */
function render() {
  els.statMoves.textContent = game.moves;
  els.statMatches.textContent = `${game.matches}/${game.pairs}`;
  els.statCombo.textContent = `×${game.combo}`;
  els.board.innerHTML = "";
  const n = game.rows;
  els.board.style.setProperty("--cols", String(n));
  game.cards.forEach((card, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell";
    btn.dataset.i = String(i);
    btn.setAttribute("aria-label", card.matched ? "已配對" : "蓋住的牌");
    if (card.matched) {
      btn.classList.add("matched");
      const span = document.createElement("span");
      span.className = "face";
      span.textContent = "✓";
      btn.appendChild(span);
    } else if (card.faceUp) {
      btn.classList.add("open");
      const img = document.createElement("img");
      img.src = cardFace(card.id);
      img.alt = "牌面";
      btn.appendChild(img);
    } else {
      const img = document.createElement("img");
      img.src = "assets/cards/card_back.png";
      img.alt = "蓋住的牌";
      btn.appendChild(img);
    }
    btn.addEventListener("click", () => handleFlip(i));
    els.board.appendChild(btn);
  });
}

/* ---------- 事件 ---------- */
function bindEvents() {
  els.btnNew.addEventListener("click", () => startGame());
  els.btnHint.addEventListener("click", () => {
    audio.unlock();
    doHint();
  });
  els.btnMusic.addEventListener("click", () => {
    const on = audio.enabled;
    audio.setEnabled(!on);
    els.btnMusic.setAttribute("aria-pressed", String(!on));
    els.btnMusic.textContent = on ? "聲音關" : "聲音開";
  });
  els.gridSel.addEventListener("change", () => startGame());
}

/* ---------- KV ---------- */
async function loadBest() {
  try {
    const res = await fetch(`/api/kv/${BEST_KEY}`);
    if (res.ok) {
      const t = (await res.text()).trim();
      if (/^\d+$/.test(t)) {
        best = Number(t);
        els.best.textContent = `${best} 分`;
        return;
      }
    }
  } catch {
    /* 無 KV */
  }
  els.best.textContent = "—";
}

async function saveBest(v) {
  try {
    await fetch(`/api/kv/${BEST_KEY}`, { method: "PUT", body: String(v) });
  } catch {
    /* 無 KV */
  }
}

/* ---------- 啟動 ---------- */
async function init() {
  bindEvents();
  await loadBest();
  startGame();
}

init();