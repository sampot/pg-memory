# 對對碰（Memory）

經典翻牌配對遊戲：所有牌面朝下，先翻開一張牌，再翻第二張找相同配對。全部配對完成即過關。

## 玩法

1. 點一張蓋住的牌翻開。
2. 再點另一張牌；相同 → 配對成功（兩張固定翻開）；不同 → 短暫顯示後翻回。
3. 把全部配對完成即過關，依步數與連對結算分數（每對 100 分、扣步數×2、加最高連對×5）。

## 操作

- **滑鼠／觸控**：點牌翻牌。
- **盤面**：可切換 4×4（8 對）或 6×6（18 對）。
- **提示**：AI 幫你找出已知的一對，或建議探索一張新牌。
- 聲音開關在右上角（Web Audio 合成音效）。

## 技術

- `game.js`：純函式邏輯（發牌、翻牌判定、配對、連對、計分、提示 AI）。
- `app.js`：DOM 渲染、縮時計時、配對互動、提示、KV 最高分。
- `audio.js`：Web Audio 合成 8-bit 音效。
- 最高分存 `/api/kv/pg-memory-best`（Playgrounds KV）。

## 試玩

```bash
npx --yes serve .
```

瀏覽 `http://localhost:3000`。

## 測試

```bash
npx --yes vitest@latest run
```

## 授權

- 程式碼：MIT（見 `LICENSE`）。
- 牌面美術：Kenney.nl — Playing Cards Pack（CC0，見 `assets/cards/`）。
- 詳細署名見 `ATTRIBUTION.md`。