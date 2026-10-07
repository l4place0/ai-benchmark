# 纯线房间 Pure Line Room — 开发契约 (API.md)

> 本文档是所有协作者必须遵守的契约。写代码前请先阅读本文件，并完整阅读
> `js/math3d.js`、`js/engine.js`、`js/objects/door.js`、`js/objects/lamp.js`
> 这四个范例文件。door.js 与 lamp.js 是**权威范例**：仿照它们的写法。

## 0. 项目愿景

一件纯浏览器单机的互动艺术作品：一个白色纸面上、由黑色矢量线条描绘的
“线稿房间”。用户可以用鼠标旋转/缩放视角，点击、拖拽房间里的家具，
物件有自然的动画与合成音效反馈；墙面开关可切换昼/夜全局状态。

## 1. 硬性约束

- **零外部依赖**：禁止 CDN、外部字体、外部图片、外部音频、npm/pip 安装。
  全部代码为本地手写文件，断网可运行。
- **经典 script**：不是 ES Module。每个文件是 IIFE，挂载到全局
  `window.PLR` 命名空间上（见范例）。这样双击 `index.html`（file://）也能运行。
- **单位**：米。y 向上。房间内部尺寸：x ∈ [-3.2, +3.2]，z ∈ [-2.8, +2.8]，高 3.0。
  地板 y=0。相机默认在 +z 方向。
- **面朝向（重要！）**：`PLR.quad(mesh, [A,B,C,D], opts)` 中 A→B→C→D 必须
  **从面的正面看是逆时针 (CCW)**。引擎法线 = cross(B-A, C-A)，背面会被剔除。
  如果某个面看不见，90% 是绕向反了——用 `opts.doubleSided` 或调换顶点顺序。
- **不要硬编码颜色**。填充/线条使用语义 tint（见 §6）。
- **中文 label**。每个可交互物件必须有 `label`（和可选 `hint`），用于悬停提示。
- 只允许修改分配给你的文件。禁止启动浏览器测试（由主控统一做集成测试）。
- 提交前对你的每个文件执行 `node --check <file>` 确认语法（node 在 PATH 里）。

## 2. 场景图与几何构建 API（engine.js 提供）

```js
// 节点：有 pos/rot/scale 的变换节点，rot = [rx, ry, rz] 弧度
const root = PLR.node(PLR.root, { pos:[x,y,z], rot:[0,ry,0], scale:[1,1,1] });

// 网格：挂在节点上，顶点/面都在“节点局部空间”
const mesh = PLR.mesh(node);

// 四边形面（最常用）。corners = [[x,y,z]×4]（局部空间，CCW）
// opts:
//   tint: 'paper'|'floor'|'ceil'|'ink'|'accent'|'glow'|'dark'   默认 'paper'
//   alpha: 透明填充 (0..1)（如玻璃 0.12），默认不透明
//   doubleSided: true 从背面也能看到（门板、窗帘、玻璃等薄片用）
//   hatch: {dir:'a'|'b', count:N 或 gap:米, alpha, w}  排线（仅四边形）
//          dir 'a' = 平行于 AB 边的线族，'b' = 平行于 BC 边
//   details: [{pts:[[x,y,z]...], w, alpha, closed}]  附着细节线（随面遮挡）
//   lw: 线宽倍率（默认 1；细节结构线 0.8；重物轮廓 1.2）
//   noPick: true  不参与拾取（纯装饰）
//   bias: 排序偏移（+更靠后），一般不用
const f = PLR.quad(mesh, [A,B,C,D], { tint:'paper', hatch:{dir:'a',count:5,alpha:.3} });

// 给已有面追加细节线（局部空间点列）
PLR.detail(f, [[..],[..],..], { w:0.7, alpha:0.55, closed:true });

// 三角形面（少见）
PLR.tri(mesh, [A,B,C], opts);

// 正多边形面（圆盘）。plane:'xy'|'xz'|'yz'，r 半径，n 边数(默认18)
const disc = PLR.ngon(mesh, [cx,cy,cz], r, n, { plane:'xy', tint:'paper', doubleSided:true });

// 盒子：中心 pos + 尺寸 size，可 skip:['bottom','top','back','front','left','right']
PLR.box(mesh, { pos:[x,y,z], size:[w,h,d], skip:[], opts:{tint:'paper'} });

// 圆柱/圆台：轴 p0→p1，两端半径 r0/r1，n 边数；caps:{top:true,bottom:true}
PLR.cyl(mesh, { p0:[0,0,0], p1:[0,0.4,0], r0:0.08, r1:0.06, n:10,
                caps:{bottom:true}, sideOpts:{tint:'paper'}, capOpts:{tint:'paper'} });

// 球（经纬线框球，地球仪用）
PLR.sphere(mesh, { c:[x,y,z], r:0.2, nu:14, nv:8, opts:{tint:'paper'} });
```

