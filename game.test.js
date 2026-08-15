import { describe, it, expect } from "vitest";
import {
  createDeck,
  newGame,
  flip,
  collapse,
  isComplete,
  score,
  hint,
} from "./game.js";

describe("createDeck", () => {
  it("produces pairs×2 cards with exactly two of each id", () => {
    const deck = createDeck(8);
    expect(deck).toHaveLength(16);
    const counts = new Map();
    for (const c of deck) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    expect(counts.size).toBe(8);
    for (const [id, n] of counts) {
      expect(n).toBe(2, `id ${id} should appear twice`);
    }
  });

  it("rejects invalid pair count", () => {
    expect(() => createDeck(0)).toThrow();
    expect(() => createDeck(-2)).toThrow();
    expect(() => createDeck(2.5)).toThrow();
  });

  it("respects a seeded random generator for determinism", () => {
    const mkRand = (seed) => {
      let s = seed;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    };
    const a = createDeck(6, mkRand(42));
    const b = createDeck(6, mkRand(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});

describe("newGame", () => {
  it("creates a 4×4 board with 8 pairs face down", () => {
    const g = newGame({ rows: 4, cols: 4 });
    expect(g.cards).toHaveLength(16);
    expect(g.pairs).toBe(8);
    expect(g.cards.every((c) => !c.faceUp && !c.matched)).toBe(true);
  });

  it("defaults to 4×4 when given only rows", () => {
    const g = newGame({ rows: 4 });
    expect(g.cards).toHaveLength(16);
    expect(g.cols).toBe(4);
  });
});

describe("flip", () => {
  it("first flip opens a card and reports 'first'", () => {
    const g = newGame({ pairs: 4 });
    const { state, event } = flip(g, 0);
    expect(event.kind).toBe("first");
    expect(state.cards[0].faceUp).toBe(true);
    expect(state.first).toBe(0);
  });

  it("matching second card marks both matched and increments combo", () => {
    const g = newGame({ pairs: 2, rand: () => 0.5 });
    // find two cards of the same id
    const a = 0;
    const b = g.cards.findIndex((c, i) => i !== a && c.id === g.cards[a].id);
    let s = g;
    s = flip(s, a).state;
    const r = flip(s, b);
    expect(r.event.kind).toBe("match");
    expect(r.state.cards[a].matched).toBe(true);
    expect(r.state.cards[b].matched).toBe(true);
    expect(r.state.matches).toBe(1);
    expect(r.state.combo).toBe(1);
  });

  it("mismatch keeps both face up and resets combo", () => {
    const g = newGame({ pairs: 4 });
    let s = g;
    s = flip(s, 0).state;
    // pick an index whose id differs from cards[0]
    const b = g.cards.findIndex((c) => c.id !== g.cards[0].id);
    const r = flip(s, b);
    expect(r.event.kind).toBe("mismatch");
    expect(r.state.cards[0].faceUp).toBe(true);
    expect(r.state.cards[b].faceUp).toBe(true);
    expect(r.state.combo).toBe(0);
    expect(r.state.moves).toBe(1);
  });

  it("rejects flipping an already-face-up or matched card", () => {
    const g = newGame({ pairs: 4 });
    let s = g;
    s = flip(s, 0).state;
    const r = flip(s, 0);
    expect(r.event.kind).toBe("invalid");
    expect(r.event.reason).toBe("unavailable");
  });

  it("rejects play after game over", () => {
    let g = newGame({ pairs: 1 });
    g = flip(g, 0).state;
    const r = flip(g, 1);
    expect(r.event.kind).toBe("match");
    expect(r.state.over).toBe(true);
    const again = flip(r.state, 0);
    expect(again.event.kind).toBe("invalid");
    expect(again.event.reason).toBe("over");
  });

  it("completes a full game and wins", () => {
    const g = newGame({ pairs: 3, rand: () => 0.5 });
    let s = g;
    const matchedIds = new Set();
    // iterate: always flip an unmatched card, then its mate
    while (!s.over) {
      const i = s.cards.findIndex((c) => !c.matched && !c.faceUp && !matchedIds.has(c.id));
      const mate = s.cards.findIndex((c, j) => j !== i && !c.matched && c.id === s.cards[i].id);
      s = flip(s, i).state;
      const r = flip(s, mate);
      expect(r.event.kind).toBe("match");
      s = r.state;
      matchedIds.add(s.cards[i].id);
    }
    expect(s.matches).toBe(3);
    expect(isComplete(s)).toBe(true);
  });
});

describe("collapse", () => {
  it("turns back only face-up unmatched cards", () => {
    const g = newGame({ pairs: 4 });
    let s = g;
    s = flip(s, 0).state;
    const b = g.cards.findIndex((c) => c.id !== g.cards[0].id);
    s = flip(s, b).state; // mismatch -> both face up
    const c = collapse(s);
    expect(c.cards[0].faceUp).toBe(false);
    expect(c.cards[b].faceUp).toBe(false);
    // matched cards stay put if any
    expect(c.moves).toBe(1);
  });
});

describe("score & isComplete", () => {
  it("returns null while incomplete", () => {
    const g = newGame({ pairs: 4 });
    expect(score(g)).toBeNull();
  });

  it("scores a completed game: base minus move penalty plus combo bonus", () => {
    const g = newGame({ pairs: 1 });
    let s = g;
    s = flip(s, 0).state;
    s = flip(s, 1).state;
    expect(isComplete(s)).toBe(true);
    // base 100, moves 1 => -2, bestCombo 1 => +5 => 103
    expect(score(s)).toBe(100 - 2 + 5);
  });
});

describe("hint", () => {
  it("suggests an unexplored card early on", () => {
    const g = newGame({ pairs: 4 });
    const h = hint(g);
    expect(h).not.toBeNull();
    expect(h.kind).toBe("explore");
    expect(h.card).toBeGreaterThanOrEqual(0);
  });

  it("does not reveal an unseen mate after seeing only one of a pair", () => {
    const g = newGame({ pairs: 4 });
    let s = g;
    s = flip(s, 0).state;
    const other = g.cards.findIndex((c) => c.id !== g.cards[0].id);
    s = flip(s, other).state;
    s = collapse(s);
    const h = hint(s);
    expect(h).not.toBeNull();
    // Only two positions were seen; their ids differ → explore, not a free pair.
    expect(h.kind).toBe("explore");
    expect(s.seen.has(h.card)).toBe(false);
  });

  it("suggests a pair only when both positions were actually seen", () => {
    const g = newGame({ pairs: 3, rand: () => 0.5 });
    const id = g.cards[0].id;
    const mates = g.cards
      .map((c, i) => (c.id === id ? i : -1))
      .filter((i) => i >= 0);
    expect(mates).toHaveLength(2);
    let s = g;
    // See both mates across two mismatches with a decoy.
    const decoy = g.cards.findIndex((c) => c.id !== id);
    s = flip(s, mates[0]).state;
    s = flip(s, decoy).state;
    s = collapse(s);
    s = flip(s, mates[1]).state;
    s = flip(s, decoy).state;
    s = collapse(s);
    const h = hint(s);
    expect(h.kind).toBe("pair");
    expect(new Set(h.cards)).toEqual(new Set(mates));
  });
  it("returns null once the game is over", () => {
    const g = newGame({ pairs: 1 });
    let s = g;
    s = flip(s, 0).state;
    s = flip(s, 1).state;
    expect(hint(s)).toBeNull();
  });
});
