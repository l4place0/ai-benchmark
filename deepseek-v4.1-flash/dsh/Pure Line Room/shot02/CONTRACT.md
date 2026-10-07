# Pure Line Room — shot02 内部契约 (v1)

> 这是**开发用**内部文档，不是交付物。所有模块作者必须严格遵守本文件中的 API。
> 任何"我觉得这样更好"的偏离都会导致集成失败。

## 0. 铁律

1. **纯浏览器单机**。禁止任何网络请求、CDN、外部字体、外部图片、外部音频。
   禁止 `fetch` / `XMLHttpRequest` / `new Image()` 指向 http(s) / `@import url(http...)` / `FontFace` 远程。
2. **禁止安装任何依赖**。只用浏览器原生 API（Canvas2D, Web Audio, ES Modules）。
3. **禁止引用 shot01 或任何已有项目的代码**。
4. 每个 js 文件是 ES module，用相对路径 `import`。
5. 代码里不要出现 `console.error`；警告可以但尽量避免。
6. 不要修改不属于你的文件。

## 1. 技术方案

- 自研 **画家算法线稿渲染器**（Canvas 2D）：三维多边形 → 屏幕空间填充（用纸色）+ 描边（墨色）。
  填充用纸色 → 天然实现遮挡（后面的线被前面的面盖住），得到真正的三维空间感。
- 房间是一个盒子：**只画朝向相机的内表面**（背面剔除）。相机在房间外绕房间中心环绕，
  于是靠近相机的墙 / 天花板被自动剔除，形成漂亮的"剖切模型"视角，始终能看进房间内部。
- 拾取用 **ID 缓冲**：离屏 canvas 用唯一颜色画每个可交互部件，读像素判断 hover / click。
- 坐标系：**Y 轴向上**，单位 = 米。房间 `x ∈ [-3.2, 3.2]`, `z ∈ [-2.6, 2.6]`, `y ∈ [0, 2.9]`。
  - `x = -3.2` 是**左墙**，`x = +3.2` 是**右墙**。
  - `z = -2.6` 是**后墙（背墙）**，`z = +2.6` 是**前墙**。
  - 墙的**内表面**法线指向房间内部。后墙内表面朝 +z，左墙内表面朝 +x，地板朝 +y，天花板朝 -y。

## 2. 文件所有权

| 文件 | 负责人 |
|---|---|
| `index.html`, `css/style.css` | lead |
| `js/core/math3d.js`, `palette.js`, `builder.js`, `renderer.js`, `scene.js`, `anim.js`, `camera.js`, `input.js` | lead |
| `js/main.js` | lead |
| `js/core/audio.js` | agent-audio |
| `js/core/strokefont.js` | agent-font |
| `js/content/room.js` | agent-room |
| `js/content/desk.js` | agent-desk |
| `js/content/lounge.js` | agent-lounge |
| `js/content/ceiling.js` | agent-ceiling |

## 3. 场景对象注册 API（`js/core/scene.js`）

内容模块 `export default function build(ctx) { ... }`，`ctx` 是 `SceneCtx`：

```js
ctx.scene.paper()                  // 返回一个 Builder，用于「不可交互」的静态几何
const obj = ctx.object({           // 注册一个可交互对象
  id: 'desk-lamp',                 // 唯一 id
  label: '台灯',                    // 悬停时显示的标签（中文，短）
  cursor: 'pointer',               // 可选，默认 'pointer'
  hint: '点击开关',                 // 可选，显示在标签后
})
```

`ctx.object(...)` 返回一个 **ObjectHandle**：

```js
obj.builder            // Builder —— 用它在「对象局部坐标系」里建模（原点=对象锚点）
obj.part(id, opts)     // 注册一个可拾取部件，返回 PartHandle
obj.setPos(x, y, z)    // 设置对象锚点在世界中的位置（默认 [0,0,0]）
obj.setRot(rx, ry, rz) // 弧度
obj.setScale(s)        // 均匀缩放，默认 1
obj.onUpdate(fn)       // fn(dt, now, ctx) —— 每帧调用，用于持续动画
obj.onHover(fn)        // fn(isHover, ctx)
obj.onClick(fn)        // fn(ctx)
obj.onDrag(fn)         // fn({dx, dy, phase:'start'|'move'|'end'}, ctx)
obj.sfx = 'click'      // 可选：点击时自动播放的音效名
obj.depthBias = 0      // 可选：深度排序偏移，负数=更早画（更"远"）
obj.visible = true
```

