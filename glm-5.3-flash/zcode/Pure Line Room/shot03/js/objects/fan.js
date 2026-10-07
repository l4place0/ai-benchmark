/* 线之屋 · 吊扇（吸顶盘 + 电机罩 + 四叶桨：三档循环变速） */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E;
  const SPEEDS = [0, 3.2, 7.5];

  function createFan(opts) {
    const o = {
      name: 'fan', label: '吊扇', interactive: true,
      pivot: opts.pivot || [0, 3.02, 0.35], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      level: 0, omega: 0, msink: 0, btilt: 0, pressK: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 吸顶盘 + 短杆 */
        F.push(B.disc([0, -0.004, 0], 0.055, { axis: 'y' }));
        F.push(...B.cyl([0, -0.08, 0], 0.012, 0.16, { seg: 8 }).faces);
        /* 电机罩（part 'motor'：悬停下沉 / 运转微摆）+ 散热槽 + 底沿 */
        o.parts.motor = { pivot: [0, 0, 0], off: [0, 0, 0], roll: 0 };
        F.push(...B.box([0, -0.20, 0], [0.15, 0.11, 0.15], {
          part: 'motor',
          face: (k, f) => {
            if (k === 'pz' || k === 'nz') {
              const z = k === 'pz' ? 0.0755 : -0.0755;
              f.strokes = [
                { pts: [[-0.05, -0.175, z], [0.05, -0.175, z]], w: 'hair', alpha: 0.5 },
                { pts: [[-0.05, -0.215, z], [0.05, -0.215, z]], w: 'hair', alpha: 0.5 }
              ];
            }
          }
        }).faces);
        F.push(B.disc([0, -0.255, 0], 0.055, { axis: 'y', part: 'motor' }));
        /* 桨叶组（part 'blades' 绕 [0,-0.26,0] 自转） */
        o.parts.blades = { pivot: [0, -0.26, 0], off: [0, 0, 0], yaw: 0, pitch: 0 };
        F.push(B.disc([0, -0.26, 0], 0.045, { axis: 'y', part: 'blades' }));   /* 毂 */
        F.push(B.disc([0, -0.274, 0], 0.02, { axis: 'y', part: 'blades' }));   /* 毂帽 */
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
          const dir = [c, s], P = (r, w, dy) => [dir[0] * r - s * w, -0.26 + dy, s * r + c * w];
          /* 长条桨叶：外端顶点沿法向(+y)偏移 0.036 做出 ~8° 攻角扭转感 */
          F.push(B.face([P(0.06, -0.065, 0), P(0.06, 0.065, 0), P(0.58, 0.065, 0.036), P(0.58, -0.065, 0.036)],
            { dbl: true, fill: 'auto', stroke: 'edge', part: 'blades' }));
          /* 叶根短架到毂 */
          S.push(B.stroke([P(0.04, 0, 0), P(0.06, -0.065, 0)], { w: 'hair', alpha: 0.7, part: 'blades' }));
          S.push(B.stroke([P(0.04, 0, 0), P(0.06, 0.065, 0)], { w: 'hair', alpha: 0.7, part: 'blades' }));
        }
        o.hits.push({ c: [0, -0.26, 0], h: [0.62, 0.07, 0.62] });
        o.hits.push({ c: [0, -0.13, 0], h: [0.1, 0.12, 0.1] });
      },

      onHover(on) {
        /* 悬停：电机罩下沉 0.004 + 桨叶微倾 */
        RLR.Engine.tw(o, 'msink', on ? 0.004 : 0, 0.3, E.outQuad);
        RLR.Engine.tw(o, 'btilt', on ? 0.05 : 0, 0.45, E.outBack);
      },
      onPress(down) { RLR.Engine.tw(o, 'pressK', down ? 1 : 0, 0.15, E.outQuad); },
      action() {
        o.level = (o.level + 1) % 3;               /* off → low → high → off */
        RLR.Audio.play('click');
        RLR.Audio.fan([0, 0.45, 1][o.level]);
      },

      update(dt, t) {
        /* 手写趋近：最大 ±4 rad/s² 加减速 */
        const d = SPEEDS[o.level] - o.omega;
        o.omega += M.clamp(d, -4 * dt, 4 * dt);
        o.parts.blades.yaw += o.omega * dt;
        o.parts.blades.pitch = o.btilt + o.pressK * 0.012;
        o.parts.motor.off[1] = -(o.msink + o.pressK * 0.004);
        o.parts.motor.roll = 0.004 * Math.sin(t * 2.2) * (o.omega / 7.5);
      }
    };
    return o;
  }

  RLR.createFan = createFan;
})();
