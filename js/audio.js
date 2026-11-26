/* 杨昊行动 — 音效引擎 (Web Audio 合成) + 单词语音播报 (SpeechSynthesis) */
(function () {
  let ctx = null;
  let master = null;
  let enabled = true;

  function init() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    } catch (e) { /* 忽略 */ }
  }

  function resume() {
    init();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!enabled || !ctx) return;
    try {
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    } catch (e) { /* 忽略 */ }
  }

  function noise(dur, vol, delay) {
    if (!enabled || !ctx) return;
    try {
      const t0 = ctx.currentTime + (delay || 0);
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = vol || 0.15;
      const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 900;
      src.connect(flt); flt.connect(g); g.connect(master);
      src.start(t0);
    } catch (e) { /* 忽略 */ }
  }

  const SFX = {
    ui:       function () { tone(620, 0.07, "square", 0.16); },
    hover:    function () { tone(880, 0.04, "sine", 0.07); },
    search:   function () { noise(0.35, 0.18); tone(180, 0.3, "sawtooth", 0.12, 0, 420); },
    correct:  function () { tone(523, 0.13, "sine", 0.28); tone(659, 0.13, "sine", 0.26, 0.1); tone(784, 0.22, "sine", 0.28, 0.2); tone(1047, 0.35, "triangle", 0.2, 0.3); },
    wrong:    function () { tone(220, 0.22, "square", 0.2, 0, 120); tone(150, 0.3, "sawtooth", 0.14, 0.12); },
    coin:     function () { tone(988, 0.09, "square", 0.16); tone(1319, 0.16, "square", 0.14, 0.07); },
    bet:      function () { tone(330, 0.1, "triangle", 0.2); tone(440, 0.14, "triangle", 0.18, 0.09); },
    roll:     function () { for (let i = 0; i < 14; i++) tone(400 + Math.random() * 700, 0.05, "square", 0.09, i * 0.075); },
    jackpot:  function () { [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, 0.3, "triangle", 0.22, i * 0.09); }); },
    lose:     function () { tone(300, 0.25, "sawtooth", 0.18, 0, 90); },
    beacon:   function () { tone(1200, 0.06, "sine", 0.08); }
  };

  function play(name) { init(); resume(); if (SFX[name]) SFX[name](); }

  // 用浏览器 TTS "报单词"
  function speak(word, rate) {
    if (!enabled) return;
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      u.rate = rate || 0.82;
      u.pitch = 1.0;
      u.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const en = voices.filter(function (v) { return /^en(-|_)/i.test(v.lang); });
      if (en.length) u.voice = en[0];
      window.speechSynthesis.speak(u);
    } catch (e) { /* 忽略 */ }
  }

  function setEnabled(v) { enabled = !!v; }
  function isEnabled() { return enabled; }

  window.YH_Audio = { init: init, resume: resume, play: play, speak: speak, setEnabled: setEnabled, isEnabled: isEnabled };
})();
