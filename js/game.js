/* 杨昊行动 — 主程序：渲染 / 第一人称控制 / 交互 */
(function () {
  const T = window.THREE;
  const A = window.YH_Audio;
  const UI = window.YH_UI;
  const World = window.YH_World;

  const canvas = document.getElementById("scene");
  const renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 320);
  camera.rotation.order = "YXZ";
  camera.position.set(0, 1.65, 20);

  const world = World.build(scene, camera);
  camera.position.set(world.spawn.x, 1.65, world.spawn.z);

  /* ---------------- 全局桥 ---------------- */
  let started = false;
  let locked = false;
  let dragging = false;
  let lastMouse = { x: 0, y: 0 };
  let paused = false;

  window.YH = {
    world: world,
    camera: camera,
    setView: function (x, z, yv, pv) {
      camera.position.x = x; camera.position.z = z;
      if (typeof yv === "number") yaw = yv;
      if (typeof pv === "number") pitch = Math.max(-1.42, Math.min(1.42, pv));
    },
    lock: function () {
      if (!started || UI.isModalOpen()) return;
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(function () { });
      } catch (e) { /* 忽略：自动降级为拖动视角 */ }
    },
    unlock: function () {
      try { document.exitPointerLock(); } catch (e) { }
    }
  };

  /* ---------------- 输入 ---------------- */
  const keys = {};
  let yaw = 0, pitch = 0;
  let bob = 0, sprintAmt = 0;
  const velocity = new T.Vector3();
  const desired = new T.Vector3();
  const fwd = new T.Vector3(), right = new T.Vector3();
  let target = null;
  let searching = null;
  const SENS = 0.0022;

  function isTyping() { return UI.isModalOpen(); }

  document.addEventListener("keydown", function (e) {
    if (isTyping()) return;              // 弹窗输入交给 ui.js
    keys[e.code] = true;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown"].indexOf(e.code) >= 0) e.preventDefault();

    if (e.code === "KeyF" && !searching) {
      if (!target) return;
      A.play("ui");
      if (target.type === "crate") {
        if (!target.ready) return;
        searching = { crate: target, t: 0, dur: 1.15 };
        UI.showSearch(0);
        A.play("search");
      } else if (target.type === "raven") {
        world.setTarget(null);
        UI.openRaven();
      }
    }
  });
  document.addEventListener("keyup", function (e) { keys[e.code] = false; });

  document.addEventListener("mousemove", function (e) {
    if (isTyping()) return;
    if (locked && document.pointerLockElement === canvas) {
      yaw -= e.movementX * SENS;
      pitch -= e.movementY * SENS;
    } else if (dragging) {
      yaw -= (e.clientX - lastMouse.x) * SENS * 1.5;
      pitch -= (e.clientY - lastMouse.y) * SENS * 1.5;
    }
    lastMouse.x = e.clientX; lastMouse.y = e.clientY;
    pitch = Math.max(-1.42, Math.min(1.42, pitch));
  });
  canvas.addEventListener("mousedown", function (e) {
    if (e.button !== 0 || locked || isTyping()) return;
    dragging = true; lastMouse.x = e.clientX; lastMouse.y = e.clientY;
  });
  document.addEventListener("mouseup", function () { dragging = false; });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  document.addEventListener("pointerlockchange", function () {
    locked = (document.pointerLockElement === canvas);
    if (locked) {
      paused = false;
      document.getElementById("screen-pause").classList.add("hidden");
      document.getElementById("hud").classList.remove("hidden");
      A.resume();
    } else {
      dragging = false;
      if (UI.isModalOpen()) return;                 // 弹窗自己接管
      if (started && !paused) {
        paused = true;
        document.getElementById("screen-pause").classList.remove("hidden");
      }
    }
  });
  document.addEventListener("pointerlockerror", function () {
    UI.toast("鼠标锁定不可用 · <b>按住鼠标左键拖动</b> 即可转动视角", "violet", 5000);
  });

  /* ---------------- 按钮 ---------------- */
  document.getElementById("btn-start").onclick = function () {
    A.init(); A.resume(); A.play("ui");
    started = true; UI.state.started = true;
    document.getElementById("screen-start").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
    window.YH.lock();
    setTimeout(function () {
      UI.toast("<b>行动开始</b> · 靠近发光补给箱按 F 搜索；紫色光柱即「渡鸦」灯", "good", 5200);
      UI.toast("提示：按 <b>ESC</b> 可暂停；鼠标未锁定时按住左键拖动视角", "", 5200);
    }, 700);
  };
  document.getElementById("btn-resume").onclick = function () { A.play("ui"); window.YH.lock(); };

  /* ---------------- 碰撞 ---------------- */
  const PR = 0.46;
  function resolveCollision(p) {
    const lim = world.arena - 1.1;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(lim, p.z));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < world.colliders.length; i++) {
        const c = world.colliders[i];
        const minX = c.x - c.w / 2 - PR, maxX = c.x + c.w / 2 + PR;
        const minZ = c.z - c.d / 2 - PR, maxZ = c.z + c.d / 2 + PR;
        if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) {
          const dl = p.x - minX, dr = maxX - p.x, dn = p.z - minZ, df = maxZ - p.z;
          const m = Math.min(dl, dr, dn, df);
          if (m === dl) p.x = minX; else if (m === dr) p.x = maxX;
          else if (m === dn) p.z = minZ; else p.z = maxZ;
        }
      }
    }
  }

  /* ---------------- 交互目标 ---------------- */
  function findTarget() {
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    let best = null, bestDot = 0.52;
    const cp = camera.position;
    for (let i = 0; i < world.interactables.length; i++) {
      const it = world.interactables[i];
      if (it.type === "crate" && !it.ready) continue;
      const dx = it.pos.x - cp.x, dz = it.pos.z - cp.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > it.radius || dist < 0.001) continue;
      const dot = (dx * fwd.x + dz * fwd.z) / dist;
      if (dot > bestDot) { bestDot = dot; best = it; }
    }
    return best;
  }

  const promptEl = document.getElementById("prompt");
  const chEl = document.getElementById("crosshair");
  function updatePrompt(cp) {
    if (!target || UI.isModalOpen() || searching) {
      promptEl.classList.add("hidden"); chEl.classList.remove("active");
      return;
    }
    const d = Math.sqrt((target.pos.x - cp.x) ** 2 + (target.pos.z - cp.z) ** 2);
    promptEl.classList.remove("hidden");
    chEl.classList.add("active");
    promptEl.classList.toggle("raven", target.type === "raven");
    document.getElementById("prompt-title").textContent = target.type === "crate" ? "搜索补给箱 " + target.id : "与「渡鸦」灯交互";
    document.getElementById("prompt-sub").textContent = target.type === "crate" ? "按 F 破解四级词汇 · 获取金币" : "按 F 投入金币 · 开启随机倍率赌局";
    document.getElementById("prompt-range").textContent = d.toFixed(1) + "m";
  }

  /* ---------------- 主循环 ---------------- */
  const clock = new T.Clock();
  let frame = 0;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.06);
    const t = clock.elapsedTime;
    const cp = camera.position;

    // 移动（仅在开始且未在弹窗中）
    if (started && !UI.isModalOpen() && !paused) {
      const sprint = !!(keys.ShiftLeft || keys.ShiftRight);
      const speed = sprint ? 8.4 : 4.7;
      fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      desired.set(0, 0, 0);
      if (keys.KeyW || keys.ArrowUp) desired.add(fwd);
      if (keys.KeyS || keys.ArrowDown) desired.sub(fwd);
      if (keys.KeyD) desired.add(right);
      if (keys.KeyA) desired.sub(right);
      if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(speed);
      velocity.lerp(desired, 1 - Math.exp(-dt * 11));
      cp.x += velocity.x * dt; cp.z += velocity.z * dt;
      resolveCollision(cp);
      bob += dt * (sprint ? 13 : 9) * Math.min(1, velocity.length() / 4);
      const moving = velocity.length() > 0.4;
      cp.y = 1.65 + (moving ? Math.sin(bob) * 0.035 : 0);
      sprintAmt += ((sprint && moving ? 1 : 0) - sprintAmt) * Math.min(1, dt * 5);
      const fov = 72 + sprintAmt * 7;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    } else {
      velocity.lerp(desired.set(0, 0, 0), 1 - Math.exp(-dt * 8));
    }

    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // 搜索进度
    if (searching) {
      searching.t += dt;
      const p = Math.min(1, searching.t / searching.dur);
      UI.showSearch(p);
      if (p >= 1) {
        const cr = searching.crate;
        searching = null;
        UI.hideSearch();
        world.consumeCrate(cr, 18);
        UI.openCrate(cr, world);
      }
    }

    // 交互目标
    if (started && !UI.isModalOpen() && !paused && !searching) {
      const nt = findTarget();
      if (nt !== target) {
        target = nt;
        world.setTarget(nt);
        if (nt) A.play("beacon");
        if (!nt) { promptEl.classList.add("hidden"); chEl.classList.remove("active"); }
      }
      updatePrompt(cp);
    } else {
      if (target) { target = null; world.setTarget(null); }
      promptEl.classList.add("hidden"); chEl.classList.remove("active");
    }

    world.update(dt, t, cp);
    if ((frame++ & 3) === 0) UI.drawMinimap(cp, yaw, world);
    renderer.render(scene, camera);
  }

  /* ---------------- 自适应 ---------------- */
  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  UI.init();
  animate();
})();
