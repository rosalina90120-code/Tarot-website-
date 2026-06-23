// 牌義與牌陣「資料完整性」測試。
// 目的：抓出資料打字錯誤（缺欄位、重複、空字串），這類錯誤肉眼很難看出來。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { tarotDeck, spreadsData } = require("../tarot-logic.js");

test("整副牌剛好 78 張", () => {
  assert.equal(tarotDeck.length, 78);
});

test("每張牌都有必要欄位，且都不是空字串", () => {
  const fields = ["eng", "name", "img", "keyword", "meaning", "revKeyword", "revMeaning"];
  for (const card of tarotDeck) {
    for (const f of fields) {
      assert.ok(
        typeof card[f] === "string" && card[f].trim() !== "",
        `「${card.name || card.eng}」缺少或空白的欄位：${f}`
      );
    }
  }
});

test("每張牌的圖檔路徑都不重複", () => {
  const imgs = tarotDeck.map(c => c.img);
  assert.equal(new Set(imgs).size, imgs.length, "有牌共用了同一張圖");
});

test("每張牌的中文牌名都不重複", () => {
  const names = tarotDeck.map(c => c.name);
  assert.equal(new Set(names).size, names.length, "有重複的牌名");
});

test("每張牌的圖檔都放在 images/ 且為 .jpg", () => {
  for (const card of tarotDeck) {
    assert.match(card.img, /^images\/.+\.jpg$/, `「${card.name}」的圖檔路徑怪怪的：${card.img}`);
  }
});

test("每個牌陣都有 name、layoutClass，與至少一個位置", () => {
  for (const [key, spread] of Object.entries(spreadsData)) {
    assert.ok(spread.name, `${key} 缺少 name`);
    assert.ok(spread.layoutClass, `${key} 缺少 layoutClass`);
    assert.ok(
      Array.isArray(spread.positions) && spread.positions.length > 0,
      `${key} 沒有任何位置`
    );
    for (const pos of spread.positions) {
      assert.ok(pos.name, `${key} 有一個位置缺少 name`);
      assert.equal(typeof pos.cssClass, "string", `${key} 的位置 cssClass 應該是字串`);
    }
  }
});