`obj.part(id, opts)`：
```js
const p = obj.part('drawer-front', { label: '抽屉', cursor: 'pointer' })
p.builder              // 该部件的 Builder（与 obj.builder 共享同一局部坐标系）
p.onClick(fn) / p.onHover(fn) / p.onDrag(fn)
p.setCursor('grab')
p.hitPadding = 0.02    // 可选
p.hoverT               // 只读：0→1 平滑的悬停量，可在 onUpdate 里用
p.enabled = true
```

**只有被 `part()` 注册过的几何才会参与拾取。** 没注册的几何（`ctx.scene.paper()` 或
`obj.builder` 里直接画的）只参与显示与遮挡。

若一个对象只想要「整块可点」，可以 `const p = obj.part('body', {label:'沙发'})` 然后把所有
几何都画在 `p.builder` 里。

## 4. Builder API（`js/core/builder.js`）

Builder 内部维护一个 4x4 变换栈（局部空间）。所有坐标是**局部**坐标。

```js
b.push(); b.pop()
b.translate(x, y, z)
b.rotateX(a); b.rotateY(a); b.rotateZ(a)      // 弧度
b.scale(s)  /  b.scale(sx, sy, sz)
b.mat(m4)                                      // 直接乘一个矩阵

// ---- 几何 ----
b.quad(a, b, c, d, style)        // a,b,c,d 是 [x,y,z]，逆时针（从正面看）
b.poly(points, style)            // points: [[x,y,z], ...]，自动闭合
b.line(a, b, style)              // 只描边，不填充
b.polyline(points, style, closed=false)
b.tri(a, b, c, style)

// 便捷体块（都以 min/max 两个角给出，局部坐标）
b.box(min, max, style)                        // 完整 6 面盒
b.boxOpen(min, max, style, skip)              // skip: 'px','nx','py','ny','pz','nz' 数组，跳过某些面
b.slab(min, max, style)                       // = box，语义化

// 圆柱 / 圆（axis: 'y' | 'x' | 'z'）
b.cylinder(cx, cy, cz, radius, height, style, {segments=16, axis='y', capTop=true, capBottom=true, rTop=null})
b.disc(cx, cy, cz, radius, style, {segments=24, axis='y'})
b.ring(cx, cy, cz, rInner, rOuter, style, {segments=24, axis='y'})   // 扁环（正面/反面各一圈）
b.torus(...)  // 不存在，别用

// 球（用于地球仪）—— 用经纬线框 + 两个极冠
b.sphereWire(cx, cy, cz, radius, style, {meridians=8, parallels=5, segments=20})

// 文字（矢量笔画字体，无外部字体依赖）
b.text(str, { size=0.1, align='left'|'center'|'right', baseline='bottom'|'middle'|'top', plane='xy'|'xz'|'yz', style })
// size = 大写字高（米）。plane='xy' 时文字沿局部 +x 排列、+y 为上方。
```

`style` 见 §5。所有几何必须在 `b` 的当前变换下给出。

## 5. Style（`js/core/palette.js` + renderer）

```js
{
  fill:   'paper' | 'face1' | 'face2' | 'face3' | 'glass' | 'glow' | 'dark' | 'none' | [r,g,b] | '#rrggbb',
  stroke: 'ink' | 'inkMid' | 'inkSoft' | 'accent' | 'none',
  width:  1.2,        // 屏幕空间像素宽（会乘 dpr）
  bias:   0,          // 深度排序偏移，负数更早绘制（更远），正数更晚
  hatch:  null | {gap: 5, angle: 45, width: 0.8, stroke: 'inkSoft'}  // 屏幕空间排线阴影
}
```

- `fill` 省略 = 不填充（纯线）。**大面积不要用深色 fill**，只允许小面积用 `'dark'`。
- `hatch` 是屏幕空间排线，用来做阴影/材质（木纹、玻璃反光、地毯），保持线稿感。
- `width` 建议：结构外轮廓 1.6–2.0，主要结构线 1.1–1.4，细节线 0.7–0.9。

## 6. 全局状态（`ctx.state`）

