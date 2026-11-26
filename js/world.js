/* 杨昊行动 — 3D 战场构建 */
(function () {
  const T = window.THREE;
  const ARENA = 30;          // 场地半宽
  const SPAWN = { x: 0, z: 20 };
  const RAVEN_POS = { x: -6, z: -20 };

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function toTex(c, rx, ry, srgb) {
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (rx) t.repeat.set(rx, ry || rx);
    t.anisotropy = 4;
    if (srgb !== false) t.encoding = T.sRGBEncoding;
    return t;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- 程序化贴图 ---------- */
  function groundTexture() {
    const c = canvas(512, 512), g = c.getContext("2d");
    g.fillStyle = "#333b43"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = Math.random() * 34 | 0;
      g.fillStyle = "rgba(" + (v + 32) + "," + (v + 38) + "," + (v + 44) + ",.5)";
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // 混凝土板缝
    g.strokeStyle = "rgba(12,18,24,.55)"; g.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.strokeStyle = "rgba(255,255,255,.035)"; g.lineWidth = 1;
    for (let i = 0; i <= 512; i += 128) {
      g.beginPath(); g.moveTo(i + 3, 0); g.lineTo(i + 3, 512); g.stroke();
    }
    // 斑驳油渍
    for (let i = 0; i < 26; i++) {
      g.fillStyle = "rgba(8,14,18,.16)";
      g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 512, rnd(14, 60), rnd(8, 34), Math.random() * 6, 0, 7); g.fill();
    }
    return toTex(c, 14, 14);
  }

  function concreteTexture() {
    const c = canvas(256, 256), g = c.getContext("2d");
    g.fillStyle = "#5a636b"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3500; i++) {
      const v = Math.random() * 55 | 0;
      g.fillStyle = "rgba(" + (v + 40) + "," + (v + 46) + "," + (v + 52) + ",.45)";
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    g.strokeStyle = "rgba(15,20,26,.5)"; g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 252);
    g.fillStyle = "rgba(255,180,60,.18)";
    for (let i = 0; i < 5; i++) g.fillRect(20 + i * 48, 226, 26, 8);
    return toTex(c, 1, 1);
  }

  function containerTexture(hex) {
    const c = canvas(256, 256), g = c.getContext("2d");
    g.fillStyle = hex; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(x, 0, 5, 256);
      g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x + 6, 0, 3, 256);
    }
    g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, 0, 256, 12); g.fillRect(0, 244, 256, 12);
    g.fillStyle = "rgba(220,225,230,.28)"; g.font = "bold 22px monospace";
    g.fillText("YH-OPS  //  CARGO", 18, 132);
    g.font = "13px monospace"; g.fillStyle = "rgba(220,225,230,.2)";
    g.fillText("CONTAINER · CET-4 SUPPLY DIVISION", 18, 156);
    // 锈迹
    for (let i = 0; i < 40; i++) {
      g.fillStyle = "rgba(90,50,20,.1)";
      g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, rnd(3, 16), rnd(2, 8), 0, 0, 7); g.fill();
    }
    return toTex(c, 2, 1);
  }

  function crateTexture() {
    const c = canvas(256, 256), g = c.getContext("2d");
    g.fillStyle = "#6b5a3e"; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(0, y, 256, 3);
      g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(0, y + 3, 256, 2);
    }
    for (let x = 0; x < 256; x += 64) { g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, 0, 4, 256); }
    g.strokeStyle = "rgba(24,26,24,.65)"; g.lineWidth = 8; g.strokeRect(9, 9, 238, 238);
    g.fillStyle = "rgba(255,171,61,.85)";
    g.fillRect(0, 0, 256, 12); g.fillRect(0, 244, 256, 12);
    g.fillStyle = "rgba(20,24,26,.9)"; g.font = "bold 30px monospace";
    g.fillText("SUPPLY", 62, 122);
    g.font = "bold 17px sans-serif"; g.fillText("情报补给 · CET-4", 55, 150);
    g.font = "12px monospace"; g.fillStyle = "rgba(20,24,26,.65)";
    g.fillText("// SEARCH & DECRYPT", 47, 174);
    // 铆钉
    g.fillStyle = "rgba(220,220,210,.5)";
    [[18, 18], [238, 18], [18, 238], [238, 238]].forEach(function (p) {
      g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fill();
    });
    return toTex(c, 1, 1);
  }

  function labelTexture(text, color, bg) {
    const c = canvas(320, 80), g = c.getContext("2d");
    g.clearRect(0, 0, 320, 80);
    g.fillStyle = bg || "rgba(6,12,18,.82)";
    g.fillRect(0, 8, 320, 56);
    g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(1, 9, 318, 54);
    g.fillStyle = color; g.fillRect(0, 8, 7, 56);
    g.font = "bold 27px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = color; g.shadowBlur = 12;
    g.fillText(text, 164, 37);
    return toTex(c, 1, 1, false);
  }

  function ravenTexture() {
    const c = canvas(256, 256), g = c.getContext("2d");
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "#1a1030";
    g.beginPath(); g.arc(128, 128, 116, 0, 7); g.fill();
    g.strokeStyle = "#b57bff"; g.lineWidth = 5;
    g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.fillStyle = "#d9b6ff"; g.shadowColor = "#b57bff"; g.shadowBlur = 22;
    // 渡鸦剪影：身体
    g.beginPath(); g.ellipse(116, 158, 50, 34, -0.35, 0, 7); g.fill();
    // 头
    g.beginPath(); g.arc(157, 105, 28, 0, 7); g.fill();
    // 喙
    g.beginPath(); g.moveTo(181, 96); g.lineTo(231, 108); g.lineTo(181, 118); g.closePath(); g.fill();
    // 翅膀
    g.beginPath(); g.moveTo(112, 136); g.quadraticCurveTo(52, 88, 38, 132);
    g.quadraticCurveTo(66, 128, 84, 166); g.quadraticCurveTo(96, 150, 112, 136); g.closePath(); g.fill();
    // 尾羽
    g.beginPath(); g.moveTo(80, 176); g.lineTo(30, 208); g.lineTo(94, 194); g.closePath(); g.fill();
    // 眼睛
    g.shadowBlur = 0; g.fillStyle = "#1a1030";
    g.beginPath(); g.arc(166, 99, 5, 0, 7); g.fill();
    return toTex(c, 1, 1, false);
  }

  function glowTexture() {
    const c = canvas(128, 128), g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.22, "rgba(255,255,255,.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return toTex(c, 1, 1, false);
  }

  /* ---------- 构建 ---------- */
  function build(scene, camera) {
    const colliders = [];
    const crates = [];
    const animated = [];
    const glowTex = glowTexture();

    scene.background = new T.Color(0x070d14);
    scene.fog = new T.FogExp2(0x080f18, 0.0175);

    /* 光照 */
    scene.add(new T.HemisphereLight(0x5a7ea6, 0x0e141a, 0.58));
    scene.add(new T.AmbientLight(0x22303d, 0.3));
    const moon = new T.DirectionalLight(0x9dbde2, 0.62);
    moon.position.set(26, 44, 18);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -46; moon.shadow.camera.right = 46;
    moon.shadow.camera.top = 46; moon.shadow.camera.bottom = -46;
    moon.shadow.camera.near = 1; moon.shadow.camera.far = 110;
    moon.shadow.bias = -0.0006;
    scene.add(moon);

    /* 星空 + 月亮 */
    const starGeo = new T.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 550; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.42;
      const r = 130;
      sp.push(Math.cos(th) * Math.sin(ph + 0.25) * r, Math.cos(ph + 0.25) * r + 12, Math.sin(th) * Math.sin(ph + 0.25) * r);
    }
    starGeo.setAttribute("position", new T.Float32BufferAttribute(sp, 3));
    scene.add(new T.Points(starGeo, new T.PointsMaterial({ color: 0xbcd6f2, size: 1.1, transparent: true, opacity: 0.75, sizeAttenuation: false, depthWrite: false, fog: false })));
    const moonBall = new T.Mesh(new T.SphereGeometry(5, 24, 16), new T.MeshBasicMaterial({ color: 0xdce9f7, fog: false }));
    moonBall.position.set(62, 62, -95); scene.add(moonBall);
    const moonGlow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x9fc4ee, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    moonGlow.scale.set(38, 38, 1); moonGlow.position.copy(moonBall.position); scene.add(moonGlow);

    /* 地面 */
    const ground = new T.Mesh(
      new T.PlaneGeometry(160, 160),
      new T.MeshStandardMaterial({ map: groundTexture(), roughness: 0.96, metalness: 0.04 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    const concrete = concreteTexture();
    const wallMat = new T.MeshStandardMaterial({ map: concrete, roughness: 0.9, metalness: 0.05, color: 0x9aa5ae });
    function addWall(x, z, w, d) {
      const m = new T.Mesh(new T.BoxGeometry(w, 4.2, d), wallMat);
      m.position.set(x, 2.1, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      // 顶部警示条
      const stripe = new T.Mesh(new T.BoxGeometry(w, 0.16, d + 0.02), new T.MeshStandardMaterial({ color: 0xffab3d, emissive: 0xff8a10, emissiveIntensity: 0.35, roughness: 0.6 }));
      stripe.position.set(x, 4.22, z); scene.add(stripe);
      colliders.push({ x: x, z: z, w: w, d: d });
    }
    addWall(0, -ARENA, 62, 1.2); addWall(0, ARENA, 62, 1.2);
    addWall(-ARENA, 0, 1.2, 62); addWall(ARENA, 0, 1.2, 62);

    /* 集装箱 */
    const containerDefs = [
      [-24, 16, 0, "#2c4a4e"], [24, 20, Math.PI / 2, "#6b3a2a"],
      [-25, -12, Math.PI / 2, "#2e3a55"], [23, -21, 0, "#4a5138"],
      [0, -27.5, 0, "#5a3a2c"], [-13, 26, Math.PI / 2, "#3d4750"],
      [14, 27, 0, "#2c4a4e"]
    ];
    containerDefs.forEach(function (d) {
      const mesh = new T.Mesh(
        new T.BoxGeometry(9, 3.2, 3.2),
        new T.MeshStandardMaterial({ map: containerTexture(d[3]), roughness: 0.82, metalness: 0.28 })
      );
      mesh.position.set(d[0], 1.6, d[1]); mesh.rotation.y = d[2];
      mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
      const rot = Math.abs(Math.sin(d[2])) > 0.5;
      colliders.push({ x: d[0], z: d[1], w: rot ? 3.2 : 9, d: rot ? 9 : 3.2 });
    });

    /* 油桶 */
    const barrelMat = [
      new T.MeshStandardMaterial({ color: 0x9a5a26, roughness: 0.75, metalness: 0.35 }),
      new T.MeshStandardMaterial({ color: 0x3f5a4a, roughness: 0.75, metalness: 0.35 }),
      new T.MeshStandardMaterial({ color: 0x4a5566, roughness: 0.75, metalness: 0.35 })
    ];
    const barrelSpots = [[-4, 17], [5, 19], [11, 12], [-13, 14], [-16, 2], [17, -1], [10, -10], [-12, -6], [3, -14], [20, 8], [-21, 19], [22, -12], [-3, 8], [6, -27], [15, -24]];
    barrelSpots.forEach(function (p, i) {
      const b = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 1.15, 14), barrelMat[i % 3]);
      b.position.set(p[0], 0.575, p[1]); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      const band = new T.Mesh(new T.CylinderGeometry(0.475, 0.475, 0.1, 14), new T.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.8 }));
      band.position.set(p[0], 0.86, p[1]); scene.add(band);
      colliders.push({ x: p[0], z: p[1], w: 1, d: 1 });
    });

    /* 探照灯杆 */
    const poleMat = new T.MeshStandardMaterial({ color: 0x39434d, roughness: 0.7, metalness: 0.6 });
    const lampMat = new T.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb055, emissiveIntensity: 1.5, roughness: 0.4 });
    [[-25, -25], [25, -25], [-25, 25], [25, 25], [0, -26], [0, 26]].forEach(function (p) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.12, 0.18, 6.4, 8), poleMat);
      pole.position.set(p[0], 3.2, p[1]); pole.castShadow = true; scene.add(pole);
      const head = new T.Mesh(new T.BoxGeometry(1.1, 0.35, 0.6), lampMat);
      head.position.set(p[0], 6.45, p[1]); scene.add(head);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffb055, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false }));
      glow.scale.set(3.2, 3.2, 1); glow.position.set(p[0], 6.45, p[1]); scene.add(glow);
      const pl = new T.PointLight(0xffb265, 1.35, 30, 1.9);
      pl.position.set(p[0], 6.2, p[1]); scene.add(pl);
      colliders.push({ x: p[0], z: p[1], w: 0.5, d: 0.5 });
    });

    /* 地面战术标线 */
    const lineMat = new T.MeshBasicMaterial({ color: 0xffab3d, transparent: true, opacity: 0.22, side: T.DoubleSide });
    for (let i = -1; i <= 1; i++) {
      const ln = new T.Mesh(new T.PlaneGeometry(0.14, 46), lineMat);
      ln.rotation.x = -Math.PI / 2; ln.position.set(i * 9, 0.02, 0); scene.add(ln);
    }

    /* 补给箱 */
    const crateTex = crateTexture();
    const cratePositions = [
      [7, 15], [-8, 12], [16, 6], [-19, 8], [20, -6], [4, -6], [-9, -11],
      [12, -16], [-3, 21], [21, 14], [-23, -5], [8, -24], [-17, -17], [2, 2]
    ];
    cratePositions.forEach(function (p, i) {
      const g = new T.Group(); g.position.set(p[0], 0, p[1]);
      g.rotation.y = rnd(-0.4, 0.4);
      scene.add(g);

      const body = new T.Mesh(new T.BoxGeometry(1.5, 1.25, 1.5), new T.MeshStandardMaterial({ map: crateTex, roughness: 0.85, metalness: 0.12 }));
      body.position.y = 0.625; body.castShadow = true; body.receiveShadow = true; g.add(body);

      // 四角金属包边
      const edgeMat = new T.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.6, metalness: 0.7 });
      [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]].forEach(function (e) {
        const bar = new T.Mesh(new T.BoxGeometry(0.09, 1.3, 0.09), edgeMat);
        bar.position.set(e[0], 0.65, e[1]); g.add(bar);
      });
      // 顶部发光条
      const strip = new T.Mesh(new T.BoxGeometry(1.2, 0.045, 0.13), new T.MeshStandardMaterial({ color: 0xffab3d, emissive: 0xff9500, emissiveIntensity: 1.2 }));
      strip.position.set(0, 1.27, 0.45); g.add(strip);
      const strip2 = strip.clone(); strip2.position.z = -0.45; g.add(strip2);

      // 地面光环
      const ring = new T.Mesh(new T.RingGeometry(1.15, 1.32, 32), new T.MeshBasicMaterial({ color: 0xffab3d, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);

      // 悬浮信标
      const beacon = new T.Mesh(new T.OctahedronGeometry(0.2), new T.MeshBasicMaterial({ color: 0xffa62e }));
      beacon.position.y = 2.15; g.add(beacon);
      const bGlow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffab3d, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
      bGlow.scale.set(0.9, 0.9, 1); bGlow.position.y = 2.15; g.add(bGlow);

      const label = new T.Sprite(new T.SpriteMaterial({ map: labelTexture("◈ 情报补给", "#ffab3d"), transparent: true, depthWrite: false }));
      label.scale.set(2.0, 0.5, 1); label.position.y = 2.7; g.add(label);

      const crate = {
        id: "#" + String.fromCharCode(65 + (i % 6)) + "-" + String(i + 1).padStart(2, "0"),
        type: "crate", index: i, group: g, beacon: beacon, glow: bGlow, ring: ring, strip: strip, strip2: strip2, label: label,
        pos: new T.Vector3(p[0], 1.1, p[1]), radius: 3.5,
        cooldown: 0, ready: true, targeted: false, labelBase: 1
      };
      crates.push(crate);
      colliders.push({ x: p[0], z: p[1], w: 1.6, d: 1.6 });
    });

    /* ============ 渡鸦灯 ============ */
    const rg = new T.Group(); rg.position.set(RAVEN_POS.x, 0, RAVEN_POS.z); scene.add(rg);
    const darkMetal = new T.MeshStandardMaterial({ color: 0x23202e, roughness: 0.55, metalness: 0.75 });
    const violetEmissive = new T.MeshStandardMaterial({ color: 0xb57bff, emissive: 0x8a45e8, emissiveIntensity: 2.4, roughness: 0.35 });

    const base = new T.Mesh(new T.CylinderGeometry(0.95, 1.15, 0.35, 12), darkMetal);
    base.position.y = 0.175; base.castShadow = true; rg.add(base);
    const post = new T.Mesh(new T.CylinderGeometry(0.14, 0.2, 3.1, 12), darkMetal);
    post.position.y = 1.75; post.castShadow = true; rg.add(post);
    // 灯笼框架
    const lantern = new T.Mesh(new T.BoxGeometry(1.35, 1.35, 1.35), new T.MeshStandardMaterial({ color: 0x181426, transparent: true, opacity: 0.55, roughness: 0.4, metalness: 0.6 }));
    lantern.position.y = 3.85; rg.add(lantern);
    const core = new T.Mesh(new T.OctahedronGeometry(0.42), violetEmissive);
    core.position.y = 3.85; rg.add(core);
    // 框架棱
    const edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.35, 1.35, 1.35)), new T.LineBasicMaterial({ color: 0xc9a2ff }));
    edges.position.y = 3.85; rg.add(edges);
    // 渡鸦徽记（四个面）
    const ravenTex = ravenTexture();
    for (let k = 0; k < 4; k++) {
      const face = new T.Mesh(new T.PlaneGeometry(1.15, 1.15), new T.MeshBasicMaterial({ map: ravenTex, transparent: true, side: T.DoubleSide, depthWrite: false }));
      const a = k * Math.PI / 2;
      face.position.set(Math.sin(a) * 0.69, 3.85, Math.cos(a) * 0.69);
      face.rotation.y = a; rg.add(face);
    }
    // 顶盖
    const cap = new T.Mesh(new T.ConeGeometry(1.05, 0.55, 4), darkMetal);
    cap.position.y = 4.82; cap.rotation.y = Math.PI / 4; rg.add(cap);
    // 旋转光环
    const halo = new T.Mesh(new T.TorusGeometry(1.35, 0.045, 8, 48), new T.MeshBasicMaterial({ color: 0xc08aff, transparent: true, opacity: 0.85 }));
    halo.position.y = 3.85; halo.rotation.x = Math.PI / 2.4; rg.add(halo);
    const halo2 = new T.Mesh(new T.TorusGeometry(1.65, 0.028, 8, 48), new T.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: 0.5 }));
    halo2.position.y = 3.85; halo2.rotation.x = Math.PI / 1.7; rg.add(halo2);
    // 竖直光柱
    const beam = new T.Mesh(new T.CylinderGeometry(0.28, 0.75, 16, 16, 1, true), new T.MeshBasicMaterial({ color: 0xa45cff, transparent: true, opacity: 0.11, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }));
    beam.position.y = 9.5; rg.add(beam);
    // 地面光环
    const rRing = new T.Mesh(new T.RingGeometry(1.7, 2.0, 48), new T.MeshBasicMaterial({ color: 0xb57bff, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
    rRing.rotation.x = -Math.PI / 2; rRing.position.y = 0.04; rg.add(rRing);
    const rGlow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xa45cff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    rGlow.scale.set(9, 9, 1); rGlow.position.y = 3.85; rg.add(rGlow);
    const rLight = new T.PointLight(0xa45cff, 2.6, 22, 1.8);
    rLight.position.set(RAVEN_POS.x, 4.2, RAVEN_POS.z); scene.add(rLight);
    const rLabel = new T.Sprite(new T.SpriteMaterial({ map: labelTexture("◆ 渡鸦 RAVEN", "#b57bff"), transparent: true, depthWrite: false }));
    rLabel.scale.set(2.6, 0.65, 1); rLabel.position.y = 5.9; rg.add(rLabel);

    const raven = {
      type: "raven", group: rg, core: core, halo: halo, halo2: halo2, beam: beam, ring: rRing, glow: rGlow, light: rLight, label: rLabel,
      pos: new T.Vector3(RAVEN_POS.x, 2.2, RAVEN_POS.z), radius: 4.2, targeted: false
    };
    colliders.push({ x: RAVEN_POS.x, z: RAVEN_POS.z, w: 1.5, d: 1.5 });

    /* 空中浮尘 */
    const dustGeo = new T.BufferGeometry(); const dp = [];
    for (let i = 0; i < 260; i++) dp.push(rnd(-ARENA, ARENA), rnd(0.5, 9), rnd(-ARENA, ARENA));
    dustGeo.setAttribute("position", new T.Float32BufferAttribute(dp, 3));
    const dust = new T.Points(dustGeo, new T.PointsMaterial({ color: 0xffd9a0, size: 0.06, transparent: true, opacity: 0.45, depthWrite: false }));
    scene.add(dust);

    /* 第一人称武器模型（无光照材质 + 描边，避免夜战强光把模型打亮） */
    const weapon = new T.Group();
    /* 渲染器启用了 sRGB 输出 + ACES，若直接给十六进制色会被二次提亮成灰白。
       这里统一转成 linear 并关闭 tone mapping，保证屏幕颜色 = 指定颜色。 */
    function matB(hex, opt) {
      const m = new T.MeshBasicMaterial(Object.assign({ color: hex, toneMapped: false }, opt || {}));
      m.color.convertSRGBToLinear();
      return m;
    }
    const wDark = matB(0x2e373f);
    const wAccent = matB(0x3a454e);
    const wGlove = matB(0x20262a);
    const wOrange = matB(0xff8a1a);
    const wEdge = new T.LineBasicMaterial({ color: 0x6a7883, transparent: true, opacity: 0.5, toneMapped: false });
    wEdge.color.convertSRGBToLinear();
    function wbox(w, h, d, mat, x, y, z, rx, rz, edge) {
      const geo = new T.BoxGeometry(w, h, d);
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (rz) m.rotation.z = rz;
      weapon.add(m);
      if (edge) {
        const e = new T.LineSegments(new T.EdgesGeometry(geo), wEdge);
        e.position.copy(m.position); e.rotation.copy(m.rotation);
        weapon.add(e);
      }
      return m;
    }
    wbox(0.13, 0.14, 0.70, wDark, 0, 0, -0.10, 0, 0, true);       // 机匣
    wbox(0.09, 0.09, 0.50, wAccent, 0, 0.005, -0.66, 0, 0, true); // 护木
    wbox(0.042, 0.042, 0.34, wDark, 0, 0.012, -1.03);              // 枪管
    wbox(0.07, 0.055, 0.08, wDark, 0, 0.014, -1.20);               // 消焰器
    wbox(0.032, 0.032, 0.032, wOrange, 0, 0.014, -1.235);          // 枪口光点
    wbox(0.09, 0.22, 0.14, wDark, 0, -0.155, 0.06, 0, 0.16);       // 握把
    wbox(0.10, 0.09, 0.36, wAccent, 0, -0.02, 0.36, 0, 0, true);   // 枪托
    wbox(0.08, 0.05, 0.22, wDark, 0, 0.10, -0.20);                 // 瞄具座
    wbox(0.04, 0.04, 0.04, wOrange, 0, 0.145, -0.20);              // 瞄具光点
    wbox(0.08, 0.18, 0.11, wDark, 0, -0.14, -0.34, 0.12, 0, true); // 弹匣
    wbox(0.05, 0.03, 0.34, wOrange, 0.055, 0.03, -0.34);           // 侧面战术橙条
    wbox(0.11, 0.11, 0.14, wGlove, -0.01, -0.13, -0.62);           // 前握手套
    wbox(0.10, 0.12, 0.12, wGlove, 0.005, -0.19, 0.05);            // 后握手套
    const WPOS = { x: 0.27, y: -0.29, z: -0.74 };
    weapon.position.set(WPOS.x, WPOS.y, WPOS.z);
    weapon.rotation.set(-0.012, 0.15, 0);
    weapon.scale.setScalar(0.56);
    camera.add(weapon);
    scene.add(camera);

    /* 交互物列表 */
    const interactables = crates.concat([raven]);

    /* 每帧更新 */
    function update(dt, t, playerPos) {
      crates.forEach(function (c, i) {
        if (c.cooldown > 0) {
          c.cooldown -= dt;
          if (c.cooldown <= 0) setCrateReady(c, true);
        }
        const bob = Math.sin(t * 2 + i * 0.9) * 0.12;
        c.beacon.position.y = 2.15 + bob;
        c.glow.position.y = 2.15 + bob;
        c.beacon.rotation.y += dt * 1.3;
        c.beacon.rotation.x += dt * 0.7;
        const s = c.targeted ? 1.55 : 1;
        c.beacon.scale.setScalar(s);
        c.glow.scale.setScalar(c.ready ? (c.targeted ? 2.1 : 1.5) : 0.7);
        c.ring.material.opacity = c.ready ? (c.targeted ? 0.9 : 0.45 + Math.sin(t * 2.2 + i) * 0.14) : 0.1;
        if (c.targeted) c.label.position.y = 2.78 + Math.sin(t * 6) * 0.05;
        else c.label.position.y = 2.7;
        // 贴近时隐藏标签，避免遮挡视野
        var ldx = playerPos.x - c.pos.x, ldz = playerPos.z - c.pos.z;
        var ld2 = ldx * ldx + ldz * ldz;
        var fade = ld2 < 36 ? Math.max(0, (ld2 - 12) / 24) : 1;
        c.label.material.opacity = (c.labelBase === undefined ? 1 : c.labelBase) * fade;
      });

      raven.core.rotation.y += dt * 0.9;
      raven.core.rotation.z = Math.sin(t * 1.2) * 0.15;
      raven.halo.rotation.z += dt * 0.55;
      raven.halo2.rotation.z -= dt * 0.35;
      raven.beam.material.opacity = 0.09 + Math.sin(t * 1.7) * 0.035;
      raven.light.intensity = 2.4 + Math.sin(t * 2.3) * 0.45;
      raven.ring.material.opacity = raven.targeted ? 0.9 : 0.45 + Math.sin(t * 2) * 0.14;
      raven.glow.scale.setScalar(raven.targeted ? 11 : 9);
      raven.label.position.y = 5.9 + Math.sin(t * 1.8) * 0.09;
      var rdx = playerPos.x - RAVEN_POS.x, rdz = playerPos.z - RAVEN_POS.z;
      var rd2 = rdx * rdx + rdz * rdz;
      raven.label.material.opacity = rd2 < 64 ? Math.max(0, (rd2 - 16) / 48) : 1;
      dust.rotation.y += dt * 0.008;
      weapon.position.y = WPOS.y + Math.sin(t * 8) * 0.006;
      weapon.rotation.z = Math.sin(t * 4) * 0.004;
    }

    function setCrateReady(c, ready) {
      c.ready = ready;
      const col = ready ? 0xffa62e : 0x4a5560;
      c.beacon.material.color.setHex(col);
      c.glow.material.color.setHex(ready ? 0xffab3d : 0x455060);
      c.ring.material.color.setHex(ready ? 0xffab3d : 0x455060);
      c.strip.material.emissiveIntensity = ready ? 1.2 : 0.12;
      c.strip2.material.emissiveIntensity = ready ? 1.2 : 0.12;
      c.labelBase = ready ? 1 : 0.32;
    }

    function setTarget(obj) {
      crates.forEach(function (c) { c.targeted = (c === obj); });
      raven.targeted = (obj === raven);
    }

    return {
      crates: crates, raven: raven, interactables: interactables,
      colliders: colliders, update: update, setCrateReady: setCrateReady, setTarget: setTarget,
      spawn: SPAWN, arena: ARENA, ravenPos: RAVEN_POS,
      consumeCrate: function (c, seconds) { c.cooldown = seconds || 18; setCrateReady(c, false); }
    };
  }

  window.YH_World = { build: build, ARENA: ARENA };
})();
