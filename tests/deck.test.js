// 抽牌邏輯測試：getRemainingDeck / pickFollowUpCard。
// 其中「不污染原始牌堆」是針對原本 index.html 的 bug 寫的回歸測試。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { tarotDeck, getRemainingDeck, pickFollowUpCard, pickFollowUpCards, getAllDrawnCards } = require("../tarot-logic.js");

test("剩餘牌堆會排除已經抽過的牌", () => {
  const picked = [tarotDeck[0], tarotDeck[5]];
  const remaining = getRemainingDeck(tarotDeck, picked);
  assert.equal(remaining.length, tarotDeck.length - 2);
  assert.ok(!remaining.some(c => c.name === tarotDeck[0].name));
  assert.ok(!remaining.some(c => c.name === tarotDeck[5].name));
});

test("沒抽過任何牌時，剩餘牌堆就是整副牌", () => {
  const remaining = getRemainingDeck(tarotDeck, []);
  assert.equal(remaining.length, tarotDeck.length);
});

test("抽追加牌不會污染原始牌堆（Bug 回歸測試）", () => {
  // rng 固定回傳 0：會抽到剩餘牌堆的第 0 張、且 isReversed 為 false
  const card = pickFollowUpCard(tarotDeck, [], tarotDeck, () => 0);

  // 抽到的牌本身要有 isReversed 屬性
  assert.equal(typeof card.isReversed, "boolean");
  // 但原始牌堆裡的牌「都不該」被偷偷加上 isReversed
  for (const c of tarotDeck) {
    assert.ok(!("isReversed" in c), `原始牌堆的「${c.name}」被意外改到了`);
  }
});

test("追加牌不會抽到已經抽過的牌", () => {
  const picked = tarotDeck.slice(0, 77); // 只留最後一張沒抽
  const card = pickFollowUpCard(tarotDeck, picked, tarotDeck, () => 0);
  assert.equal(card.name, tarotDeck[77].name);
});

test("正逆位由 rng 決定：rng > 0.5 時為逆位", () => {
  const reversed = pickFollowUpCard(tarotDeck, [], tarotDeck, () => 0.9);
  const upright = pickFollowUpCard(tarotDeck, [], tarotDeck, () => 0.1);
  assert.equal(reversed.isReversed, true);
  assert.equal(upright.isReversed, false);
});

test("pickFollowUpCards 會抽出指定張數", () => {
  const cards = pickFollowUpCards(tarotDeck, [], tarotDeck, 3, Math.random);
  assert.equal(cards.length, 3);
});

test("pickFollowUpCards 同一批抽出的牌彼此不重複", () => {
  // rng 固定回傳 0：如果沒有把同批抽到的牌排除掉，3 張都會是同一張牌
  const cards = pickFollowUpCards(tarotDeck, [], tarotDeck, 3, () => 0);
  const names = cards.map(c => c.name);
  assert.equal(new Set(names).size, 3);
});

test("pickFollowUpCards 不會抽到已經抽過的牌（含跨回合的牌）", () => {
  const alreadyPicked = tarotDeck.slice(0, 76); // 只留最後 2 張沒抽
  const cards = pickFollowUpCards(tarotDeck, alreadyPicked, tarotDeck, 2, () => 0);
  const names = cards.map(c => c.name);
  assert.deepEqual(new Set(names), new Set([tarotDeck[76].name, tarotDeck[77].name]));
});

test("pickFollowUpCards 不會污染原始牌堆", () => {
  pickFollowUpCards(tarotDeck, [], tarotDeck, 3, () => 0);
  for (const c of tarotDeck) {
    assert.ok(!("isReversed" in c), `原始牌堆的「${c.name}」被意外改到了`);
  }
});

test("getAllDrawnCards 彙整主牌陣與所有追問回合抽過的牌（新格式 cards 陣列）", () => {
  const main = [tarotDeck[0], tarotDeck[1]];
  const followUps = [
    { question: "Q1", cards: [tarotDeck[2], tarotDeck[3]] },
    { question: "Q2", cards: [tarotDeck[4]] },
  ];
  const all = getAllDrawnCards(main, followUps);
  assert.deepEqual(all.map(c => c.name), [0, 1, 2, 3, 4].map(i => tarotDeck[i].name));
});

test("getAllDrawnCards 相容舊格式（單張 card）", () => {
  const main = [tarotDeck[0]];
  const followUps = [{ question: "Q1", card: tarotDeck[1] }];
  const all = getAllDrawnCards(main, followUps);
  assert.deepEqual(all.map(c => c.name), [tarotDeck[0].name, tarotDeck[1].name]);
});

test("getAllDrawnCards 沒有追問紀錄時只回傳主牌陣", () => {
  const main = [tarotDeck[0]];
  assert.deepEqual(getAllDrawnCards(main, []), main);
  assert.deepEqual(getAllDrawnCards(main, undefined), main);
});
