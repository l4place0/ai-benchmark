/* 线之屋 · 门（范例物件：展示 hover/press/action/补间/音效的完整模式） */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E;

  function createDoor(opts) {
    const o = {
      name: 'door', label: '门', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      open: false, knobTurn: 0,

      build() {
        const W = 0.90, H = 2.02, TH = 0.045;
        // 门叶：铰链在局部原点，向 -z 延伸
        const leaf = B.box([-TH / 2, H / 2, -W / 2], [TH, H, W], {
          face: (k, f) => {
            if (k === 'px' || k === 'nx') {
              f.stroke = 'edge';
              // 两块凹嵌门板
              const panels = [[0.18, 0.98, 0.16, 0.74], [1.14, 1.86, 0.16, 0.74]];
              for (const [y0, y1, z0, z1] of panels) {
                const xx = k === 'px' ? TH / 2 + 0.002 : -TH / 2 - 0.002;
                const inset = k === 'px' ? 1 : -1;
                f.strokes = f.strokes || [];
                f.strokes.push({ pts: [[xx, y0, -z1], [xx, y0, -z0], [xx, y1, -z0], [xx, y1, -z1], [xx, y0, -z1]], w: 'detail', alpha: 0.9 });
                f.strokes.push({ pts: [[xx + inset * 0.008, y0 + 0.008, -z1 + 0.008], [xx + inset * 0.008, y0 + 0.008, -z0 + 0.008], [xx + inset * 0.008, y1 - 0.008, -z0 + 0.008], [xx + inset * 0.008, y1 - 0.008, -z1 + 0.008], [xx + inset * 0.008, y0 + 0.008, -z1 + 0.008]], w: 'hair', alpha: 0.45 });
              }
            }
          }
        });
        o.faces.push(...leaf.faces);
        // 门锁上下销钉
        for (const hy of [0.28, H - 0.28]) {
          o.faces.push(...B.cyl([0, hy, -W + 0.05], 0.009, 0.03, { axis: 'z', seg: 8 }).faces);
        }
        // 把手（内外两只），part 'knob' 悬停时转动
        o.parts.knob = { pivot: [TH / 2 + 0.018, 1.0, -W + 0.09], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        o.faces.push(...B.cyl([TH / 2 + 0.03, 1.0, -W + 0.09], 0.024, 0.055, { axis: 'x', seg: 10, part: 'knob' }).faces);
        o.faces.push(...B.cyl([TH / 2 + 0.062, 1.0, -W + 0.09], 0.014, 0.045, { axis: 'x', seg: 8, part: 'knob' }).faces);
        o.faces.push(...B.cyl([-TH / 2 - 0.03, 1.0, -W + 0.09], 0.024, 0.055, { axis: 'x', seg: 10 }).faces);
        // 锁孔装饰
        o.strokes.push(B.stroke([[TH / 2 + 0.002, 0.88, -W + 0.09], [TH / 2 + 0.002, 0.82, -W + 0.09]], { w: 'detail', alpha: 0.8 }));

        o.hits.push({ c: [0, H / 2, -W / 2], h: [0.10, H / 2 + 0.03, W / 2 + 0.03] });
      },

      onHover(on) {
        RLR.Engine.tw(o.parts.knob, 'roll', on ? 0.7 : 0, 0.45, E.outBack);
      },
      onPress(down) {
        if (down) o.knobTurn = 1;
      },
      action() {
        o.open = !o.open;
        RLR.Audio.play('latch');
        RLR.Engine.delay(() => {
          RLR.Audio.play('creak', { dur: o.open ? 0.9 : 0.65 });
          RLR.Engine.tw(o, 'yaw', o.open ? -1.83 : 0, o.open ? 1.15 : 0.95,
            o.open ? E.inOutCubic : E.outCubic,
            () => { if (!o.open) RLR.Audio.play('thud', { pitch: 0.75 }); });
        }, 0.14);
      },

      update(dt, t) {
        // 把手被按下时的小转动
        if (o.knobTurn > 0) {
          o.knobTurn = Math.max(0, o.knobTurn - dt * 2.4);
          o.parts.knob.pitch = Math.sin(o.knobTurn * Math.PI) * 0.35;
        }
      }
    };
    return o;
  }

  RLR.createDoor = createDoor;
})();
