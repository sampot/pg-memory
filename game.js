/**
 * 對對碰（Memory）— 純邏輯：發牌、翻牌判定、配對、連對、提示 AI 與計分。
 * 純函式設計，方便單元測試（不碰 DOM）。
 *
 * 規則：
 *  所有牌面朝下。先翻一張，再翻第二張找相同。相同 → 配對成功（牌固定翻開），
 *  不同 → 短暫顯示後由 UI 呼叫 collapse() 翻回。全部配對完成即過關。
 */

/** Fisher–Yates 洗牌，回傳新陣列。 */
export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 建立一組牌面：pairs 種圖案，每種恰好兩張（id 0..pairs-1），已洗牌。 */
export function createDeck(pairs, rand = Math.random) {
  if (!Number.isInteger(pairs) || pairs < 1) {
    throw new Error("pairs must be a positive integer");
  }
  const ids = [];
  for (let i = 0; i < pairs; i++) ids.push(i, i);
  return shuffle(ids, rand).map((id) => ({ id, faceUp: false, matched: false }));
}

/**
 * 新一局。rows/cols 決定盤面（牌數 = rows×cols），pairs 可覆寫。
 * seen 記錄已看過的牌面 id（供提示 AI 使用）。
 */
export function newGame({ rows = 4, cols = 4, pairs, rand = Math.random } = {}) {
  const pairCount = pairs ?? Math.floor((rows * cols) / 2);
  return {
    rows,
    cols,
    pairs: pairCount,
    cards: createDeck(pairCount, rand),
    first: null,
    moves: 0,
    matches: 0,
    combo: 0,
    bestCombo: 0,
    seen: new Set(),
    over: false,
  };
}

function clone(state) {
  return {
    ...state,
    cards: state.cards.map((c) => ({ ...c })),
    seen: new Set(state.seen),
  };
}

/**
 * 翻開 index 處的牌。
 * 回傳 { state, event }；event.kind：
 *  - "first"：第一張翻開（等第二張）。
 *  - "match"：配對成功；first/second 為兩張索引。
 *  - "mismatch"：不同；兩張維持翻開，由呼叫端延遲後以 collapse() 翻回。
 *  - "invalid"：遊戲已結束（reason "over"）、牌不可翻（"unavailable"）或重複點同一張（"same"）。
 */
export function flip(state, i) {
  if (state.over) return { state, event: { kind: "invalid", reason: "over" } };
  const card = state.cards[i];
  if (!card || card.matched || card.faceUp) {
    return { state, event: { kind: "invalid", reason: "unavailable" } };
  }
  if (state.first === null) {
    const s = clone(state);
    s.cards[i] = { ...s.cards[i], faceUp: true };
    s.seen.add(s.cards[i].id);
    s.first = i;
    return { state: s, event: { kind: "first" } };
  }
  if (state.first === i) return { state, event: { kind: "invalid", reason: "same" } };
  const a = state.first;
  const s = clone(state);
  s.cards[i] = { ...s.cards[i], faceUp: true };
  s.seen.add(s.cards[i].id);
  s.moves++;
  if (s.cards[a].id === s.cards[i].id) {
    s.cards[a] = { ...s.cards[a], matched: true };
    s.cards[i] = { ...s.cards[i], matched: true };
    s.matches++;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.first = null;
    if (s.matches === s.pairs) s.over = true;
    return { state: s, event: { kind: "match", first: a, second: i } };
  }
  s.combo = 0;
  s.first = null;
  return { state: s, event: { kind: "mismatch", first: a, second: i } };
}

/** 把未配對且翻開的牌全部翻回（誤翻清理）。 */
export function collapse(state) {
  const s = clone(state);
  s.cards = s.cards.map((c) =>
    c.faceUp && !c.matched ? { ...c, faceUp: false } : c
  );
  return s;
}

/** 是否已全部配對完成。 */
export function isComplete(state) {
  return state.over || state.matches >= state.pairs;
}

/**
 * 分數：每對 100 分，扣步數×2，加最高連對×5。
 * 僅完成時計分；未完成回傳 null。
 */
export function score(state) {
  if (!isComplete(state)) return null;
  const base = state.pairs * 100;
  const penalty = state.moves * 2;
  const bonus = state.bestCombo * 5;
  return Math.max(0, base - penalty + bonus);
}

/**
 * 提示（簡單 AI）：
 *  - 已知兩張相同且皆未配對 → { kind: "pair", cards: [i, j] }
 *  - 否則建議探索一張沒看過、未翻開的牌 → { kind: "explore", card: i }
 *  - 遊戲結束或沒有可翻的牌 → null
 */
export function hint(state) {
  if (state.over) return null;
  const known = new Map();
  for (let i = 0; i < state.cards.length; i++) {
    const c = state.cards[i];
    if (c.matched || c.faceUp) continue;
    if (!state.seen.has(c.id)) continue;
    if (known.has(c.id)) {
      return { kind: "pair", cards: [known.get(c.id), i] };
    }
    known.set(c.id, i);
  }
  for (let i = 0; i < state.cards.length; i++) {
    const c = state.cards[i];
    if (c.matched || c.faceUp) continue;
    if (!state.seen.has(c.id)) return { kind: "explore", card: i };
  }
  return null;
}
