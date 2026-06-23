// tarot-logic.js
// 從 index.html 抽出的「共用邏輯」：牌陣/牌義資料 + 純函式。
// ‧ 瀏覽器：用一般 <script src="tarot-logic.js"></script> 載入即可
//   （裡面的變數/函式會成為頁面共用的全域，index.html 的 <script> 可直接用）。
// ‧ Node ：require('./tarot-logic.js') 會拿到最底部 module.exports 匯出的東西，方便寫測試。

// 大師智囊團清單（按順序接力嘗試）。前端用它決定 fetch 順序，後端用它白名單擋掉不合法的 model 名稱。
// 故意把便宜的模型排前面：gemini-3.5-flash 輸出單價是 gemini-3-flash-preview 的 3 倍、是 gemini-3.1-flash-lite 的 6 倍，
// 而且幾乎每次都會在第一輪就成功，等於一直在燒最貴的選項。gemini-flash-latest 是會隨時間漂移的別名（目前指向最貴的 3.5-flash），
// 為了讓每日總額上限算出來的金額是「真正的天花板」而不是估計值，故意不放進清單。
const fallbackModels = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview"
];

const spreadsData = {
    "daily": { name: "每日一占", layoutClass: "layout-linear", positions: [ { name: "今日運勢與場景", cssClass: "" } ] },
    "classic": { name: "經典時間牌陣", layoutClass: "layout-linear", positions: [ { name: "過去 Past", cssClass: "" }, { name: "現在 Present", cssClass: "" }, { name: "未來 Future", cssClass: "" } ] },
    "coreDirect": { name: "直指核心牌陣", layoutClass: "layout-core", positions: [ { name: "① 問題核心", cssClass: "core-pos-0" }, { name: "② 障礙/短處", cssClass: "core-pos-1" }, { name: "③ 對策", cssClass: "core-pos-2" }, { name: "④ 資源/長處", cssClass: "core-pos-3" } ] },
    "loveCross": { name: "戀愛十字牌陣", layoutClass: "layout-cross", positions: [ { name: "① 你的心情", cssClass: "cross-pos-0" }, { name: "② 對方態度", cssClass: "cross-pos-1" }, { name: "③ 現在狀況", cssClass: "cross-pos-2" }, { name: "④ 外界影響", cssClass: "cross-pos-3" }, { name: "⑤ 未來結果", cssClass: "cross-pos-4" } ] },
    "actionPlan": { name: "行動計畫牌陣", layoutClass: "layout-linear", positions: [ { name: "① 想改善的現狀", cssClass: "" }, { name: "② 解決方案一", cssClass: "" }, { name: "③ 解決方案二", cssClass: "" }, { name: "④ 解決方案三", cssClass: "" }, { name: "⑤ 解決方案四", cssClass: "" } ] },
    "lifeStage": { name: "人生階段牌陣", layoutClass: "layout-life", positions: [ { name: "① 你所處的季節", cssClass: "life-pos-0" }, { name: "② 帶來的社會生活", cssClass: "life-pos-1" }, { name: "③ 讓你振奮的事物", cssClass: "life-pos-2" }, { name: "④ 滋養你的事物", cssClass: "life-pos-3" }, { name: "⑤ 必須忍受的事物", cssClass: "life-pos-4" } ] },
    "loveTree": { name: "愛情之樹占卜法", layoutClass: "layout-lovetree", positions: [ { name: "① 當事人", cssClass: "tree-pos-0" }, { name: "② 過去感覺與因素", cssClass: "tree-pos-1" }, { name: "③ 現在如何處理", cssClass: "tree-pos-2" }, { name: "④ 未來潛力與可能", cssClass: "tree-pos-3" }, { name: "⑤ 潛意識與環境影響", cssClass: "tree-pos-4" } ] },
    "findPartner": { name: "尋找對象占卜法", layoutClass: "layout-partner", positions: [ { name: "① 心境", cssClass: "partner-pos-0" }, { name: "② 對象", cssClass: "partner-pos-1" }, { name: "③ 他者", cssClass: "partner-pos-2" }, { name: "④ 策略", cssClass: "partner-pos-3" }, { name: "⑤ 將來", cssClass: "partner-pos-4" } ] },
    "friendship": { name: "友誼占卜法", layoutClass: "layout-friendship", positions: [ { name: "① 你對他的看法", cssClass: "friend-pos-0" }, { name: "② 他對你的看法", cssClass: "friend-pos-1" }, { name: "③ 你認為目前雙方關係", cssClass: "friend-pos-2" }, { name: "④ 他認為目前雙方關係", cssClass: "friend-pos-3" }, { name: "⑤ 你期望未來關係發展", cssClass: "friend-pos-4" }, { name: "⑥ 他期望未來關係發展", cssClass: "friend-pos-5" } ] },
    "voiceOfHeart": { name: "心之聲牌陣", layoutClass: "layout-heart", positions: [ { name: "① 現在狀況", cssClass: "heart-pos-0" }, { name: "② 未來發展", cssClass: "heart-pos-1" }, { name: "③ 對方對你的內在印象", cssClass: "heart-pos-2" }, { name: "④ 對方對你的外在印象", cssClass: "heart-pos-3" }, { name: "⑤ 對方目前的狀況", cssClass: "heart-pos-4" }, { name: "⑥ 對方的期望", cssClass: "heart-pos-5" }, { name: "⑦ 你本身的狀況", cssClass: "heart-pos-6" }, { name: "⑧ 建議與行動", cssClass: "heart-pos-7" } ] },
    "celticCross": { name: "塞爾特十字占卜法", layoutClass: "layout-celtic", positions: [ { name: "① 問題現況", cssClass: "celtic-pos-0" }, { name: "② 影響因素(阻力/助力)", cssClass: "celtic-pos-1" }, { name: "③ 理想與想法", cssClass: "celtic-pos-2" }, { name: "④ 基礎與成因", cssClass: "celtic-pos-3" }, { name: "⑤ 過去狀況", cssClass: "celtic-pos-4" }, { name: "⑥ 未來發展", cssClass: "celtic-pos-5" }, { name: "⑦ 你的自我狀況", cssClass: "celtic-pos-6" }, { name: "⑧ 外在環境與他人", cssClass: "celtic-pos-7" }, { name: "⑨ 希望或恐懼", cssClass: "celtic-pos-8" }, { name: "⑩ 最終結局", cssClass: "celtic-pos-9" } ] },
    "yesNo": { 
        name: "是非題占卜法", layoutClass: "layout-linear", 
        positions: [ { name: "① 第一張牌", cssClass: "" }, { name: "② 第二張牌", cssClass: "" }, { name: "③ 第三張牌", cssClass: "" } ] 
    },
    "problemSolving": { 
        name: "問題解決牌陣", layoutClass: "layout-problem", 
        positions: [ { name: "① 問題起因", cssClass: "problem-pos-0" }, { name: "② 目前情形", cssClass: "problem-pos-1" }, { name: "③ 解決對策", cssClass: "problem-pos-2" } ] 
    },
    "fourElements": { 
        name: "四要素展開法", layoutClass: "layout-elements", 
        positions: [ { name: "① 火元素 (行動建議)", cssClass: "elem-pos-0" }, { name: "② 風元素 (言語溝通)", cssClass: "elem-pos-1" }, { name: "③ 水元素 (感情態度)", cssClass: "elem-pos-2" }, { name: "④ 土元素 (物質處理)", cssClass: "elem-pos-3" } ] 
    },
    "diamond": { 
        name: "鑽石占卜法", layoutClass: "layout-diamond", 
        positions: [ { name: "① 過去狀況", cssClass: "diamond-pos-0" }, { name: "② 現況局面(一)", cssClass: "diamond-pos-1" }, { name: "③ 現況局面(二)", cssClass: "diamond-pos-2" }, { name: "④ 未來狀況", cssClass: "diamond-pos-3" } ] 
    },
    "loversPyramid": {
        name: "戀人金字塔牌陣", layoutClass: "layout-pyramid",
        positions: [ { name: "① 自身", cssClass: "pyramid-pos-0" }, { name: "② 對象", cssClass: "pyramid-pos-1" }, { name: "③ 關係", cssClass: "pyramid-pos-2" }, { name: "④ 將來發展", cssClass: "pyramid-pos-3" } ]
    },
    "peaceFan": {
        name: "平安扇牌陣", layoutClass: "layout-fan",
        positions: [ { name: "① 狀態（目前人際關係狀況）", cssClass: "fan-pos-0" }, { name: "② 緣起（與對方結識的因緣）", cssClass: "fan-pos-1" }, { name: "③ 走向（雙方關係未來發展趨勢）", cssClass: "fan-pos-2" }, { name: "④ 結局（對這段關係的結論）", cssClass: "fan-pos-3" } ]
    },
    "energyRelation": {
        name: "能量關係占卜法", layoutClass: "layout-energy",
        positions: [ { name: "① 自己提供的能量", cssClass: "energy-pos-0" }, { name: "② 對方提供的能量", cssClass: "energy-pos-1" }, { name: "③ 彼此交會的能量", cssClass: "energy-pos-2" }, { name: "④ 新的可能與方向", cssClass: "energy-pos-3" } ]
    }
};

