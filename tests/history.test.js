// 「你的故事」占卜紀錄的純邏輯測試。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createReadingRecord,
  addReadingToHistory,
  removeReadingFromHistory,
  parseHistory,
  addFollowUpToRecord,
} = require("../tarot-logic.js");

test("createReadingRecord 會帶入欄位，並產生 id 與 ts", () => {
  const rec = createReadingRecord({
    question: "我適合轉職嗎？",
    spreadName: "經典時間牌陣",
    cards: [{ position: "過去", name: "0 愚者", isReversed: false }],
    reading: "大師說……",
  });
  assert.equal(rec.question, "我適合轉職嗎？");
  assert.equal(rec.spreadName, "經典時間牌陣");
  assert.equal(rec.cards.length, 1);
  assert.equal(rec.reading, "大師說……");
  assert.ok(typeof rec.id === "string" && rec.id.length > 0);
  assert.ok(typeof rec.ts === "number");
});

test("createReadingRecord 沒給欄位時有安全預設值", () => {
  const rec = createReadingRecord();
  assert.equal(rec.question, "");
  assert.deepEqual(rec.cards, []);
});

test("addReadingToHistory 把新紀錄放在最前面", () => {
  const a = createReadingRecord({ question: "A", id: "a", ts: 1 });
  const b = createReadingRecord({ question: "B", id: "b", ts: 2 });
  const history = addReadingToHistory([a], b);
  assert.equal(history[0].id, "b");
  assert.equal(history[1].id, "a");
});

test("addReadingToHistory 超過上限會砍掉最舊的", () => {
  let history = [];
  for (let i = 0; i < 5; i++) {
    history = addReadingToHistory(history, createReadingRecord({ id: "r" + i, ts: i }), 3);
  }
  assert.equal(history.length, 3);
  assert.equal(history[0].id, "r4"); // 最新
  assert.equal(history[2].id, "r2"); // 只留最近 3 筆
});

test("addReadingToHistory 不會改動原本的陣列", () => {
  const original = [createReadingRecord({ id: "a", ts: 1 })];
  addReadingToHistory(original, createReadingRecord({ id: "b", ts: 2 }));
  assert.equal(original.length, 1);
});

test("removeReadingFromHistory 依 id 刪除", () => {
  const history = [
    createReadingRecord({ id: "a", ts: 1 }),
    createReadingRecord({ id: "b", ts: 2 }),
  ];
  const after = removeReadingFromHistory(history, "a");
  assert.equal(after.length, 1);
  assert.equal(after[0].id, "b");
});

test("removeReadingFromHistory 找不到 id 時原樣回傳", () => {
  const history = [createReadingRecord({ id: "a", ts: 1 })];
  const after = removeReadingFromHistory(history, "zzz");
  assert.equal(after.length, 1);
});

test("parseHistory 正常 JSON 陣列會原樣回傳", () => {
  const arr = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(parseHistory(JSON.stringify(arr)), arr);
});

test("parseHistory 遇到壞掉的字串會回傳空陣列", () => {
  assert.deepEqual(parseHistory("{壞掉的 json"), []);
  assert.deepEqual(parseHistory(null), []);
});

test("parseHistory 遇到不是陣列的 JSON 會回傳空陣列", () => {
  assert.deepEqual(parseHistory('{"id":"a"}'), []);
  assert.deepEqual(parseHistory("123"), []);
});

test("createReadingRecord 預設帶一個空的 followUps 陣列", () => {
  const rec = createReadingRecord({ question: "Q" });
  assert.deepEqual(rec.followUps, []);
});

test("addFollowUpToRecord 會把追加提問接到對應紀錄後面", () => {
  const a = createReadingRecord({ id: "a", ts: 1 });
  const b = createReadingRecord({ id: "b", ts: 2 });
  const fu = { question: "那工作呢？", card: { name: "17 星星", isReversed: false }, answer: "會好轉" };
  const after = addFollowUpToRecord([b, a], "a", fu);
  assert.equal(after.find(r => r.id === "a").followUps.length, 1);
  assert.equal(after.find(r => r.id === "a").followUps[0].question, "那工作呢？");
  assert.equal(after.find(r => r.id === "b").followUps.length, 0); // 不影響其他紀錄
});

test("addFollowUpToRecord 支援同一筆紀錄接多個追問", () => {
  let history = [createReadingRecord({ id: "a", ts: 1 })];
  history = addFollowUpToRecord(history, "a", { question: "Q1" });
  history = addFollowUpToRecord(history, "a", { question: "Q2" });
  assert.equal(history[0].followUps.length, 2);
});

test("addFollowUpToRecord 不會改動原本的紀錄物件", () => {
  const a = createReadingRecord({ id: "a", ts: 1 });
  addFollowUpToRecord([a], "a", { question: "x" });
  assert.equal(a.followUps.length, 0);
});

test("addFollowUpToRecord 找不到 id 時原樣回傳", () => {
  const a = createReadingRecord({ id: "a", ts: 1 });
  const after = addFollowUpToRecord([a], "zzz", { question: "x" });
  assert.equal(after[0].followUps.length, 0);
});