```js
ctx.state.night        // bool —— 全局昼夜/灯光状态
ctx.state.lampOn       // bool —— 台灯
ctx.state.pendantOn    // bool —— 吊灯
ctx.state.blindsOpen   // 0..1
ctx.state.curtainOpen  // 0..1
ctx.state.fanSpeed     // 0..3
ctx.state.vinylPlaying // bool
ctx.state.muted        // bool
ctx.state.hintDots     // bool
```
读：`ctx.state.night`。写：**不要直接写**，用
`ctx.set('lampOn', true)`（会广播事件）。

订阅：`ctx.on('lampOn', (v) => {...})`，`ctx.emit('name', value)`。
`ctx.on('night', fn)` 在全局昼夜切换时触发。

## 7. 可用工具（`ctx` 上）

```js
ctx.theme            // 当前配色对象（每帧重建）
ctx.audio            // 音频引擎，见 §8
ctx.ease             // { linear, quadIn, quadOut, quadInOut, cubicIn, cubicOut, cubicInOut,
                     //   expoOut, backOut, elasticOut, sineInOut, smoothstep, spring }
ctx.lerp(a,b,t), ctx.clamp(v,a,b), ctx.damp(cur, target, lambda, dt)  // 指数阻尼
ctx.time             // 秒（自启动）
ctx.nightT           // 0..1 平滑的昼夜过渡量
ctx.requestHover(id) // 让某个部件闪一下（用于提示）
```

## 8. 音频 API（`js/core/audio.js`）

```js
audio.unlock()                    // 首次用户手势时调用（内部幂等）
audio.sfx(name, opts)             // 一次性音效
audio.setLoop(name, on, opts)     // 持续音
audio.setMasterVolume(v)          // 0..1
audio.setMuted(bool)
audio.param(name, value)          // 连续参数，如 audio.param('fanSpeed', 2)
```

- `sfx` 名称：`'click' 'switch' 'drawer' 'cabinet' 'doorOpen' 'doorClose' 'thud'
  'page' 'chime' 'globe' 'ceramic' 'cushion' 'knock' 'lampClick' 'vinylDrop' 'penClick'`
- `setLoop` 名称：`'vinyl' 'music' 'fan' 'night' 'day' 'tick' 'rain'`
- 所有音必须**纯合成**（Oscillator / BufferSource 白噪声 / BiquadFilter / Gain / Convolver(程序生成脉冲)）。
- 上下文处于 suspended 时不得报错；所有节点惰性创建。

## 9. 视觉目标（美术方向）

- 纸白底（`#f6f4ef` 附近），墨黑线（`#16161a` 附近），克制的暖灰阴影。
- 线宽有层次：外轮廓粗、结构线中、细节线细。
- 每个物体必须有**内部结构线**（抽屉分缝、木板拼缝、转轴、螺丝、铰链、书页、弹簧…），
  不能只有外轮廓的简笔画。
- 用**排线（hatch）**表现阴影与材质，不要用大块深色填充。
- 留白要够，构图要像一张建筑速写。
- 夜晚：纸色变深蓝灰、墨线变暖白，灯光用暖色 glow，窗外星空。

## 10. 空间布局（最终版，必须严格遵守）

### 房间盒体
`x ∈ [-3.2, 3.2]`（宽 6.4）、`z ∈ [-2.6, 2.6]`（深 5.2）、`y ∈ [0, 2.9]`（高 2.9）。
`x = -3.2` 左墙，`x = +3.2` 右墙，`z = -2.6` **后墙**，`z = +2.6` **前墙**。

### 相机默认视角
`yaw ≈ +0.62 rad`，`pitch ≈ 0.37 rad`，`radius ≈ 12.4`，看向 `(0, 1.32, 0)`。
相机在 **右前方、高处**。因此默认可见的是：

- **后墙内表面**（法线 `+z`）——可见 ✔
- **左墙内表面**（法线 `+x`）——可见 ✔
- **地板**（法线 `+y`）——可见 ✔
- 右墙、前墙、天花板 —— 被背面剔除 ✘（相机在它们外侧）

**结论：重要的东西必须放在「后墙 + 左墙 + 地板」上，才会在开局第一眼看到。**

### 具体摆放（精确坐标，单位米）