const tarotDeck = [
    // ================= 大阿爾克那 (Major Arcana) =================
    { eng: "The Fool", name: "0 愚者", img: "images/m00.jpg", 
      keyword: "重新開始與無畏", meaning: "不要想太多，跟著直覺大膽去衝就對了，這是一段充滿未知的全新旅程。",
      revKeyword: "盲目與魯莽", revMeaning: "過於衝動、沒有計畫的冒險可能帶來危險，請停下來評估風險再行動。" },
    { eng: "The Magician", name: "1 魔術師", img: "images/m01.jpg", 
      keyword: "創造力與資源", meaning: "你具備解決這個問題的所有能力與資源，現在缺的只是將想法化為實際的行動力。",
      revKeyword: "才華濫用與騙局", revMeaning: "空有想法卻缺乏行動，或是要小心被花言巧語所欺騙，請務實一點。" },
    { eng: "The High Priestess", name: "2 女祭司", img: "images/m02.jpg", 
      keyword: "直覺與潛意識", meaning: "不要急著往外找答案，靜下心來退一步觀察，你的直覺會告訴你真相。",
      revKeyword: "失去直覺與封閉", revMeaning: "你可能太過情緒化或忽視了內心的聲音。隱藏的秘密可能會浮出水面。" },
    { eng: "The Empress", name: "3 女皇", img: "images/m03.jpg", 
      keyword: "豐盛與孕育", meaning: "這是一個充滿愛與豐收的好兆頭，溫柔且充滿耐心地對待事物會有極佳的結果。",
      revKeyword: "過度依賴與虛榮", revMeaning: "溺愛或過度保護反而造成壓力。可能面臨物質浪費或感情上的匱乏感。" },
    { eng: "The Emperor", name: "4 皇帝", img: "images/m04.jpg", 
      keyword: "秩序與掌控", meaning: "你需要更有紀律、更有邏輯地去處理這個問題，建立規則，不要感情用事。",
      revKeyword: "專制與固執", revMeaning: "太過強勢或死板會引發反彈；也可能代表失去控制權、缺乏紀律與責任感。" },
    { eng: "The Hierophant", name: "5 教皇", img: "images/m05.jpg", 
      keyword: "傳統與指導", meaning: "這件事你需要聽從前輩的建議，或者遵循體制內傳統的作法會比較穩妥。",
      revKeyword: "打破常規與盲從", revMeaning: "現有的體制或舊觀念已經不適用了，你需要突破框架，不要盲目聽從權威。" },
    { eng: "The Lovers", name: "6 戀人", img: "images/m06.jpg", 
      keyword: "選擇與契合", meaning: "面臨重大的選擇。這不僅跟人際關係有關，也代表你需要做出一個遵從真心的決定。",
      revKeyword: "失和與錯誤選擇", revMeaning: "關係中出現裂痕或價值觀不合。你可能面臨誘惑，做出違背初衷的錯誤決定。" },
    { eng: "The Chariot", name: "7 戰車", img: "images/m07.jpg", 
      keyword: "意志力與勝利", meaning: "克服內心的矛盾與外在阻礙，憑藉強大的意志力掌控方向，你將會取得勝利。",
      revKeyword: "失控與阻礙", revMeaning: "方向感迷失，局勢脫離你的掌控。不要勉強硬衝，否則容易翻車失敗。" },
    { eng: "Strength", name: "8 力量", img: "images/m08.jpg", 
      keyword: "柔性與耐心", meaning: "以柔克剛。不要硬碰硬，用你的耐心、內在的溫柔與包容去化解眼前的困難。",
      revKeyword: "軟弱與恐懼", revMeaning: "失去自信與勇氣，被內心的恐懼或本能的慾望給吞噬，感到軟弱無力。" },
    { eng: "The Hermit", name: "9 隱者", img: "images/m09.jpg", 
      keyword: "內省與孤獨", meaning: "現在不是往外衝的時候，你需要一段獨處的時間來沉澱自己，尋找內心的真理。",
      revKeyword: "孤僻與逃避", revMeaning: "過度封閉自我，拒絕外界幫助。或者是時候該結束孤立，重新回到人群中了。" },
    { eng: "Wheel of Fortune", name: "10 命運之輪", img: "images/m10.jpg", 
      keyword: "轉機與循環", meaning: "事情將迎來無法抗拒的改變。順應局勢的變化，命運的齒輪正在為你轉動。",
      revKeyword: "厄運與低谷", revMeaning: "面臨突如其來的挫折或無法掌控的壞運氣。請保持耐心，低谷總會過去的。" },
    { eng: "Justice", name: "11 正義", img: "images/m11.jpg", 
      keyword: "平衡與因果", meaning: "保持客觀與理智，誠實面對一切。你會得到你應得的結果，講求公平是關鍵。",
      revKeyword: "不公與偏見", revMeaning: "遭遇不公平的對待，或是你自己帶有偏見、逃避責任。小心法律或合約糾紛。" },
    { eng: "The Hanged Man", name: "12 倒吊人", img: "images/m12.jpg", 
      keyword: "犧牲與換位思考", meaning: "目前處於卡關狀態。你需要犧牲一點眼前的利益，換個角度看世界，會有全新體悟。",
      revKeyword: "無謂犧牲與掙扎", revMeaning: "卡在僵局中不願改變，白白付出卻沒有回報。你需要停止無意義的鑽牛角尖。" },
    { eng: "Death", name: "13 死神", img: "images/m13.jpg", 
      keyword: "結束與重生", meaning: "舊有的模式必須被徹底摧毀。勇敢放手那些不再適合你的事物，才能迎來新生。",
      revKeyword: "抗拒改變與停滯", revMeaning: "你緊抓著過去不放，害怕改變帶來的陣痛，導致情況停滯不前，無法迎來新生。" },
    { eng: "Temperance", name: "14 節制", img: "images/m14.jpg", 
      keyword: "調和與溝通", meaning: "尋找平衡，不要走極端。試著融合不同的意見與資源，耐心調和會得到最好的結果。",
      revKeyword: "失衡與衝突", revMeaning: "生活節奏大亂，溝通不良導致衝突。你需要控制自己的慾望與極端的情緒。" },
    { eng: "The Devil", name: "15 惡魔", img: "images/m15.jpg", 
      keyword: "慾望與束縛", meaning: "你可能被物質、執念或不健康的關係綁架了。認清誘惑的本質，並試著掙脫束縛。",
      revKeyword: "掙脫枷鎖與覺醒", revMeaning: "你開始看清有毒的關係或壞習慣，並決心斬斷這些束縛，重獲心靈自由。" },
    { eng: "The Tower", name: "16 高塔", img: "images/m16.jpg", 
      keyword: "毀滅與崩塌", meaning: "突如其來的意外會打破原本堅固的認知。過程雖然痛苦，但這是打掉重練的必經之路。",
      revKeyword: "懸崖勒馬與死撐", revMeaning: "危機稍微減弱，或是你死撐著不讓搖搖欲墜的現狀崩塌，但該來的陣痛還是得面對。" },
    { eng: "The Star", name: "17 星星", img: "images/m17.jpg", 
      keyword: "希望與療癒", meaning: "在經歷混亂後帶來平靜。保持樂觀，充滿希望的指引正在前方，你的願望有望實現。",
      revKeyword: "絕望與幻滅", revMeaning: "失去信心，感到悲觀與絕望。目標設定得太過遙不可及，需要重新找回務實的腳步。" },
    { eng: "The Moon", name: "18 月亮", img: "images/m18.jpg", 
      keyword: "不安與潛在危機", meaning: "事情沒有表面看來那麼簡單，隱藏的危機讓你感到焦慮。小心欺騙，釐清恐懼。",
      revKeyword: "雲開見月與真相", revMeaning: "恐懼逐漸散去，隱藏的秘密或謊言被揭露。你終於能看清真相，走出迷惘。" },
    { eng: "The Sun", name: "19 太陽", img: "images/m19.jpg", 
      keyword: "成功與活力", meaning: "大吉大利！充滿熱情與成功，陰霾已經散去，一切都在往最棒、最明朗的方向發展。",
      revKeyword: "延遲的成功與疲憊", revMeaning: "雖然還是會成功，但過程可能沒那麼順利，熱情稍微減退，或是快樂被打了一點折扣。" },
    { eng: "Judgement", name: "20 審判", img: "images/m20.jpg", 
      keyword: "覺醒與召喚", meaning: "這是一個重生的機會。過去的努力將被結算，聽從內心深處的呼喚，迎接新的階段。",
      revKeyword: "逃避抉擇與悔恨", revMeaning: "你忽視了內心的聲音，拒絕面對過去的錯誤，導致錯失了重生的關鍵時機。" },
    { eng: "The World", name: "21 世界", img: "images/m21.jpg", 
      keyword: "圓滿與達成", meaning: "完美的結局！這趟旅程已達終點，你將獲得極大的成功與完成度，準備邁向下一個層次。",
      revKeyword: "未竟之功與停滯", revMeaning: "明明只差最後一步就能成功，卻因為缺乏毅力或準備不足而卡在原地，無法圓滿。" },

    // ================= 權杖牌組 (Wands) =================
    { eng: "Ace of Wands", name: "權杖一", img: "images/w01.jpg", 
      keyword: "新行動與靈感", meaning: "一個充滿熱情的新計畫或靈感即將展開，把握這股衝勁。",
      revKeyword: "缺乏動力與受阻", revMeaning: "計畫難以啟動，熱情消退，或者時機尚未成熟，感到力不從心。" },
    { eng: "Two of Wands", name: "權杖二", img: "images/w02.jpg", 
      keyword: "計畫與遠見", meaning: "你正在籌劃未來，擁有初步的成果，需要決定是否要跨出舒適圈。",
      revKeyword: "計畫泡湯與恐懼", revMeaning: "害怕未知而不敢行動，或是計畫缺乏長遠眼光而面臨停滯。" },
    { eng: "Three of Wands", name: "權杖三", img: "images/w03.jpg", 
      keyword: "擴張與探索", meaning: "你的眼界正在放寬，計畫已經啟動，是時候尋找更多的合作與發展機會。",
      revKeyword: "發展受阻與短視", revMeaning: "海外計畫或擴張行動受挫，團隊缺乏默契，無法將眼光放遠。" },
    { eng: "Four of Wands", name: "權杖四", img: "images/w04.jpg", 
      keyword: "慶祝與穩定", meaning: "達到了一個穩定的里程碑，可以暫時放鬆，享受歡樂與和諧的氣氛。",
      revKeyword: "短暫不穩與疏離", revMeaning: "基礎不夠穩固，慶祝活動可能被延遲，或者人際關係出現短暫的隔閡。" },
    { eng: "Five of Wands", name: "權杖五", img: "images/w05.jpg", 
      keyword: "競爭與衝突", meaning: "周遭充滿了混亂的意見與小摩擦，這是一場良性競爭，需要你展現實力。",
      revKeyword: "惡性鬥爭與逃避", revMeaning: "衝突越演越烈變成內耗；或是你選擇逃避問題，不願參與競爭。" },
    { eng: "Six of Wands", name: "權杖六", img: "images/w06.jpg", 
      keyword: "勝利與榮耀", meaning: "努力獲得了認可！你將帶著驕傲與自信，享受眾人的掌聲與成功。",
      revKeyword: "驕傲自滿與落敗", revMeaning: "太過自信導致失敗，或是別人搶走了你的功勞，得不到應有的認可。" },
    { eng: "Seven of Wands", name: "權杖七", img: "images/w07.jpg", 
      keyword: "防禦與堅持", meaning: "面臨挑戰與競爭者，你處於有利位置，只要堅持信念就能守住成果。",
      revKeyword: "不堪重負與放棄", revMeaning: "敵人的攻勢太猛，你感到精疲力盡，內心動搖，防線即將崩潰。" },
    { eng: "Eight of Wands", name: "權杖八", img: "images/w08.jpg", 
      keyword: "迅速與進展", meaning: "事情的發展將會非常快速，沒有阻礙，請做好準備迎接接踵而來的消息。",
      revKeyword: "延遲與匆忙失誤", revMeaning: "進度被嚴重延誤，或者因為行動太過倉促而導致溝通不良與失誤。" },
    { eng: "Nine of Wands", name: "權杖九", img: "images/w09.jpg", 
      keyword: "疲憊與防備", meaning: "你已經很累了，但還差最後一步。保持警戒，咬緊牙關撐過最後的考驗。",
      revKeyword: "防衛過當與崩潰", revMeaning: "你太過神經質，對周遭充滿敵意，體力與意志力已經到達極限。" },
    { eng: "Ten of Wands", name: "權杖十", img: "images/w10.jpg", 
      keyword: "重擔與壓力", meaning: "你把太多的責任扛在自己肩上，壓力快把你壓垮了，需要學會放下或分擔。",
      revKeyword: "卸下重擔與逃避", revMeaning: "你終於學會把責任分擔出去；或者相反，你直接擺爛，逃避所有責任。" },
    { eng: "Page of Wands", name: "權杖侍者", img: "images/w11.jpg", 
      keyword: "好奇與新消息", meaning: "帶著年輕的活力去探索新事物，可能會收到令人興奮的新計畫或消息。",
      revKeyword: "三分鐘熱度與壞消息", revMeaning: "缺乏耐心與執行力，計畫只停留在空想。也可能帶來令人失望的消息。" },
    { eng: "Knight of Wands", name: "權杖騎士", img: "images/w12.jpg", 
      keyword: "衝動與熱血", meaning: "充滿行動力，說做就做！但要注意不要因為太過急躁而忽略了細節。",
      revKeyword: "暴躁與魯莽生事", revMeaning: "行為太過莽撞不負責任，容易因為發脾氣或衝動而把事情搞砸。" },
    { eng: "Queen of Wands", name: "權杖王后", img: "images/w13.jpg", 
      keyword: "自信與魅力", meaning: "展現你陽光、自信且獨立的一面，用你的熱情去感染並領導周圍的人。",
      revKeyword: "傲慢與嫉妒", revMeaning: "自信變成了自大，控制慾太強，容易因為嫉妒心而情緒化或刁難他人。" },
    { eng: "King of Wands", name: "權杖國王", img: "images/w14.jpg", 
      keyword: "領導與遠見", meaning: "一位充滿遠見的領導者。你有能力掌控大局，用果斷的行動去達成目標。",
      revKeyword: "獨裁與暴躁", revMeaning: "變得專制不講理，無法接納他人意見。計畫因為過於急躁或暴力而失敗。" },

    // ================= 聖杯牌組 (Cups) =================
    { eng: "Ace of Cups", name: "聖杯一", img: "images/c01.jpg", 
      keyword: "新情感與直覺", meaning: "愛與情感的源泉湧現。可能是一段新關係的開始，或內心獲得極大的平靜。",
      revKeyword: "情感空虛與壓抑", revMeaning: "內心感到枯竭，拒絕接受新的感情或善意，情緒被過度壓抑。" },
    { eng: "Two of Cups", name: "聖杯二", img: "images/c02.jpg", 
      keyword: "結合與平等", meaning: "兩個人或兩種力量的完美結合。代表互信互愛的伴侶關係或絕佳的合作夥伴。",
      revKeyword: "關係破裂與不對等", revMeaning: "合作關係出現裂痕，溝通不良，或是感情中出現不平等的操控與誤解。" },
    { eng: "Three of Cups", name: "聖杯三", img: "images/c03.jpg", 
      keyword: "歡慶與友誼", meaning: "與好朋友聚在一起慶祝的時刻。享受團隊合作的樂趣與社交的喜悅。",
      revKeyword: "過度放縱與小團體", revMeaning: "可能代表樂極生悲、過度沉溺於享樂，或是人際關係中出現排擠與八卦。" },
    { eng: "Four of Cups", name: "聖杯四", img: "images/c04.jpg", 
      keyword: "冷漠與錯過", meaning: "對現狀感到無聊或不滿，導致你封閉內心，忽略了外界正在向你招手的新機會。",
      revKeyword: "打破沉默與新機", revMeaning: "你終於從冷漠中醒來，願意接受別人的好意或抓住身邊的新機會。" },
    { eng: "Five of Cups", name: "聖杯五", img: "images/c05.jpg", 
      keyword: "悲傷與失落", meaning: "過度專注於失去的事物而感到悲傷，請轉過身看看，你其實還有剩下的資源與希望。",
      revKeyword: "走出陰霾與釋懷", revMeaning: "你逐漸接受了失去的事實，看開了過去的傷痛，準備重新振作。" },
    { eng: "Six of Cups", name: "聖杯六", img: "images/c06.jpg", 
      keyword: "回憶與純真", meaning: "回憶起過去的美好，或是與故人重逢。帶著單純與善良的心去面對問題。",
      revKeyword: "沉溺過去與拒絕成長", revMeaning: "太過懷念過去，不願面對現在的責任；或是終於擺脫過去的陰影向未來前進。" },
    { eng: "Seven of Cups", name: "聖杯七", img: "images/c07.jpg", 
      keyword: "幻想與選擇", meaning: "眼前有太多誘惑與選擇，但很多只是不切實際的幻想。你需要理清思緒，腳踏實地。",
      revKeyword: "看清現實與果斷", revMeaning: "幻想破滅，但你也因此看清了真相。不再做白日夢，準備做出務實的選擇。" },
    { eng: "Eight of Cups", name: "聖杯八", img: "images/c08.jpg", 
      keyword: "追尋與放下", meaning: "現狀雖然安穩但已無法滿足你的內心。你決定拋下現有的一切，去追尋更高的精神目標。",
      revKeyword: "逃避現實與恐懼改變", revMeaning: "明明知道該離開卻缺乏勇氣，或是盲目地逃避問題，不知道自己到底在追求什麼。" },
    { eng: "Nine of Cups", name: "聖杯九", img: "images/c09.jpg", 
      keyword: "滿足與美夢成真", meaning: "這是一張願望實現的牌！你將獲得物質與情感上的極大滿足，享受豐收的喜悅。",
      revKeyword: "貪婪與樂極生悲", revMeaning: "過度追求物質享受而顯得貪婪自滿，或是願望落空，外表光鮮但內心空虛。" },
    { eng: "Ten of Cups", name: "聖杯十", img: "images/c10.jpg", 
      keyword: "和諧與幸福", meaning: "情感的最高境界。代表家庭和樂、團隊氣氛融洽，是一個充滿愛與安全感的環境。",
      revKeyword: "家庭失和與假象", revMeaning: "團隊或家庭出現爭吵，幸福只存在於表面，內在其實充滿了不滿與失落。" },
    { eng: "Page of Cups", name: "聖杯侍者", img: "images/c11.jpg", 
      keyword: "敏感與浪漫", meaning: "用溫柔且感性的態度去面對世界，可能會出現新的戀情或藝術靈感的啟發。",
      revKeyword: "過度敏感與情緒化", revMeaning: "過於玻璃心、愛幻想不切實際，或是在感情中表現得不成熟、容易受傷。" },
    { eng: "Knight of Cups", name: "聖杯騎士", img: "images/c12.jpg", 
      keyword: "浪漫與追尋", meaning: "跟隨自己的心與理想前進。這是一個浪漫的提議或一段優雅的追求過程。",
      revKeyword: "花言巧語與欺瞞", revMeaning: "對方可能只會開空頭支票，感情不忠誠，行動過於情緒化且不負責任。" },
    { eng: "Queen of Cups", name: "聖杯王后", img: "images/c13.jpg", 
      keyword: "同理與傾聽", meaning: "擁有極高的直覺與同理心。你需要溫柔地關懷他人，或是信任自己的第六感。",
      revKeyword: "過度依賴與情緒勒索", revMeaning: "同理心氾濫導致失去自我界線，或者利用情緒去勒索別人，容易陷入悲觀。" },
    { eng: "King of Cups", name: "聖杯國王", img: "images/c14.jpg", 
      keyword: "情緒管理與成熟", meaning: "在情感與理智間取得完美平衡。你能冷冷静理危機，同時給予他人強大的精神支持。",
      revKeyword: "情緒失控與冷酷", revMeaning: "表面冷靜但內心壓抑，容易情緒爆發；或者變得過度冷漠、利用感情操縱他人。" },

    // ================= 寶劍牌組 (Swords) =================
    { eng: "Ace of Swords", name: "寶劍一", img: "images/s01.jpg", 
      keyword: "突破與清晰", meaning: "理智與真理的利刃。代表突破盲點，獲得清晰的思緒或一個極具破壞力的新想法。",
      revKeyword: "思緒混亂與濫用武力", revMeaning: "想法混亂不清，無法做出正確判斷。或是言語過於犀利傷人，引發不必要的衝突。" },
    { eng: "Two of Swords", name: "寶劍二", img: "images/s02.jpg", 
      keyword: "僵局與逃避", meaning: "你蒙住雙眼拒絕面對現實，導致決策陷入僵局。你必須勇敢拿下眼罩做出選擇。",
      revKeyword: "打破僵局與面對真相", revMeaning: "僵持的局面終於有了進展，你被迫拿下眼罩看清殘酷的現實並做出選擇。" },
    { eng: "Three of Swords", name: "寶劍三", img: "images/s03.jpg", 
      keyword: "悲痛與受傷", meaning: "心碎與痛苦的象徵。這是一段難熬的時期，接受這個傷害，讓時間來療癒你。",
      revKeyword: "療傷與壓抑痛苦", revMeaning: "最痛苦的階段已經過去，開始進入療癒期；或是代表你過度壓抑悲傷，不願釋懷。" },
    { eng: "Four of Swords", name: "寶劍四", img: "images/s04.jpg", 
      keyword: "休息與沉澱", meaning: "你太累了，現在需要按下暫停鍵。暫時退居幕後，休養生息後再重新出發。",
      revKeyword: "被迫行動與過勞", revMeaning: "休息不足就被迫重新投入戰場，導致身心俱疲。或者代表終於結束休養，準備回歸。" },
    { eng: "Five of Swords", name: "寶劍五", img: "images/s05.jpg", 
      keyword: "損人不利己", meaning: "充滿爭議的勝利。為了贏得爭論可能傷害了感情，退一步海闊天空，不要為贏而贏。",
      revKeyword: "惡性報復與結束爭端", revMeaning: "無休止的報復循環只會帶來更大的傷害。也可能代表雙方終於願意放下身段和解。" },
    { eng: "Six of Swords", name: "寶劍六", img: "images/s06.jpg", 
      keyword: "過渡與療傷", meaning: "正在漸漸離開痛苦的環境。雖然心中仍有憂傷，但情況正在慢慢好轉，航向平靜。",
      revKeyword: "難以脫身與抗拒改變", revMeaning: "復原的過程受到阻礙，你無法擺脫過去的牽絆，或是因為害怕未知而拒絕往前走。" },
    { eng: "Seven of Swords", name: "寶劍七", img: "images/s07.jpg", 
      keyword: "策略與欺瞞", meaning: "正面衝突沒有好處，你需要用點策略、智取或是偷偷來。也要小心被他人欺騙。",
      revKeyword: "計畫敗露與誠實面對", revMeaning: "小聰明或欺騙的行為被揭穿。此時最好的策略就是坦誠相待，面對問題的核心。" },
    { eng: "Eight of Swords", name: "寶劍八", img: "images/s08.jpg", 
      keyword: "受困與盲點", meaning: "你覺得自己被困住了，但其實綁住你的只是你自己的恐懼與負面想法。你是自由的。",
      revKeyword: "重獲自由與打破盲點", revMeaning: "你終於意識到限制都是自己給的，成功解開內心的枷鎖，重新掌握人生的主導權。" },
    { eng: "Nine of Swords", name: "寶劍九", img: "images/s09.jpg", 
      keyword: "焦慮與噩夢", meaning: "過度擔憂與精神壓力讓你無法入眠。很多恐懼只是你腦海中放大的幻影，請尋求幫助。",
      revKeyword: "夢醒與正視恐懼", revMeaning: "焦慮的情況稍微緩解，你開始能客觀地看待那些恐懼；或是壓力大到徹底崩潰。" },
    { eng: "Ten of Swords", name: "寶劍十", img: "images/s10.jpg", 
      keyword: "慘敗與谷底", meaning: "最壞的情況已經發生了，最痛苦的時刻即將結束，準備重生。",
      revKeyword: "絕處逢生與拒絕結束", revMeaning: "谷底反彈，迎來一線生機。但也可能代表你拒絕接受失敗的事實，繼續承受不必要的折磨。" },
    { eng: "Page of Swords", name: "寶劍侍者", img: "images/s11.jpg", 
      keyword: "警覺與學習", meaning: "保持好奇心與敏銳的觀察力。在行動前先收集情報，理智分析狀況。",
      revKeyword: "多疑與言辭犀利", revMeaning: "防備心太重，容易捕風捉影。溝通時尖酸刻薄，或是到處散播未經證實的八卦。" },
    { eng: "Knight of Swords", name: "寶劍騎士", img: "images/s12.jpg", 
      keyword: "迅速與衝動", meaning: "思考敏捷且行動迅速。但有時過於急躁與直接，容易變成魯莽，請三思而後行。",
      revKeyword: "衝動壞事與缺乏耐性", revMeaning: "完全不經大腦的橫衝直撞，導致事情被搞砸。言語極度傷人且不顧後果。" },
    { eng: "Queen of Swords", name: "寶劍王后", img: "images/s13.jpg", 
      keyword: "冷靜與理性", meaning: "不被感情左右，用清晰的邏輯與嚴格的標準來審視問題。直言不諱是你的武器。",
      revKeyword: "冷酷無情與偏激", revMeaning: "過於毒舌與嚴苛，完全不顧他人感受。可能因為過去的創傷而變得極度封閉與刻薄。" },
    { eng: "King of Swords", name: "寶劍國王", img: "images/s14.jpg", 
      keyword: "權威與邏輯", meaning: "具備高度的專業知識與邏輯分析能力。遇到問題時，請用絕對的理智與公正去裁決。",
      revKeyword: "濫用權力與不公", revMeaning: "利用智商或職威去壓榨他人，變得專橫跋扈。邏輯淪為狡辯，失去公正的判斷力。" },

    // ================= 錢幣牌組 (Pentacles) =================
    { eng: "Ace of Pentacles", name: "錢幣一", img: "images/p01.jpg", 
      keyword: "實質新機會", meaning: "一個具體的、與金錢或工作有關的新機會出現了，將為為你帶來實質的豐收。",
      revKeyword: "錯失良機與貪婪", revMeaning: "機會因為缺乏實際計畫而溜走。或是過度看重金錢，導致財務規劃出現問題。" },
    { eng: "Two of Pentacles", name: "錢幣二", img: "images/p02.jpg", 
      keyword: "彈性與波動", meaning: "你正在多個項目或收支之間努力維持平衡。保持彈性，應對環境的波動。",
      revKeyword: "失衡與財務透支", revMeaning: "多頭馬車讓你分身乏術，財務或時間管理已經失控，無法再維持原有的平衡。" },
    { eng: "Three of Pentacles", name: "錢幣三", img: "images/p03.jpg", 
      keyword: "專業與合作", meaning: "這是一張強調團隊合作的牌。發揮各自的專業技能，共同建構一個穩固的基礎。",
      revKeyword: "團隊失和與品質低落", revMeaning: "合作關係破裂，成員不願妥協。或是工作敷衍了事，缺乏專業精神與規劃。" },
    { eng: "Four of Pentacles", name: "錢幣四", img: "images/p04.jpg", 
      keyword: "掌控與吝嗇", meaning: "你將現有的資源抓得很緊，雖然帶來安全感，但也可能因為過度保守而阻礙了發展。",
      revKeyword: "打破固執與財務流失", revMeaning: "你願意打開心胸分享資源；或者相反，過度揮霍導致原本緊抓的財富流失。" },
    { eng: "Five of Pentacles", name: "錢幣五", img: "images/p05.jpg", 
      keyword: "匱乏與孤立", meaning: "正經歷財務或精神上的困難時期，感到孤立無援。請放下自尊，尋求外界的協助。",
      revKeyword: "重見光明與財務改善", revMeaning: "最困難的時期即將過去，資源與援助終於到來，身心狀況正在逐漸好轉。" },
    { eng: "Six of Pentacles", name: "錢幣六", img: "images/p06.jpg", 
      keyword: "慷慨與援助", meaning: "財務狀況達到平衡。如果你有能力，請慷慨助人；如果你需要幫助，資源將會降臨。",
      revKeyword: "給予不公與自私", revMeaning: "資源分配不均，或是施恩圖報。你可能面臨財務剝削，或者自己變得極度自私。" },
    { eng: "Seven of Pentacles", name: "錢幣七", img: "images/p07.jpg", 
      keyword: "耐心與評估", meaning: "辛勤耕耘後進入等待期。停下腳步評估目前的投資報酬率，耐心等待果實成熟。",
      revKeyword: "投資失利與缺乏耐心", revMeaning: "努力卻沒有得到應有的回報，感到挫折。或是太急於求成，導致半途而廢。" },
    { eng: "Eight of Pentacles", name: "錢幣八", img: "images/p08.jpg", 
      keyword: "專注與技藝", meaning: "全神貫注於手邊的工作。不斷磨練自己的技能與細節，踏實的努力將帶來回報。",
      revKeyword: "枯燥乏味與粗製濫造", revMeaning: "對重複性的工作感到厭煩。缺乏專注力，只想走捷徑，導致成品粗糙缺乏品質。" },
    { eng: "Nine of Pentacles", name: "錢幣九", img: "images/p09.jpg", 
      keyword: "富足與獨立", meaning: "享受自己努力得來的豐盛與獨立。這是一個財務自由、充滿自信與品味的舒適狀態。",
      revKeyword: "過度揮霍與依賴", revMeaning: "沉迷於物質享受而過度消費，或是為了維持表面的奢華而失去真正的財務自由。" },
    { eng: "Ten of Pentacles", name: "錢幣十", img: "images/p10.jpg", 
      keyword: "傳承與富裕", meaning: "物質的最高成就。代表家族企業、穩固的基業與長期的財務安全，充滿傳統價值。",
      revKeyword: "基業動搖與家庭糾紛", revMeaning: "傳統的價值觀或家產面臨挑戰。可能出現爭產、投資失敗或家庭內部的不和睦。" },
    { eng: "Page of Pentacles", name: "錢幣侍者", img: "images/p11.jpg", 
      keyword: "務實與學習", meaning: "踏實地學習新技能或理財知識。雖然進展緩慢，但每一步都走得非常穩固。",
      revKeyword: "懶散與計畫不切實際", revMeaning: "好高騖遠但不願付出努力。缺乏金錢觀念，學習態度散漫，計畫無法落地。" },
    { eng: "Knight of Pentacles", name: "錢幣騎士", img: "images/p12.jpg", 
      keyword: "勤奮與可靠", meaning: "或許不夠浪漫或靈活，但絕對是最勤奮可靠的人。按部就班，堅持到底就是勝利。",
      revKeyword: "死板與停滯不前", revMeaning: "太過固執與無趣，害怕任何改變。或者相反地，變得怠惰不負責，放棄了堅持。" },
    { eng: "Queen of Pentacles", name: "錢幣王后", img: "images/p13.jpg", 
      keyword: "滋養與豐盛", meaning: "懂得享受生活且具備實用主義。用豐富的資源與溫暖的態度去照顧身邊的人事物。",
      revKeyword: "物質至上與疏於照顧", revMeaning: "變得極度拜金或吝嗇。可能因為忙於世俗事物而忽略了自己或家人的身心健康。" },
    { eng: "King of Pentacles", name: "錢幣國王", img: "images/p14.jpg", 
      keyword: "成就與穩重", meaning: "事業有成的企業家精神。你擁有了穩固的物質基礎，用務實與穩重的態度掌控一切。",
      revKeyword: "貪腐與固步自封", revMeaning: "唯利是圖，為了金錢不擇手段。思想僵化不願接受新事物，或是事業面臨財務危機。" }
];

