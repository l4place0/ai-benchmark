/* 线之屋 · 电灯开关（底板 + 拨杆：唯一负责昼↔夜 Engine.env.t 的物件） */
(function () {
  const B = RLR.B, E = RLR.E;

  function createSwitch(opts) {
    const o = {
      name: 'switch', label: '电灯开关', interactive: true,
      pivot: opts.pivot || [-2.585, 1.16, 0.30], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      night: false,

      build() {
        const F = o.faces;
        /* 底板：边框线 + 四角小螺钉（+x 面朝室内） */
        F.push(...B.box([0, 0, 0], [0.014, 0.135, 0.09], {
          face: (k, f) => {
            if (k !== 'px') return;
            f.stroke = 'edge';
            f.strokes = [{ pts: [
              [0.0075, -0.0595, -0.037], [0.0075, 0.0595, -0.037],
              [0.0075, 0.0595, 0.037], [0.0075, -0.0595, 0.037], [0.0075, -0.0595, -0.037]
            ], w: 'hair', alpha: 0.6 }];
            for (const sy of [-0.048, 0.048]) for (const sz of [-0.028, 0.028]) {
              f.strokes.push({ pts: [[0.0075, sy - 0.004, sz], [0.0075, sy + 0.004, sz]], w: 'hair', alpha: 0.7 });
              f.strokes.push({ pts: [[0.0075, sy, sz - 0.004], [0.0075, sy, sz + 0.004]], w: 'hair', alpha: 0.7 });
            }
          }
        }).faces);
        /* 拨杆：pivot 在底板面上，rest 位置 ∓0.55（昼下 / 夜上） */
        o.parts.nub = { pivot: [0.008, 0.02, 0], off: [0, 0, 0], roll: -0.55, scale: [1, 1, 1] };
        F.push(...B.box([0.008, 0.032, 0], [0.022, 0.05, 0.03], {
          part: 'nub',
          face: (k, f) => {
            if (k === 'px') f.strokes = [{ pts: [[0.019, 0.032, -0.012], [0.019, 0.032, 0.012]], w: 'hair', alpha: 0.7 }];
          }
        }).faces);
        o.hits.push({ c: [0, 0, 0], h: [0.035, 0.095, 0.075] });
      },

      onHover(on) {
        /* 预倾：朝将要拨动的方向多倾 0.09 */
        const rest = o.night ? 0.55 : -0.55;
        RLR.Engine.tw(o.parts.nub, 'roll', on ? rest + (o.night ? -0.09 : 0.09) : rest, 0.25, E.outQuad);
      },
      onPress(down) { o.parts.nub.scale = down ? [0.96, 0.96, 0.96] : [1, 1, 1]; },
      action() {
        o.night = !o.night;
        RLR.Engine.tw(RLR.Engine.env, 't', o.night ? 1 : 0, 1.9, E.inOutCubic);
        RLR.Engine.tw(o.parts.nub, 'roll', o.night ? 0.55 : -0.55, 0.5, E.outBack);
        RLR.Audio.play('snap');
        RLR.Engine.toast(o.night ? '夜色漫进房间…' : '天光回到纸上');
      }
    };
    return o;
  }

  RLR.createSwitch = createSwitch;
})();