**后墙 `z = -2.6`（可见）**
| 物件 | 位置 | 归属模块 |
|---|---|---|
| 窗（含窗框、窗台、玻璃、窗外景色） | 洞口 `x ∈ [-2.62, -0.62]`, `y ∈ [0.95, 2.28]`，墙厚 0.16 | room |
| 百叶帘（窗洞内侧） | 同上洞口内 | room |
| 窗帘（顶部导轨 + 两片） | 导轨 `x ∈ [-2.78, -0.46]`, `y = 2.42` | room |
| 墙上时钟 | 圆心 `(0.06, 2.14, -2.51)`，半径 0.21 | room |
| 装饰画 / 海报墙 | 大画 `x ∈ [0.72, 2.32]`, `y ∈ [0.98, 2.10]`；旁边两幅小画 | room |
| 书架（靠后墙） | `x ∈ [0.55, 2.55]`, `z ∈ [-2.52, -2.18]`, `y ∈ [0, 1.95]` | lounge |
| 唱片机矮柜 | 见下「地板/中部」 | lounge |

**左墙 `x = -3.2`（可见）**
| 物件 | 位置 | 归属模块 |
|---|---|---|
| 门（含门框、门板、把手、合页） | 洞口 `z ∈ [1.02, 1.98]`, `y ∈ [0, 2.06]`，墙厚 0.16 | room |
| 灯光开关 + 面板 | 面板中心 `(-3.11, 1.26, 0.72)`，尺寸 `0.09 × 0.13` | room |
| 插座 | `(-3.11, 0.32, -0.55)` | room |
| 壁挂小搁板 + 摆件 | `z ∈ [-0.30, 0.90]`, `y = 1.72` | room |
| 书桌（下柜 + 抽屉 + 桌面） | 见下 | desk |

**地板 `y = 0`**
| 物件 | 位置 | 归属模块 |
|---|---|---|
| 地毯（椭圆/圆角矩形） | 中心 `(0.55, 0.012, 0.62)`，`3.5 × 2.6` | lounge |
| 沙发 | 靠前侧，中心 `(0.55, 0, 1.92)`，朝向 **-z**（面向房间内部），宽 2.05、深 0.86 | lounge |
| 抱枕 ×3 | 沙发座面上 | lounge |
| 茶几 | 中心 `(0.55, 0, 0.86)`，`1.25 × 0.62`，高 0.42 | lounge |
| 唱片机 + 矮柜 | 矮柜靠后墙：`x ∈ [0.62, 1.92]`, `z ∈ [-2.52, -2.09]`, `y ∈ [0, 0.74]`；唱片机放柜面上 | lounge |
| 书桌 | 左后角：桌面 `x ∈ [-2.95, -1.05]`, `z ∈ [-2.46, -1.78]`, 桌面高 `0.75` | desk |
| 椅子 | 中心 `(-1.95, 0, -1.32)`，朝 -z（面向书桌） | desk |
| 地球仪 / 杯子 / 台灯 / 书堆 / 笔筒 | 都在书桌面上 | desk |

**天花板（被剔除，但吊挂物仍可见）**
| 物件 | 位置 | 归属模块 |
|---|---|---|
| 吊扇 | 中心 `(1.05, 2.90, 0.15)`，吊杆长 0.42，扇叶半径 0.62 | ceiling |
| 吊灯 + 拉线开关 | 中心 `(-1.75, 2.90, -1.55)`，灯罩底 `y ≈ 2.18` | ceiling |
| 风铃 | 挂点 `(-2.25, 2.88, -1.75)`，管长 0.34 | ceiling |
| 悬挂小装饰（纸鹤/星星串）×2 | `(2.35, 2.88, 0.95)` 与 `(-0.35, 2.88, 0.35)` | ceiling |

**右墙 `x = 3.2`（默认被剔除，仍要放置内容，转过去时是奖励）**
| 物件 | 位置 | 归属模块 |
|---|---|---|
| 音乐海报 | `x ≈ 3.10`, `z ∈ [-0.95, 0.35]`, `y ∈ [1.25, 2.35]` | lounge |
| 落地灯 | 底部 `(2.72, 0, -1.55)` | room |

**前墙 `z = 2.6`（默认被剔除）**
| 物件 | 位置 | 归属模块 |
|---|---|---|
| 三联装饰画 | `z ≈ 2.50`, `x ∈ [-1.5, 1.5]`, `y ∈ [1.15, 2.35]` | room |
| 衣帽钩 + 挂衣 | `x ≈ -2.35`, `y ≈ 1.85` | room |

### 归属与不越界