// ===== 純函式（不碰畫面、不連網路，最適合寫測試）=====

// 把 AI 回傳文字轉成頁面要顯示的 HTML：
// **粗體** → <b>粗體</b>、移除 Markdown 的 # 標題符號、壓掉多餘的 <br> 與空行。
function formatAiText(text) {
    let html = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    html = html.replace(/#{1,6}\s?/g, "");
    html = html.replace(/(<br\s*\/?>\s*){2,}/gi, "<br><br>");
    html = html.replace(/\n{3,}/g, "\n\n");
    return html;
}

// 回傳「還沒被抽過」的牌（依牌名比對 pickedCards）。
function getRemainingDeck(deck, pickedCards) {
    return deck.filter(c => !pickedCards.some(pc => pc.name === c.name));
}

// 抽一張追加牌：回傳「複製出來的新物件」（不會污染原始牌堆），並隨機決定正/逆位。
// rng 參數可注入，方便測試做出可預測的結果；正式使用時用預設的 Math.random。
function pickFollowUpCard(deck, pickedCards, fullDeck, rng = Math.random) {
    let remaining = getRemainingDeck(deck, pickedCards);
    if (remaining.length === 0) remaining = fullDeck;
    const idx = Math.floor(rng() * remaining.length);
    const isReversed = rng() > 0.5;
    return { ...remaining[idx], isReversed };
}

// 一次抽 count 張追加牌（彼此之間也不會重複），count 預設 1。
function pickFollowUpCards(deck, pickedCards, fullDeck, count = 1, rng = Math.random) {
    const drawn = [];
    let usedSoFar = pickedCards;
    for (let i = 0; i < count; i++) {
        const card = pickFollowUpCard(deck, usedSoFar, fullDeck, rng);
        drawn.push(card);
        usedSoFar = [...usedSoFar, card];
    }
    return drawn;
}

// 把主牌陣抽過的牌 + 歷史所有追問回合抽過的牌彙整成一份清單，供下一輪追加抽牌排除重複用。
function getAllDrawnCards(pickedCards, followUps) {
    const base = Array.isArray(pickedCards) ? pickedCards : [];
    const ups = Array.isArray(followUps) ? followUps : [];
    const fromFollowUps = ups.flatMap(f => f.cards || (f.card ? [f.card] : []));
    return [...base, ...fromFollowUps];
}

// ===== 「你的故事」占卜紀錄（純邏輯；碰 localStorage / 畫面的那層留在頁面）=====

// 整理出一筆要存的占卜紀錄。cards 建議為 [{ position, name, isReversed }]。
function createReadingRecord({ question, spreadName, cards, reading, ts, id, followUps } = {}) {
    const stamp = ts || Date.now();
    return {
        id: id || ("r" + stamp + "_" + Math.random().toString(36).slice(2, 8)),
        ts: stamp,
        question: question || "",
        spreadName: spreadName || "",
        cards: Array.isArray(cards) ? cards : [],
        reading: reading || "",
        followUps: Array.isArray(followUps) ? followUps : []
    };
}

// 把新紀錄加到最前面（最新在前），並限制最多 max 筆。回傳新陣列，不改動原本的。
function addReadingToHistory(history, record, max = 50) {
    const list = Array.isArray(history) ? history : [];
    return [record, ...list].slice(0, max);
}

// 依 id 刪掉一筆。回傳新陣列，不改動原本的。
function removeReadingFromHistory(history, id) {
    const list = Array.isArray(history) ? history : [];
    return list.filter(r => r.id !== id);
}

// 把 localStorage 讀到的字串安全地轉回陣列；壞資料一律回傳空陣列（不讓頁面崩潰）。
function parseHistory(json) {
    try {
        const data = JSON.parse(json);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

// 把一筆「向大師追加提問」接到指定紀錄的 followUps 後面。回傳新陣列，不改動原本的。
function addFollowUpToRecord(history, recordId, followUp) {
    const list = Array.isArray(history) ? history : [];
    return list.map(r => {
        if (r.id !== recordId) return r;
        const ups = Array.isArray(r.followUps) ? r.followUps : [];
        return { ...r, followUps: [...ups, followUp] };
    });
}

// ===== Node 測試用匯出（瀏覽器沒有 module 物件，這段會自動被跳過）=====
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        tarotDeck, spreadsData, fallbackModels, formatAiText, getRemainingDeck, pickFollowUpCard,
        pickFollowUpCards, getAllDrawnCards,
        createReadingRecord, addReadingToHistory, removeReadingFromHistory, parseHistory,
        addFollowUpToRecord
    };
}
