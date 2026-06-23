// formatAiText：把 AI 回傳文字轉成頁面 HTML 的純函式測試。
// 這個函式在三處串流解讀都會用到，regex 出錯會讓每次解讀的排版都壞掉。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { formatAiText } = require("../tarot-logic.js");

test("把 **粗體** 轉成 <b> 標籤", () => {
  assert.equal(formatAiText("這是 **重點** 喔"), "這是 <b>重點</b> 喔");
});

test("同一段裡多個 **粗體** 都會被轉換", () => {
  assert.equal(formatAiText("**A** 和 **B**"), "<b>A</b> 和 <b>B</b>");
});

test("移除 Markdown 的 # 標題符號（含後面一個空白）", () => {
  assert.equal(formatAiText("## 大標題"), "大標題");
  assert.equal(formatAiText("### 小標"), "小標");
});

test("連續多個 <br> 會被壓成最多兩個", () => {
  assert.equal(formatAiText("A<br><br><br><br>B"), "A<br><br>B");
});

test("3 行以上的空行會被壓成 2 行", () => {
  assert.equal(formatAiText("A\n\n\n\nB"), "A\n\nB");
});

test("一般文字不會被亂改", () => {
  assert.equal(formatAiText("今天運勢不錯，放心去做。"), "今天運勢不錯，放心去做。");
});