要点：
- 顶点按坐标自动去重（1e-4 容差），共享边会自动建立邻接 → 引擎自动区分
  **轮廓线（粗）/内部结构线（细）/边界线（粗）**，无需手工指定。
- 一个面 = 任意多边形；`PLR.ngon` 生成一个单独的 n 边面。
- 细节线附着在面上，跟随该面的遮挡关系，不会穿透。
- 排线 hatch 只支持四边形面；`dir:'a'` 沿 A→B 方向的平行线族。
- 薄片物体（门板/窗帘/画布/玻璃）一律 `doubleSided:true`。

## 3. 物件注册协议

每个物件文件 `js/objects/<id>.js` 调用一次 `PLR.addObject(def)`：

```js
PLR.addObject({
  id: 'door',                 // 全局唯一
  label: '木门',               // 悬停提示（中文）
  hint: '点击开合',            // 可选：操作提示
  drag: null,                 // 或 'floor'：按住可沿地面拖动（椅子/茶几）
  build(ctx) {                // ctx 就是 PLR。在这里建节点/网格
    const inst = {};
    inst.root = PLR.node(PLR.root, { pos:[3.2, 0, -1.49] });
    const mesh = PLR.mesh(inst.root);
    ... 构建几何 ...
    inst.root._rotY = 0;      // 自定义运行时状态随便挂
    return inst;              // 必须返回 { root, ... }
  },
  update(dt, t, env) {        // 每帧调用（可选）。env 见 §7
    // 动画推进、持续动态（蒸汽、旋转、摆动…）
  },
  onClick() {},               // 点击（可选）
  onPress() {},               // 按下瞬间（可选，用于挤压反馈）
  onRelease() {},             // 松开（可选）
  onHover(h) {},              // 悬停进入/离开 h=true/false（可选）
  onDragMove(worldPt) {},     // drag:'floor' 时拖动中的世界坐标（可选）
  onDragEnd() {},             // 拖动结束（可选）
});
```

规则：
- `build` 返回的 inst 里保存你的一切状态；引擎把 def 和 inst 关联。
- 拾取：物件根节点下所有面默认可拾取；装饰性小零件传 `noPick:true`。
- 动画用 `PLR.tween`（见 §5），持续动态直接在 `update` 里推进。
- 音效一律通过 `PLR.sfx.play(name, {rate, gain, pan})`；名称表见 §8。
  环境耦合通过 `PLR.env` 读写（见 §7）。

## 4. 房间与既有物件（主控负责，不要重建）

主控已实现：地板（木纹排线）、四壁（带门洞/窗洞）、天花、踢脚线、
纸纹颗粒、相机、输入、悬停高亮、悬停提示牌、引导脉冲、昼夜主题、环境耦合、
以及两个示范物件：

- `door.js` 木门（右墙门洞 z -1.95..-1.03）：点击开合 + 铰链动画 + 吱呀声。
- `lamp.js` 台灯（书桌左侧）：点击开关，灯泡发光 + 环境暖光耦合。

**墙上洞口尺寸（必须吻合）**：
- 窗洞（后墙 z=-2.8）：x ∈ [-1.9, -0.3]，y ∈ [1.0, 2.4]
- 门洞（右墙 x=+3.2）：z ∈ [-1.95, -1.03]，y ∈ [0, 2.05]

## 5. 动画与工具函数

```js
PLR.tween({ dur:0.6, ease:'outCubic', update(k){...}, done(){...} }) // k∈[0,1]
PLR.delay(0.4, fn)
PLR.ease = { linear, inQuad, outQuad, inOutCubic, outCubic, outBack, outElastic }
PLR.spring(state, target, { f:3, z:0.5 }, dt)  // state={x,v}，可用来做弹性摆
PLR.clamp(v,a,b); PLR.lerp(a,b,t); PLR.rand(a,b); PLR.pick(arr);
PLR.worldPos(node)  -> [x,y,z] 世界坐标（node.world 平移分量）
PLR.panOf(worldPos) -> -1..1 声像
```

`tween` 用法（范例见 door.js）：动画期间在 update(k) 里改节点
pos/rot/scale 或自定义状态；`ease:'outBack'` 带轻微过冲，适合门/抽屉到位。

## 6. 主题（颜色一律走语义）

