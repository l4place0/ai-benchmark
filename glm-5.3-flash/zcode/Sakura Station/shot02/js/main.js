/* ============================================================
 * main.js — 场景组装 / 机位 / 动画循环
 * ============================================================ */
"use strict";

/* ---------- 组装场景 ---------- */
buildAllBuildings();
buildAllStreet();
buildAllNature();
const train = buildTrain();
buildPeople();
/* 所有模块都把线缆点收集进 WireBank，最后统一构建 */
WireBank.build(scene, 0x3a3742);

/* ---------- 机位预设 ---------- */
const VIEWS = {
  1: { pos: [13, 6.8, 26], look: [-9, 2.8, -13.5] },        // 站前大桥（默认，主街引导线直抵车站）
  2: { pos: [5.2, 2.9, -15.0], look: [-27, 2.1, -17.2] },   // 站台
  3: { pos: [13.9, 1.85, -10.2], look: [9.0, 2.2, -26.5] }, // 道口
};
rig.flyTo(VIEWS[1].pos, VIEWS[1].look);

document.querySelectorAll("#views button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = VIEWS[btn.dataset.v];
    if (v) rig.flyTo(v.pos, v.look);
  });
});
window.addEventListener("keydown", (e) => {
  const map = { Digit1: 1, Digit2: 2, Digit3: 3, Numpad1: 1, Numpad2: 2, Numpad3: 3 };
  const v = map[e.code];
  if (v && VIEWS[v]) rig.flyTo(VIEWS[v].pos, VIEWS[v].look);
});

/* ---------- 动画循环 ---------- */
const clock = new THREE.Clock();
let elapsed = 0;
let _readyShown = false;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  rig.update(dt);
  Nature.update(dt, elapsed);

  // 道口警示灯交替闪烁
  const phase = Math.sin(elapsed * 5.2) > 0;
  for (let i = 0; i < _crossLamps.length; i++) {
    _crossLamps[i].emissiveIntensity = ((i % 2 === 0) === phase) ? 1.7 : 0.04;
  }
  // 云缓慢漂移
  for (const c of _clouds) {
    c.position.x += dt * 0.4 * c.userData.spd;
    if (c.position.x > 250) c.position.x = -250;
  }
  // 电车停站时的轻微起伏
  train.position.y = Math.sin(elapsed * 0.85) * 0.008;
  train.position.z = L.RAIL1 + Math.sin(elapsed * 0.5) * 0.004;
  // 旗帜轻摆
  for (let i = 0; i < _wavingFlags.length; i++) {
    const f = _wavingFlags[i];
    const base = i === 0 ? Math.PI / 2 : Math.PI / 2.3;
    f.rotation.y = base + Math.sin(elapsed * 1.8 + i * 2.1) * 0.09;
  }

  renderer.render(scene, camera);

  if (!_readyShown) {
    _readyShown = true;
    document.getElementById("loader").classList.add("done");
    const tc = document.getElementById("titlecard");
    const hint = document.getElementById("hint");
    const views = document.getElementById("views");
    setTimeout(() => { tc.style.opacity = "1"; tc.style.transform = "none"; }, 400);
    setTimeout(() => { hint.style.opacity = "1"; }, 1600);
    setTimeout(() => { views.style.opacity = "1"; }, 2200);
  }
}
tick();
