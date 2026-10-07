# 线之屋 · The Line Room — 开发契约 v1

纯前端、零依赖、单机运行的艺术互动作品。经典 `<script>`（非 ES Module），所有代码挂在唯一全局 `window.RLR` 下。
**铁律**：运行时禁止任何外部请求（CDN/字体/图片/音频/API）；禁止安装新依赖；每个 Agent 只允许写自己负责的文件；不要修改引擎/他人文件（发现 API 缺口就在报告里提出，由集成者统一修）。

## 文件与加载顺序（index.html）
math.js → style.js → builders.js → audio.js → engine.js → room.js → objects/*.js → main.js
objects 目录文件全部为 `js/objects/<name>.js`，每个文件定义一个或多个 `RLR.createXxx(opts)` 工厂函数（IIFE 内挂到 RLR）。

## 坐标系（米制）
- y 向上；x 向右；z 朝观察者（房间前方是敞开的剖切面）。
- 房间：x∈[-2.7,2.7]，y∈[0,3.02]，z∈[-2.2,2.2]；后墙 z=-2.2（带窗），左墙 x=-2.7（带门），右墙 x=+2.7；墙厚 0.12（墙体内表面：后墙 z=-2.2，左墙 x=-2.58，右墙 x=+2.58）。
- 窗洞（后墙）：x 0.10..1.80，y 0.95..2.30。窗台板顶 y=0.95。
- 门洞（左墙）：z 0.55..1.47，y 0..2.06；门铰链在 z=1.47 一侧，向室内(+x)开。门叶 pivot = [-2.58, 0, 1.47]。

## 数学 RLR.M / 缓动 RLR.E
向量是普通数组 [x,y,z]。
M.add(a,b) M.sub(a,b) M.scale(a,s) M.dot(a,b) M.cross(a,b) M.len(a) M.norm(a)
M.lerp(a,b,t) M.lerp3(a,b,t) M.clamp(x,a,b) M.rand(a,b) M.hash(i)（0..1 确定性）
M.rotY(p,a) M.rotX(p,a) M.rotZ(p,a)
E.linear E.inQuad E.outQuad E.inOutCubic E.outCubic E.outBack E.outElastic E.outBounce

## 变换规则（引擎实现，对象只提供数据）
- 对象局部坐标以 `obj.pivot`（世界坐标）为原点。
- world = RotRoot(p) + obj.pivot + obj.off；RotRoot 顺序：rotY → rotX → rotZ。
- 子部件 `obj.parts.NAME = { pivot:[局部坐标], yaw,pitch,roll, off:[局部], scale:[x,y,z], parent:'另一部件名' }`。
  部件变换语义：**几何与 hits 一律写在对象局部坐标**（部件 pivot 只是旋转中心）；部件变换 = 绕 pivot 旋转(含 scale) + 平移 off。
  parent 链作用顺序（引擎实现，以此为准）：祖先部件先作用，命名部件**最后**作用。要"外层倾斜、内层自转"（如地球仪），把**自转件设为倾斜件的 parent**、两者 pivot 同点。
- face/stroke/text/hit 均可带 `part:'NAME'`（随后者 off/旋转一起动）；无 part 则直接根变换。
- **数组属性动画模式**：tw 只能补间数值属性。要动画 off/roll 等：在对象上放标量状态（如 `this.openT`），用 tw 补间它，再在 update() 里写回 part 字段。

## 几何构建 RLR.B（返回局部坐标数据）
- `B.face(pts, o)` → 面。字段（o 可覆盖）：`fill:'auto'|'#hex'|null`（'auto'=按光照填纸色/阴影；null=不填只有线）、`stroke:'edge'`（描边角色）、`w:1`（线宽倍率）、`dbl:false`（双面）、`zBias:0`（正值=更晚画=更靠前）、`alpha:1`、`blend:null|'lighter'`、`hatch:true`、`part:null`、`strokes:[]`。
  `f.strokes` 为附属细节线数组，元素 `{pts, w, col, alpha, dash}`（随面一起变换，画在面之后）。
- `B.stroke(pts, o)` → 独立线。字段：`w:'detail'|'edge'|'outline'|'hair'|数字`（数字=相对 detail 宽度倍率）、`col`、`alpha`、`dash`、`part`、`zBias`。
- `B.text(p, str, size, o)` → 文字。`size` 单位米；字段 `col`、`align:'center'`、`part`、`zBias`。
- `B.box(c, s, o)` → 盒子（c 中心，s 全尺寸）。返回 `{faces:[6面], strokes:[]}`。
  `o.face(key,f)` 回调逐面定制，key∈px nx py ny pz nz；`o.strokeRole` 默认 'edge'；`o.fill` 默认 'auto'；`o.part`。
- `B.cyl(c, r, h, o)` → 圆柱/圆台。o：`{seg=14, axis='y', rTop=r, cap=true, capB=true, sideStroke=false, fill='auto'}`。c 为柱体中心。
- `B.disc(c, r, o)` → 圆盘面。o：`{axis='y', seg=24, fill='auto', strokeRole='edge', dbl}`。
- `B.arc(c, r, a0, a1, o)` → 弧线 stroke。o：`{axis='y'|'x'|'z', seg=12, w, col, alpha, part}`。角度弧度。
- 线宽角色（引擎基准 px）：'outline'=2.3（物体主轮廓/剖面粗线）、'edge'=1.45（结构转折）、'detail'=0.95（细节）、'hair'=0.62（纹理/弱线）。

## 样式 RLR.STYLE
- `STYLE.c(key)` → 按 env.t 昼夜插值的颜色。key：paper shade section ink inkSoft sky skyLow sun hill corridor。
- `STYLE.c2(dayHex, nightHex)` → 自定义双色插值（用于特殊填充如红皮书）。
- `STYLE.mix(h1,h2,t)`、`STYLE.widths`、`STYLE.font(px)`（衬线，系统字体）。
- **不要**在 fill 里写死和昼夜冲突的颜色；小面积点缀可用 STYLE.c2(day,night)。

## 音频 RLR.Audio（全部合成音，首次用户点击后 init）
- `Audio.play(name, opts)`：'click' 'snap' 'latch' 'thud'{pitch} 'slide'{dur} 'creak'{dur} 'scrape'{dur} 'cloth'{dur} 'flick' 'puff' 'pop' 'tink'{f} 'sparkle' 'rustle' 'servo' 'flip'
- `Audio.chime(strength)` 风铃簇；`Audio.fan(speed01)` 吊扇循环；`Audio.music(bool)` 唱片机；`Audio.lampHum(bool)`；`Audio.tick()` 时钟每秒调；`Audio.setNight(t01)`（引擎每帧自动调，勿手调）；`Audio.toggleMute()`。
- 引擎每帧会调用 `Audio.setNight(env.t)`。

## 引擎 RLR.Engine
- `Engine.add(obj)`（自动调 obj.build()）；`Engine.scene`、`Engine.byName`。
- `Engine.tw(target, key, to, dur, ease?, done?)` 数值补间（同 target+key 自动覆盖）；`Engine.delay(fn, sec)`；`Engine.toast(msg)`。
- `Engine.env`：`{ t:0..1(昼→夜，由开关对象补间), reveal:false, hover, time:Date }`；`Engine.gustVal()` → 0..1 当前阵风强度（周期性自动起风）。
- `Engine.light`：`{ lampPos:[世界坐标], lampI:0..1 }` 台灯对象写入，引擎用于局部照明与光晕。
- `Engine.project(p)` → `{x,y,s,vz}` 屏幕坐标（CSS px）与缩放（像素/米），需要屏幕空间特效时用。
- 相机：拖动旋转、滚轮缩放、右键/Shift 平移，已带阻尼与限位，Agent 无需处理。

## 对象接口（每个 createX 返回）
```js
{
  name:'唯一名', label:'中文名', interactive:true,
  pivot:[x,y,z], off:[0,0,0], yaw:0, pitch:0, roll:0,
  parts:{}, faces:[], strokes:[], texts:[],
  hits:[{c:[局部中心], h:[半尺寸], part?, tag?}],
  hover:false, press:false,
  build(){}, onHover(on){}, onPress(down){}, action(tag){}, update(dt,t){}
}
```
- hits 的 c/h 是**局部坐标**（若有 part 则为该部件局部坐标）；包围要宽容一些，宁大勿小。
- hover/press 引擎自动设置 `obj.hover/obj.press` 并自动加粗轮廓 + 光标 + 名称浮签；对象自己在 onHover 里做**特有动作**（如旋钮转动、书微微探出），不要做统一缩放。
- 引擎每帧调 update(dt,t)（t 为秒）；用标量+tw 模式驱动部件。

## 布局总表（world 坐标；与建筑关系已核对，勿越界）
| 物件 | pivot | 尺寸/备注 |
|---|---|---|
| 书桌 desk | [-1.78, 0, -1.82] | 台面 1.5×0.68 顶 y=0.76；抽屉在右端朝 +z |
| 椅子 chair | [-1.70, 0, -1.18] | 面向书桌(-z)，可拉出 |
| 台灯 lamp | [-2.32, 0.76, -1.86] | 灯头朝 +x 悬在桌面上方 |
| 茶杯 cup | [-1.55, 0.76, -1.78] | 持续蒸汽 |
| 地球仪 globe | [-1.16, 0.76, -1.80] | 轴倾角 23° |
| 书架 shelf | [-2.50, 0, -1.30] | 体量 x 0.32×z 1.36×h 2.02；书脊朝 +x |
| 挂钟 clock | [-0.42, 2.32, -2.185] | 后墙，r≈0.19 |
| 挂画A artA | [-1.78, 2.02, -2.185] | 后墙，初始歪 4° |
| 窗帘 curtains | 杆 (0.95, 2.44, -2.13) | 两片，开/合 |
| 绿植 plant | [1.52, 0.95, -2.16] | 窗台上 |
| 风铃 chime | [2.05, 3.02, -1.90] | 吊在后右角天花板 |
| 吊扇 fan | [0, 3.02, 0.35] | 三档循环 |
| 边柜 sideboard | [2.44, 0, -0.80] | 0.42×1.5×0.78，柜门/抽屉朝 -x |
| 唱片机 player | [2.46, 0.78, -0.80] | 边柜顶上 |
| 挂画B artB | [2.585, 1.78, -0.80] | 右墙边柜上方，点击换画 |
| 沙发 sofa | [2.18, 0, 0.95] | 背靠右墙面向 -x，长 1.35(z) |
| 抱枕 pillows | 沙发上两枚 | 可压扁 |
| 茶几 table | [1.45, 0, 0.95] | 顶 y=0.40；上有一本可翻的书 |
| 地毯 rug | [1.35, 0, 0.75] | 1.7(x)×2.0(z)，前左角可掀 |
| 电灯开关 switch | [-2.585, 1.16, 0.30] | 左墙门旁；**唯一**负责补间 Engine.env.t（昼↔夜） |

## 美术要求
- 线稿分层：主轮廓 outline / 结构 edge / 细节 detail / 弱线 hair；细节线多用 f.strokes 附属。
- 避免大面积涂黑；用 'auto' 填充+阴影线表达体积。小件允许 STYLE.c2 点缀色。
- 家具要有结构细节（板厚、企口、木纹、五金），不要简笔画盒子。
- 动画用非线性缓动；不同物件速度/节奏要不同。