```js
PLR.theme.mode      // 'day' | 'night'（只读，别直接改；用 PLR.toggleEnv() 或开关物件）
PLR.theme.k         // 0=昼 → 1=夜 的平滑插值系数（动画过渡中）
PLR.theme.c.xxx     // 当前插值后的颜色字符串，直接给 canvas 用
// tokens: page, paper, paperFloor, ceil, ink, accent, glow, sky, star, moon, cloud
```

- 填充用 `tint:'paper'` 等，引擎按朝向自动加 2 档明暗（体积感）。
- 特殊填充：`'ink'`（深色小件，如唱片、时针）、`'glow'`（灯泡亮面）。
- 自绘 overlay（蒸汽/尘埃）用 `PLR.theme.c.ink` / `accent`。

## 7. 环境耦合（PLR.env）

```js
PLR.env.mode      // 'day'|'night'
PLR.env.breeze    // 0..1 平滑后的“风”（窗户开→目标1；影响窗帘/风铃/植物/蒸汽漂移）
PLR.env.fanLevel  // 0..1 吊扇风速（吊扇物件写入）
PLR.env.lampOn    // 台灯是否点亮（lamp.js 写入）
PLR.env.lampPos   // 灯泡世界坐标
PLR.env.lampK     // 0..1 灯光平滑系数（引擎插值，夜间明显）
PLR.env.seen      // Set：已被点击过的物件 id
```

约定：
- **窗**：开窗时 `PLR.env.breezeT = 1`，关窗 `= 0`（引擎平滑到 breeze）。
- **风铃/植物/窗帘/蒸汽**：读 `PLR.env.breeze`、`PLR.env.fanLevel` 增大幅值。
- **吊扇**：`PLR.env.fanLevel = speed`（0..1，含加减速惯性）。
- **台灯**：`PLR.env.lampOn = true/false; PLR.env.lampPos = [x,y,z]`。
- 昼夜切换由墙面开关物件调用 `PLR.toggleEnv()`（主控提供，负责主题+环境音）。

## 8. 音效 API（audio.js 提供，桩已就位）

```js
PLR.sfx.play(name, { rate:1, gain:1, pan:0 })   // 一次性音效
PLR.sfx.loopSet(id, { on, gain, pan, rate })    // 循环层：'fan' | 'vinyl' | 'amb' | 'tick'
PLR.sfx.setMuted(bool)
```

一次性音效名（按需调用，宁缺毋滥，音量要克制）：
`click`(轻点击) `clack`(开关/门锁) `creak`(门轴吱呀, rate=速度)
`latch`(到位锁扣) `slide`(抽屉滑动, rate=速度) `slideStop`(抽屉到位)
`book`(书滑动) `clink`(杯/玻璃) `plop`(软物落地) `squeak`(沙发吱呀)
`flip`(翻页) `swish`(布料/挥动) `chime`(风铃管, rate=音高索引) `bell`(时钟报时)
`rustle`(植物叶片) `pop`(弹起) `thunk`(重物落位)

循环层：
- `fan`：吊扇，gain 跟随 fanLevel，rate 可微调。
- `vinyl`：唱片机黑胶（含生成式 lo-fi 旋律+炒豆声），on/gain 开关。
- `amb`：环境底噪，`loopSet('amb',{mode:'day'|'night', gain})` 昼夜交叉淡化，
  gain 可随风。由引擎在模式切换时调用，物件不用管。
- `tick`：时钟秒针，`loopSet('tick',{gain, pan})` 每帧可调，按距离衰减。

播放前 AudioContext 未解锁时调用应静默忽略（桩已处理）。

## 9. 代码风格

- IIFE + 'use strict'，顶部 `const PLR = window.PLR;`
- 注释少量中文即可，只解释“为什么”。
- 几何构建代码按“部件”分段注释（// 框、// 抽屉…）。
- 每个物件文件 100~220 行为宜，几何要干净：先 big shape，再细节线。
- 线稿美学：宁可少而准的线，不要密而糊。排线 alpha 0.25~0.4。

## 10. 分工与文件清单（各 Agent 只写自己名下的文件）

| Agent | 文件 |
|---|---|
| A 墙面物件 | js/objects/switch.js, window.js, art.js, clock.js |
| B 书桌与收藏 | js/objects/desk.js, cup.js, globe.js, bookshelf.js, plant.js |
| C 客厅软装 | js/objects/sofa.js, cushions.js, coffeetable.js, rug.js, chair.js |
| D 媒体与空气 | js/objects/sideboard.js, player.js, fan.js, chime.js |
| E 音频 | js/audio.js（重写桩实现，API 不变） |

各物件详细规格见随任务下发的 Agent 提示词；坐标冲突以本文件 §4 为准。