- `room.js` 负责 **房间外壳 + 后墙/左墙/右墙/前墙上的固定物**（窗、百叶、窗帘、门、开关、插座、时钟、装饰画、搁板、落地灯、踢脚线、地板、天花板）。它可以出现在四面墙和地板/天花板上。
- `desk.js` 只负责 **书桌区域**：`x ∈ [-3.2, -0.85]`, `z ∈ [-2.6, -1.0]`，外加椅子（`z` 可到 `-1.15`）。
- `lounge.js` 只负责 **地面中部 / 后墙中右 / 右墙**：书架、矮柜、唱片机、地毯、沙发、抱枕、茶几、海报。
- `ceiling.js` 只负责 `y > 2.15` 的吊挂物与天花板线脚。

⚠️ 任何模块都不允许把几何画到别人的区域里（例如 `desk.js` 不许碰 `x > -0.8`）。

### 10.1 房间外壳的绘制规则（room.js 必读）

- 地板、四面墙：**每个面都用 `cull:'back'`**，并且**顶点绕序必须让法线指向房间内部**。
  - 地板：法线 `+y`，四点顺序（从上方看逆时针）：`(-3.2,0,2.6) → (3.2,0,2.6) → (3.2,0,-2.6) → (-3.2,0,-2.6)`
  - 后墙 `z=-2.6`（法线 `+z`）：`(-3.2,0,-2.6) → (3.2,0,-2.6) → (3.2,2.9,-2.6) → (-3.2,2.9,-2.6)`
  - 左墙 `x=-3.2`（法线 `+x`）：`(-3.2,0,2.6) → (-3.2,0,-2.6) → (-3.2,2.9,-2.6) → (-3.2,2.9,2.6)`
  - 右墙 `x=3.2`（法线 `-x`）：`(3.2,0,-2.6) → (3.2,0,2.6) → (3.2,2.9,2.6) → (3.2,2.9,-2.6)`
  - 前墙 `z=2.6`（法线 `-z`）：`(3.2,0,2.6) → (-3.2,0,2.6) → (-3.2,2.9,2.6) → (3.2,2.9,2.6)`
  - 墙要做出厚度感：给每面墙再补一圈"外皮"四边形（沿着房间外侧偏移 0.16，法线朝外，
    `cull:'front'`），这样从侧面看墙有厚度。也可以只在门窗洞口处补厚度。
- **天花板不要用实体填充**（否则挡住整个房间）。天花板只画 **线稿**：
  一圈口线 + 若干梁/格栅线，`stroke:'inkSoft'`, `width:0.7`，且 `fill:'none'`。
- 墙面上所有"贴在墙上"的东西（画框、开关、时钟、搁板）必须离墙 0.005~0.03，
  避免和墙面 z-fighting 式的同深度排序抖动；并给 `style.bias = -0.5` 之类的小负偏移，
  确保它们画在墙面之后（更早绘制 = 更容易被盖住？不对——**它们要画在墙之后**意味着
  **更大的 depth 或更小的 bias**；实际上因为它们离相机更近，depth 自然更大，会排在墙后面画，
  所以通常不用手动 bias。若出现闪烁再调）。
- 玻璃：`fill:'glass'`, `stroke:'inkSoft'`, `alpha:0.85`，再叠 2~3 条斜向反光短线。

## 11. 必须实现的交互清单（分配）

**room.js**：门开关、百叶升降、窗帘开合、墙上时钟（真实时间 + 秒针）、装饰画（点击换一幅/轻晃）、灯光开关（切换全局 night）。

**desk.js**：台灯开关（含光晕）、杯子（蒸汽开关）、椅子（可拖动 + 回弹 + 旋转）、书本抽出、储物柜门开关、抽屉开关、地球仪（拖动旋转 + 惯性）。

**lounge.js**：书架上的书抽出、沙发抱枕（点击压扁回弹）、茶几（可拖动微移）、地毯（点击掀起一角/滑移）、唱片机（播放/停止 + 唱盘旋转 + 唱臂移动 + 音乐与爆豆声）、海报（点击反馈）。

**ceiling.js**：吊扇（0/1/2/3 档，持续旋转 + 音效）、吊灯（拉线开关 + 灯光）、风铃（点击摆动 + 铃声，且始终有轻微自然摆动）、悬挂小装饰（轻微摆动）。

合计可交互部件 ≥ 18。

## 12. 验收

- `node _dev/verify.mjs` 通过（headless Chrome + CDP）。
- 无 console error。
- 断网可运行（verify 会拦截所有非 file:// 请求并断言为 0）。
