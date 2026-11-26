/* 杨昊行动 — 状态 / HUD / 挑战 / 赌局 / 战术地图 */
(function () {
  const W = window.YH_WORDS;
  const A = window.YH_Audio;
  const SAVE_KEY = "yanghao_save_v1";
  const INTEL_GOAL = 20;

  /* ---------------- 存档 ---------------- */
  const state = {
    coins: 120, correct: 0, wrong: 0, streak: 0, bestStreak: 0,
    learned: {}, bets: [], betWins: 0, betTotal: 0,
    betStreak: 0, bestBetStreak: 0,
    sound: true, modal: null, started: false
  };
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        coins: state.coins, correct: state.correct, wrong: state.wrong,
        bestStreak: state.bestStreak, learned: state.learned, bets: state.bets,
        betWins: state.betWins, betTotal: state.betTotal,
        betStreak: state.betStreak, bestBetStreak: state.bestBetStreak, sound: state.sound
      }));
    } catch (e) { /* 忽略 */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      ["coins", "correct", "wrong", "bestStreak", "betWins", "betTotal", "betStreak", "bestBetStreak"].forEach(function (k) {
        if (typeof d[k] === "number") state[k] = d[k];
      });
      if (d.learned && typeof d.learned === "object") state.learned = d.learned;
      if (Array.isArray(d.bets)) state.bets = d.bets.slice(0, 8);
      if (typeof d.sound === "boolean") state.sound = d.sound;
    } catch (e) { /* 忽略 */ }
  }
  load();

  /* ---------------- DOM 快捷 ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------------- HUD ---------------- */
  function updateHUD() {
    $("coin-num").textContent = state.coins.toLocaleString("en-US");
    $("streak-num").textContent = state.streak;
    $("streak-box").classList.toggle("hot", state.streak >= 3);
    $("stat-correct").textContent = state.correct;
    $("stat-wrong").textContent = state.wrong;
    let mastered = 0;
    Object.keys(state.learned).forEach(function (k) { if (state.learned[k].ok) mastered++; });
    $("stat-learned").textContent = mastered;
    $("stat-bet").textContent = state.betTotal ? Math.round(state.betWins / state.betTotal * 100) + "%" : "—";
    const bsEl = $("stat-betstreak");
    if (bsEl) bsEl.textContent = state.betStreak ? state.betStreak + " 连 · +" + betBonus(state.betStreak).toFixed(1) + "×" : "0";
    const prog = Math.min(state.correct, INTEL_GOAL);
    $("intel-bar").style.width = (prog / INTEL_GOAL * 100) + "%";
    $("intel-text").textContent = state.correct + " / " + INTEL_GOAL + (state.correct >= INTEL_GOAL ? "  ✓ 已达成" : "");
  }

  function addCoins(n) {
    state.coins = Math.max(0, state.coins + n);
    updateHUD(); save();
    if (n > 0) coinFloat("+" + n);
  }

  function coinFloat(txt) {
    const el = $("coin-float");
    el.textContent = txt + " ◈";
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }

  function toast(html, type, ms) {
    const box = $("toasts");
    const d = document.createElement("div");
    d.className = "toast " + (type || "");
    d.innerHTML = html;
    box.appendChild(d);
    setTimeout(function () {
      d.style.transition = "opacity .3s,transform .3s";
      d.style.opacity = "0"; d.style.transform = "translateX(24px)";
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 320);
    }, ms || 3200);
    while (box.children.length > 5) box.removeChild(box.firstChild);
  }

  /* ---------------- 搜索进度条（动态注入） ---------------- */
  let searchEl = null, searchFill = null;
  function buildSearchOverlay() {
    const wrap = document.createElement("div");
    wrap.id = "search-overlay";
    wrap.innerHTML = '<div class="so-title">▣ 正在搜索补给箱 / SEARCHING…</div><div class="so-track"><div class="so-fill" id="so-fill"></div></div>';
    $("hud").appendChild(wrap);
    searchEl = wrap; searchFill = $("so-fill");
  }
  function showSearch(p) {
    if (!searchEl) return;
    searchEl.classList.remove("hidden");
    searchFill.style.width = Math.min(100, p * 100) + "%";
  }
  function hideSearch() { if (searchEl) searchEl.classList.add("hidden"); }

  /* ---------------- 通用：关闭弹窗 ---------------- */
  function lock() { if (window.YH && window.YH.lock) window.YH.lock(); }
  function unlock() { if (window.YH && window.YH.unlock) window.YH.unlock(); }
  function closeModal(id, cb) {
    $(id).classList.add("hidden");
    state.modal = null;
    if (cb) cb();
  }
  function isModalOpen() { return !!state.modal; }

  function wordCard(w, violet) {
    return '<div class="word-card">' +
      '<div class="wc-word">' + esc(w.word) + '</div>' +
      '<div class="wc-ipa">' + esc(w.ipa) + '</div>' +
      '<div class="wc-mean"><em>' + esc(w.pos) + '</em>' + esc(w.meaning) + '</div>' +
      '<div class="q-audio"><button class="btn-chip ' + (violet ? "amber" : "") + '" data-speak="' + esc(w.word) + '">🔊 播报单词</button></div>' +
      '</div>';
  }

  function bindSpeak(root) {
    root.querySelectorAll("[data-speak]").forEach(function (b) {
      b.onclick = function () { A.play("ui"); A.speak(b.getAttribute("data-speak")); };
    });
  }

  /* ============================================================
   *                    补给箱 · 词汇解密
   * ============================================================ */
  let crateCtx = null;

  /* 四选一干扰项：优先同词性、长度接近，不足再宽松补齐，最后打乱 */
  function makeCrateOptions(w) {
    const pool = W.list.filter(function (x) {
      return x.word !== w.word && x.pos === w.pos && Math.abs(x.word.length - w.word.length) <= 3;
    });
    const opts = [w];
    while (opts.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (!opts.some(function (o) { return o.word === pick.word; })) opts.push(pick);
    }
    if (opts.length < 4) {
      const rest = W.list.filter(function (x) { return !opts.some(function (o) { return o.word === x.word; }); });
      while (opts.length < 4 && rest.length) opts.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    }
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }
    return opts;
  }

  function crateKeyHandler(e) {
    if (!crateCtx || crateCtx.answered || state.modal !== "crate") return;
    const n = parseInt(e.key, 10);
    if (!(n >= 1 && n <= 4)) return;
    e.preventDefault();
    const b = document.querySelectorAll("#crate-options .q-option")[n - 1];
    if (b && !b.classList.contains("eliminated")) {
      A.play("ui");
      finishCrate(b.getAttribute("data-w") === crateCtx.w.word, false);
    }
  }

  function openCrate(crate, world) {
    A.play("search");
    const w = W.pick(false);
    crateCtx = { crate: crate, world: world, w: w, options: makeCrateOptions(w), answered: false };
    state.modal = "crate";
    unlock();
    $("crate-id").textContent = crate.id;
    $("modal-crate").classList.remove("hidden");
    $("crate-foot").textContent = "点击选项，或按数字键 1~4 作答";
    renderCrateQuestion();
    document.addEventListener("keydown", crateKeyHandler);
    setTimeout(function () { A.speak(w.word); }, 380);
  }

  function renderCrateQuestion() {
    const w = crateCtx.w;
    const body = $("crate-body");
    body.className = "modal-body";
    body.innerHTML =
      '<div class="q-meaning">' +
        '<span class="q-pos">TARGET WORD / ' + esc(w.pos) + '</span>' +
        '<div class="q-cn">' + esc(w.meaning) + '</div>' +
        '<div class="q-tip">箱体已播报该词 · 选出正确英文拼写（点击选项或按 1~4）</div>' +
      '</div>' +
      '<div class="q-audio"><button class="btn-chip amber" id="crate-replay">🔊 再听一次</button></div>' +
      '<div class="q-options" id="crate-options">' +
        crateCtx.options.map(function (o, i) {
          return '<button class="q-option" data-w="' + esc(o.word) + '"><span class="qo-key">' + (i + 1) + '</span><span class="qo-word">' + esc(o.word) + '</span></button>';
        }).join('') +
      '</div>' +
      '<div class="q-actions">' +
        '<button class="btn-chip" id="crate-hint">排除一个干扰项</button>' +
        '<button class="btn-chip" id="crate-skip">放弃并查看答案</button>' +
      '</div>';

    $("crate-replay").onclick = function () { A.play("ui"); A.speak(w.word); };
    body.querySelectorAll(".q-option").forEach(function (b) {
      b.onclick = function () {
        if (b.classList.contains("eliminated")) return;
        A.play("ui");
        finishCrate(b.getAttribute("data-w") === w.word, false);
      };
    });
    $("crate-hint").onclick = function () {
      A.play("ui");
      const bad = Array.prototype.filter.call(body.querySelectorAll(".q-option:not(.eliminated)"), function (b) {
        return b.getAttribute("data-w") !== w.word;
      });
      if (bad.length) bad[Math.floor(Math.random() * bad.length)].classList.add("eliminated");
      this.textContent = "已排除一个";
      this.disabled = true;
    };
    $("crate-skip").onclick = function () { finishCrate(false, true); };
  }

  function finishCrate(ok, skipped) {
    if (!crateCtx || crateCtx.answered) return;
    crateCtx.answered = true;
    const w = crateCtx.w;
    const body = $("crate-body");
    state.learned[w.word] = { word: w.word, ipa: w.ipa, pos: w.pos, meaning: w.meaning, ok: !!ok };

    let reward = 0;
    if (ok) {
      state.correct++; state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      reward = 20 + Math.min(20, (state.streak - 1) * 4) + Math.floor(Math.random() * 11);
      addCoins(reward);
      A.play("correct"); setTimeout(function () { A.play("coin"); }, 260);
      toast("解密成功 <b>" + esc(w.word) + "</b> · 获得 " + reward + " 金币", "good");
    } else {
      state.streak = 0;
      if (!skipped) state.wrong++;
      A.play("wrong");
      toast(skipped ? "已放弃 · 正确答案已归档" : "拼写失误 · 正确答案已归档", "bad");
    }
    updateHUD(); save();
    if (state.correct === INTEL_GOAL) toast("<b>情报收集完成</b> · 行动评级提升，继续深入或前往渡鸦灯", "violet", 5000);
    if (state.streak > 0 && state.streak % 5 === 0) toast("<b>" + state.streak + " 连击</b> · 奖励加成生效", "good");

    body.innerHTML =
      '<div class="result-banner ' + (ok ? "good" : "bad") + '">' +
        '<div class="rb-tag">' + (ok ? "DECRYPT SUCCESS / 解密成功" : skipped ? "ABORTED / 已放弃" : "DECRYPT FAILED / 拼写失误") + '</div>' +
        '<h4>' + (ok ? "拼写正确" : "记住这个单词") + '</h4>' +
        '<p>' + (ok ? "指挥部已下发战术金币" : "系统已公布正确答案，下次搜索再战") + '</p>' +
      '</div>' +
      wordCard(w, false) +
      (ok ? '<div class="reward-line">◈ +' + reward + ' 金币' + (state.streak > 1 ? "　·　" + state.streak + " 连击" : "") + '</div>'
          : '<div class="reward-line lose">◈ +0 金币</div>');
    bindSpeak(body);
    $("crate-foot").textContent = ok ? "词条已收录进情报档案" : "正确答案已展示，可点击 🔊 跟读";
    setTimeout(function () { A.speak(w.word); }, 300);
  }

  function closeCrate() {
    if (state.modal !== "crate") return;
    document.removeEventListener("keydown", crateKeyHandler);
    closeModal("modal-crate");
    crateCtx = null;
    lock();
  }

  /* ============================================================
   *                    渡鸦灯 · 高风险赌局
   * ============================================================ */
  let betCtx = null;
  let timerId = null, rollTimer = null, rollIv = null;
  const MULTIPLIERS = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 2, 3, 4, 2.5, 3.5, 5];

  /* 连赢加成：结算前的连胜数每多 1 局 +0.5×，最高 +2×。
     第 1 局赢（streak=0）不加成，第 2 局起 +0.5×，第 5 局起封顶 +2×。 */
  function betBonus(streak) {
    return Math.min(2, Math.max(0, streak) * 0.5);
  }

  function clearBetTimers() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (rollTimer) { clearTimeout(rollTimer); rollTimer = null; }
    if (rollIv) { clearInterval(rollIv); rollIv = null; }
  }

  function openRaven() {
    A.play("bet");
    clearBetTimers();
    betCtx = { w: null, stake: 0, resolved: false, timeLeft: 18 };
    state.modal = "raven";
    unlock();
    $("modal-raven").classList.remove("hidden");
    $("raven-foot").textContent = "答对随机 2~6 倍 + 连赢加成 · 答错失去本金";
    renderBetEntry();
  }

  function renderBetEntry(err) {
    clearBetTimers();
    betCtx.w = null; betCtx.stake = 0; betCtx.resolved = true; // 入口阶段不视为进行中
    const body = $("raven-body");
    body.className = "modal-body";
    body.innerHTML =
      '<div class="bet-headline">「渡鸦」只跟敢下注的人做交易。<br>投入金币开局，限时拼出一个 <b>CET-4 高阶词</b> —— 答对，随机倍率返还；答错，本金归零。<br><b>连赢加成 · 每多赢一局 +0.5×，最高 +2×</b></div>' +
      '<div class="bet-balance"><span>当前持有 / CREDITS</span><b id="bet-bal">◈ ' + state.coins.toLocaleString("en-US") + '</b></div>' +
      '<div class="bet-streak' + (state.betStreak >= 2 ? " hot" : "") + '">' +
        '<span>RAVEN STREAK / 渡鸦连胜</span>' +
        '<b>' + (state.betStreak ? state.betStreak + " 连胜" : "尚未开局") + '</b>' +
        '<em>' + (state.betStreak ? "下一局 +" + betBonus(state.betStreak).toFixed(1) + "×" : "赢一局开启加成") + '</em>' +
      '</div>' +
      '<div class="bet-label">投入金币 / STAKE</div>' +
      '<div class="bet-inputrow"><input id="bet-input" class="bet-input" type="number" min="1" max="' + state.coins + '" value="' + Math.min(50, state.coins) + '" placeholder="输入金额"></div>' +
      '<div class="bet-chips">' +
        '<button class="chip" data-bet="50">50</button>' +
        '<button class="chip" data-bet="100">100</button>' +
        '<button class="chip" data-bet="300">300</button>' +
        '<button class="chip" data-bet="all">全押 ALL IN</button>' +
      '</div>' +
      '<div class="bet-odds">' +
        '<div class="odd"><b>2~8×</b><span>随机+连赢</span></div>' +
        '<div class="odd"><b>18s</b><span>限时拼写</span></div>' +
        '<div class="odd"><b>0</b><span>答错返还</span></div>' +
      '</div>' +
      '<div class="bet-err" id="bet-err">' + (err || "") + '</div>' +
      '<button id="bet-start" class="btn-violet">◆ 投入金币 · 开启赌局</button>' +
      renderBetLog();

    const input = $("bet-input");
    body.querySelectorAll("[data-bet]").forEach(function (b) {
      b.onclick = function () {
        A.play("ui");
        input.value = b.getAttribute("data-bet") === "all" ? state.coins : b.getAttribute("data-bet");
      };
    });
    $("bet-start").onclick = startBet;
    input.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); startBet(); } };
    setTimeout(function () { input.focus(); input.select(); }, 60);
  }

  function renderBetLog() {
    if (!state.bets.length) return "";
    let h = '<div class="bet-log"><div class="label">近期赌局 / BET HISTORY</div>';
    state.bets.slice(0, 5).forEach(function (r) {
      h += '<div class="log-row"><span>' + esc(r.word) + ' · 押 ' + r.stake +
        (r.streak ? ' <i class="log-streak">' + r.streak + '连</i>' : '') + '</span><b class="' + (r.win ? "win" : "lose") + '">' +
        (r.win ? "+" + r.gain + " (" + r.mult + "×" + (r.bonus > 0 ? " 含+" + r.bonus.toFixed(1) : "") + ")" : "-0 失败") + '</b></div>';
    });
    return h + "</div>";
  }

  function startBet() {
    if (!betCtx) return;
    const input = $("bet-input");
    const stake = Math.floor(Number(input.value));
    const errEl = $("bet-err");
    if (!isFinite(stake) || stake < 1) { errEl.textContent = "⚠ 请输入至少 1 枚金币"; A.play("wrong"); return; }
    if (stake > state.coins) { errEl.textContent = "⚠ 金币不足，当前持有 " + state.coins; A.play("wrong"); return; }

    A.play("bet");
    state.coins -= stake; updateHUD(); save();
    betCtx.stake = stake;
    betCtx.w = W.pick(true);
    betCtx.resolved = false;
    betCtx.timeLeft = 18;
    betCtx.bonus = betBonus(state.betStreak);
    const body = $("raven-body");
    body.className = "modal-body";
    body.innerHTML =
      '<div class="q-meaning">' +
        '<span class="q-pos">RAVEN CHALLENGE / ' + esc(betCtx.w.pos) + '</span>' +
        '<div class="q-cn">' + esc(betCtx.w.meaning) + '</div>' +
        '<div class="q-tip">无提示、无播报 · 押注 ◈ ' + stake + ' · 拼出对应英文单词' +
          (betCtx.bonus > 0 ? '<b class="tip-bonus">连胜加成 +' + betCtx.bonus.toFixed(1) + '×</b>' : '') + '</div>' +
      '</div>' +
      '<div class="timer-wrap"><div class="timer-meta"><span>倒计时 / TIME REMAINING</span><b id="timer-num">18.0s</b></div><div class="timer-bar"><div class="timer-fill safe" id="timer-fill"></div></div></div>' +
      '<div class="q-inputrow">' +
        '<input id="bet-answer" class="q-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入英文拼写…">' +
        '<button id="bet-submit" class="q-submit" style="background:linear-gradient(180deg,#c995ff,#8b4ee0);color:#160a26">提交</button>' +
      '</div>' +
      '<div class="bet-err" id="bet-err2"></div>';
    $("raven-foot").textContent = "答对随机 2~6 倍" + (betCtx.bonus > 0 ? " + 连胜 " + betCtx.bonus.toFixed(1) + "×" : "") + " · 超时或答错失去本金";
    const ans = $("bet-answer");
    $("bet-submit").onclick = submitBet;
    ans.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); submitBet(); } };
    setTimeout(function () { ans.focus(); }, 60);

    timerId = setInterval(function () {
      if (!betCtx || betCtx.resolved) { clearInterval(timerId); timerId = null; return; }
      betCtx.timeLeft -= 0.1;
      const left = Math.max(0, betCtx.timeLeft);
      const num = $("timer-num"), fill = $("timer-fill");
      if (num) num.textContent = left.toFixed(1) + "s";
      if (fill) {
        fill.style.width = (left / 18 * 100) + "%";
        fill.classList.toggle("safe", left > 6);
      }
      if (left <= 0) {
        clearInterval(timerId); timerId = null;
        finishBet(false, true);
      }
    }, 100);
  }

  function submitBet() {
    if (!betCtx || betCtx.resolved) return;
    const input = $("bet-answer");
    if (!input) return;
    const val = input.value.trim().toLowerCase();
    if (!val) { input.style.borderColor = "#ff6b6b"; A.play("wrong"); return; }
    finishBet(val === betCtx.w.word, false);
  }

  function finishBet(ok, timeout) {
    if (!betCtx || betCtx.resolved || !betCtx.w) return;
    betCtx.resolved = true;
    clearBetTimers();
    const w = betCtx.w, stake = betCtx.stake;
    const streakBefore = state.betStreak;
    const bonus = betBonus(streakBefore);
    state.betTotal++;
    let gain = 0, mult = 0, baseMult = 0;

    if (ok) {
      baseMult = MULTIPLIERS[Math.floor(Math.random() * MULTIPLIERS.length)];
      if (Math.random() < 0.06) baseMult = 6;   // 小概率顶倍
      mult = Math.round((baseMult + bonus) * 10) / 10;
      gain = Math.round(stake * mult);
      state.betStreak = streakBefore + 1;
      state.bestBetStreak = Math.max(state.bestBetStreak, state.betStreak);
      addCoins(gain);
      state.betWins++;
      state.learned[w.word] = { word: w.word, ipa: w.ipa, pos: w.pos, meaning: w.meaning, ok: true };
      A.play("roll");
      toast("渡鸦认可了你的词汇量 · <b>" + esc(w.word) + "</b>", "violet");
      if (bonus > 0) toast("<b>" + state.betStreak + " 连胜</b> · 倍率加成 +" + bonus.toFixed(1) + "× 已叠加", "good");
    } else {
      state.betStreak = 0;
      A.play("lose");
      state.learned[w.word] = { word: w.word, ipa: w.ipa, pos: w.pos, meaning: w.meaning, ok: false };
      toast(timeout ? "赌局超时 · 本金已归渡鸦" : "赌局失败 · 本金已归渡鸦", "bad");
    }
    state.bets.unshift({ word: w.word, stake: stake, win: !!ok, gain: gain, mult: mult, baseMult: baseMult, bonus: bonus, streak: state.betStreak });
    state.bets = state.bets.slice(0, 8);
    updateHUD(); save();

    const body = $("raven-body");
    body.className = "modal-body";
    if (ok) {
      body.innerHTML =
        '<div class="roll-box">' +
          '<div class="roll-streak">RAVEN STREAK / 渡鸦连胜 ' + state.betStreak + (bonus > 0 ? ' · +' + bonus.toFixed(1) + '×' : '') + '</div>' +
          '<div class="rb-tag" style="font:700 11px var(--mono);letter-spacing:.24em;color:var(--green)">WIN / 赌局获胜</div>' +
          '<div class="roll-num" id="roll-num">2.0×</div>' +
          '<div class="roll-cap" id="roll-cap">RANDOM MULTIPLIER / 随机倍率抽取中</div>' +
          '<div class="roll-result" id="roll-result"></div>' +
        '</div>' +
        wordCard(w, true) +
        '<div style="text-align:center;margin-top:6px"><button class="btn-chip" id="bet-again">再来一局 / RE-BET</button></div>' +
        renderBetLog();
      const numEl = $("roll-num");
      const seq = [2, 3.5, 5, 2.5, 4, 6, 3, 4.5, 5.5, 2.5];
      let i = 0;
      rollIv = setInterval(function () { numEl.textContent = seq[i++ % seq.length].toFixed(1) + "×"; }, 72);
      rollTimer = setTimeout(function () {
        clearInterval(rollIv); rollIv = null; rollTimer = null;
        if (state.modal !== "raven") return;      // 弹窗已关闭则跳过
        const n = $("roll-num"), r = $("roll-result"), cap = $("roll-cap");
        if (n) n.textContent = mult.toFixed(1) + "×";
        if (r) r.textContent = "◈ +" + gain.toLocaleString("en-US") + " 金币";
        if (cap) cap.textContent = "押 " + stake + " → 返还 " + gain + " 金币" +
          (bonus > 0 ? "　·　基础 " + baseMult.toFixed(1) + "× + 连胜 " + bonus.toFixed(1) + "×" : "");
        A.play("jackpot");
        coinFloat("+" + gain);
      }, 1300);
      $("bet-again").onclick = function () { A.play("ui"); renderBetEntry(); };
    } else {
      body.innerHTML =
        '<div class="result-banner bad">' +
          '<div class="rb-tag">' + (timeout ? "TIME OUT / 超时" : "WRONG ANSWER / 拼写失误") + '</div>' +
          '<h4>渡鸦收走了筹码</h4>' +
          '<p>本金 ◈ ' + stake + ' 已损失 · 正确答案如下，记住它</p>' +
        '</div>' +
        wordCard(w, true) +
        '<div class="reward-line lose">◈ -' + stake + ' 金币</div>' +
        (streakBefore > 0 ? '<div class="roll-streak lose">连胜中断 · ' + streakBefore + ' 连胜记录已清零</div>' : '') +
        '<div style="text-align:center;margin-top:8px"><button class="btn-chip" id="bet-again">再来一局 / RE-BET</button></div>' +
        renderBetLog();
      $("bet-again").onclick = function () { A.play("ui"); renderBetEntry(); };
    }
    bindSpeak(body);
    $("raven-foot").textContent = ok ? "倍率已结算，金币入账" : "本金损失，可点击 🔊 跟读正确答案";
    setTimeout(function () { A.speak(w.word); }, ok ? 1500 : 300);
  }

  function closeRaven() {
    if (state.modal !== "raven") return;
    // 若押注已提交但尚未结算，按弃局处理
    if (betCtx && !betCtx.resolved && betCtx.w) {
      state.betTotal++;
      state.bets.unshift({ word: betCtx.w.word, stake: betCtx.stake, win: false, gain: 0, mult: 0, baseMult: 0, bonus: 0, streak: 0 });
      state.bets = state.bets.slice(0, 8);
      state.learned[betCtx.w.word] = { word: betCtx.w.word, ipa: betCtx.w.ipa, pos: betCtx.w.pos, meaning: betCtx.w.meaning, ok: false };
      const lostStreak = state.betStreak;
      state.betStreak = 0;
      updateHUD(); save();
      toast("中途离开赌局 · 本金 ◈ " + betCtx.stake + " 已损失" + (lostStreak ? " · " + lostStreak + " 连胜中断" : ""), "bad");
    }
    clearBetTimers();
    betCtx = null;
    closeModal("modal-raven");
    lock();
  }

  /* ============================================================
   *                    情报档案（已掌握词条）
   * ============================================================ */
  function openVocab() {
    const list = Object.keys(state.learned).sort();
    let mastered = 0;
    list.forEach(function (k) { if (state.learned[k].ok) mastered++; });
    $("vocab-count").textContent = list.length;
    const body = $("vocab-body");
    body.innerHTML = '<div class="vocab-summary">共接触 <b>' + list.length + '</b> 个词条，其中 <b>' + mastered + '</b> 个拼写正确。点击 🔊 可跟读发音。</div>' +
      '<div class="vocab-list" id="vocab-list"></div>';
    const box = $("vocab-list");
    if (!list.length) {
      box.innerHTML = '<div class="vocab-empty">档案还是空的。<br>去场上搜索几个补给箱吧。</div>';
    } else {
      list.forEach(function (k) {
        const w = state.learned[k];
        const d = document.createElement("div");
        d.className = "vocab-item";
        d.innerHTML = '<div class="vi-left"><b style="color:' + (w.ok ? "var(--amber)" : "var(--red)") + '">' + esc(w.word) + '</b><span>' + esc(w.ipa) + '</span><div>' + esc(w.pos) + " " + esc(w.meaning) + (w.ok ? "" : "　· 待复习") + '</div></div>' +
          '<button class="vi-play" data-speak="' + esc(w.word) + '">🔊</button>';
        box.appendChild(d);
      });
      bindSpeak(box);
    }
    $("modal-vocab").classList.remove("hidden");
  }
  function closeVocab() { $("modal-vocab").classList.add("hidden"); }

  /* ============================================================
   *                    战术地图
   * ============================================================ */
  let mapCtx = null;
  function drawMinimap(player, yaw, world) {
    const c = $("minimap"); if (!c) return;
    if (!mapCtx) mapCtx = c.getContext("2d");
    const g = mapCtx, S = c.width, C = S / 2, R = C - 12, A_ = world.arena;
    g.clearRect(0, 0, S, S);
    g.fillStyle = "rgba(6,13,20,.86)"; g.fillRect(0, 0, S, S);
    // 网格
    g.strokeStyle = "rgba(92,216,245,.09)"; g.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const p = C + i * R / 2;
      g.beginPath(); g.moveTo(p, 8); g.lineTo(p, S - 8); g.stroke();
      g.beginPath(); g.moveTo(8, p); g.lineTo(S - 8, p); g.stroke();
    }
    g.strokeStyle = "rgba(120,180,220,.45)"; g.lineWidth = 1.5;
    g.strokeRect(C - R, C - R, R * 2, R * 2);
    // 北向标记
    g.fillStyle = "rgba(146,180,205,.8)"; g.font = "9px monospace"; g.textAlign = "center";
    g.fillText("N", C, 12);

    function mx(x) { return C + x / A_ * R; }
    function my(z) { return C + z / A_ * R; }

    // 集装箱 / 障碍
    g.fillStyle = "rgba(110,135,155,.28)";
    world.colliders.forEach(function (o) {
      if (o.w > 5 && o.d > 5) return;
      if (o.w > 8) { g.fillRect(mx(o.x - o.w / 2), my(o.z - o.d / 2), o.w / A_ * R, Math.max(2, o.d / A_ * R)); }
    });

    // 补给箱
    world.crates.forEach(function (cr) {
      const x = mx(cr.pos.x), y = my(cr.pos.z);
      g.beginPath(); g.arc(x, y, cr.ready ? 2.8 : 1.8, 0, 7);
      g.fillStyle = cr.ready ? (cr.targeted ? "#ffffff" : "#ffab3d") : "rgba(120,140,155,.4)";
      g.fill();
      if (cr.targeted) { g.strokeStyle = "#ffab3d"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke(); }
    });

    // 渡鸦
    const rx = mx(world.ravenPos.x), ry = my(world.ravenPos.z);
    g.save(); g.translate(rx, ry); g.rotate(Math.PI / 4);
    g.fillStyle = "#b57bff"; g.shadowColor = "#b57bff"; g.shadowBlur = 10;
    g.fillRect(-4.5, -4.5, 9, 9); g.restore(); g.shadowBlur = 0;
    if (world.raven.targeted) { g.strokeStyle = "#b57bff"; g.lineWidth = 1.5; g.beginPath(); g.arc(rx, ry, 9, 0, 7); g.stroke(); }

    // 玩家（朝向三角）
    const px = mx(player.x), py = my(player.z);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    g.save(); g.translate(px, py);
    g.beginPath();
    g.moveTo(fx * 9, fz * 9);
    g.lineTo(-fz * 5 - fx * 5, fx * 5 - fz * 5);
    g.lineTo(fz * 5 - fx * 5, -fx * 5 - fz * 5);
    g.closePath();
    g.fillStyle = "#5cd8f5"; g.shadowColor = "#5cd8f5"; g.shadowBlur = 9; g.fill();
    g.restore(); g.shadowBlur = 0;
  }

  /* ============================================================
   *                    初始化
   * ============================================================ */
  function init() {
    buildSearchOverlay();
    hideSearch();
    A.setEnabled(state.sound);
    $("word-count").textContent = W.count;
    updateHUD();

    $("crate-close").onclick = function () { A.play("ui"); closeCrate(); };
    $("raven-close").onclick = function () { A.play("ui"); closeRaven(); };
    $("vocab-close").onclick = function () { A.play("ui"); closeVocab(); };
    $("btn-vocab").onclick = function () { A.play("ui"); openVocab(); };
    $("btn-sound").onclick = function () {
      state.sound = !state.sound; A.setEnabled(state.sound); save();
      this.textContent = "声音：" + (state.sound ? "开" : "关");
      if (state.sound) A.play("ui");
    };
    $("btn-sound").textContent = "声音：" + (state.sound ? "开" : "关");
    $("btn-reset").onclick = function () {
      if (!window.confirm("确认重置全部存档？金币、战绩与已掌握词条都会清空。")) return;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
      state.coins = 120; state.correct = 0; state.wrong = 0; state.streak = 0;
      state.bestStreak = 0; state.learned = {}; state.bets = []; state.betWins = 0; state.betTotal = 0;
      state.betStreak = 0; state.bestBetStreak = 0;
      updateHUD(); save();
      toast("存档已重置 · 初始金币 120", "good");
    };

    // 弹窗内按 ESC 关闭；赌局进行中按 ESC 视为弃局
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (state.modal === "crate") { e.preventDefault(); closeCrate(); }
      else if (state.modal === "raven") { e.preventDefault(); closeRaven(); }
      else if (!$("modal-vocab").classList.contains("hidden")) { e.preventDefault(); closeVocab(); }
    }, true);
  }

  window.YH_UI = {
    state: state, init: init, updateHUD: updateHUD, toast: toast, addCoins: addCoins,
    openCrate: openCrate, closeCrate: closeCrate,
    openRaven: openRaven, closeRaven: closeRaven,
    openVocab: openVocab, closeVocab: closeVocab,
    showSearch: showSearch, hideSearch: hideSearch,
    drawMinimap: drawMinimap, isModalOpen: isModalOpen, save: save
  };
})();
