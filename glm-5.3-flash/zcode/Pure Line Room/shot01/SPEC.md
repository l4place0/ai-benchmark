# SPEC — 纯线之室 · Pure Line Room（shot01）

一件纯浏览器单机的互动线稿房间：白纸般的空间里用黑色矢量线条构成一间完整的三维居室，
每件家具都可以被发现、悬停、点击并给出行为化反馈。本文档是**多 Agent 协作的唯一契约**，
所有实现必须严格遵守，不得自行发明 API。

---

## 1. 硬性约束

- 纯前端、零依赖：禁止 import/require/模块语法，禁止 CDN / 网络请求 / 外部字体 / 图片 / 音频文件。
- 每个文件是普通 `<script>`，通过 `window` 全局命名空间通信；断网双击 index.html 必须能跑。
- 语言：ES2019 普通脚本，2 空格缩进，单引号，分号。
- 所有颜色必须取自 `Env.C.*`（禁止硬编码调色板十六进制；临时半透明可用 rgba 字符串，但基调一律 `Env.C`）。
- 不直接操作 canvas/ctx —— 全部通过 part 体系描述几何。
- 交付前必须通过 `node --check js/<你的文件>` 语法检查。
- 工厂函数必须可重复调用生成独立实例（禁止模块级可变共享状态）。
- 若怀疑 engine.js 有 bug：**不要改 engine.js**，在最终报告中注明。
- 每个可交互物体必须有中文 `label`（如「唱片机」）。

## 2. 文件与全局命名空间

| 文件 | 负责 | 内容 |
|---|---|---|
| js/engine.js | 主控（已完成，**禁改**） | `Engine` / `Env` / `Tweens` |
| js/audio.js | 音频 Agent | `AudioKit` |
| js/objects_arch.js | 建筑 Agent | makeShell / makeDoor / makeWindow / makeCurtains / makeLightSwitch |
| js/objects_deco.js | 墙顶装饰 Agent | makeClock / makeWallArt / makeChime / makeFan / makePendant |
| js/objects_study.js | 书房 Agent | makeDesk / makeChair / makeLamp / makeCup / makeBookshelf |
| js/objects_lounge.js | 起居 Agent | makeDresser / makeRecordPlayer / makeGlobe / makeSofa / makePillow / makeCoffeeTable / makePlant / makeRug |
| js/main.js | 主控（已完成） | 装配 / 昼夜联动 / HUD / 发现计数 |

每个 objects 文件末尾按此模式注册（文件开头先 `window.ROOM_PARTS = window.ROOM_PARTS || {};`）：

```js
ROOM_PARTS.makeDoor = function (opts) {
  var o = new Engine.RoomObject({ id: 'door', label: '门', pos: opts.pos, rotY: opts.rotY });
  // ... 构建 parts、实现 update/onClick/setHover ...
  return o;
};
```

## 3. 坐标系与房间

- 米制。y 向上，z 朝观察者（南）。地面 y=0，天花板 y=4。
- 房间：x∈[0,10]，z∈[0,9]。**后墙 z=0**（朝 +z），**左墙 x=0**（朝 +x），右/前两侧开放。
- 物体局部坐标：以锚点为原点（多为底部中心），`opts.pos` 为世界锚点，`opts.rotY` 为角度（度）。
- 局部几何约定 **+z 为正面朝向**（物体背贴墙时正面即朝房间内）。
- 相机被限制在南-东上空环视这个墙角，永远不会绕到墙后。

## 4. Engine API（唯一可用接口，已实现并通过无头自测）

### 4.1 数学
```js
Engine.V.add/sub/mul/dot/cross/len/norm/lerp(a, b[, t])   // 点均为 [x,y,z]
Engine.X.xform(pts, o) -> 新点列   // o: {pivot:[..], scale, rotX, rotY, rotZ(度), move:[..]}
                                   // 顺序: 绕 pivot 缩放 → rotX → rotY → rotZ(各绕 pivot) → 平移
Engine.X.clonePts(pts)
Engine.E.linear quadIn quadOut cubicIn cubicOut cubicInOut quartOut sineInOut backOut elasticOut bounceOut
```

### 4.2 补间 / 弹簧
```js
Tweens.add(target, prop, to, {dur:0.45, ease, delay, onDone, onUpdate})  // 同 target+prop 重复添加会取代旧补间(从当前值续接)
Tweens.kill(target, prop?)          // prop 省略则杀该目标全部
Engine.Spring(freqHz, dampRatio)    // .kick(vel) .set(x) .reset() .tick(dt)->x
```
补间目标必须是对象上的**数字属性**（如 `this.openT`）。往复动作用 backOut/elasticOut 收尾。

### 4.3 RoomObject
```js
var o = new Engine.RoomObject({ id, label, pos:[x,y,z], rotY:度, layerBias:0, pickable:true });
```
可覆写生命周期：`update(dt, t)`（t 总秒）、`onClick(part)`（part=按下的具体部件，可为 null）、
`setHover(h)`、`setPress(p)`。字段：`this.hovered / this.pressed / this.parts / this.label / this.id`。
其它：`o.world(localPt)->[x,y,z]`、`o.setRotY(度)`、`o.hide()/.show()`。

### 4.4 part 构建器（全部追加到 this.parts 并返回 part）
```js
o.panel(pts3, st)      // 闭合多边形（可填充+描边）
o.line(pts3, st)       // 开放折线（仅描边）
o.circ(c, r, axis, st) // 3D 圆/弧; axis:'x'|'y'|'z'; st.segs 采样数, st.arc0/st.arc1 弧度, st.closed
o.ellip(c, rx, rz, st) // 水平椭圆（y=c[1] 平面）
o.box(w,h,d, at, st)   // 轴对齐盒; at=[cx,yBottom,cz]
                       // 返回 {faces:[pz,nz,px,nx,py,ny], edges(9条,skipBottom默认true), all, pz..ny}
                       // st: fill(默认'paper'), w, edgeW, edgeCol, pick(默认true), skipBottom
                       // 注意: nz 背面与 ny 底面 pick 恒为 false
o.cyl(cb, r, h, axis, st) // 圆柱/圆台; cb=底面圆心; st: topR, segs, profiles(0|2|4), capFill
                          // 返回 {circles:[底圈,顶圈], profiles, caps, all}; circles pick=false
o.hatch(quad4, n, st)  // 在四边形 [p0,p1,p2,p3] 内画 n 条平行细线; st: col(默认'ink2'), w(默认'hair'), inset
```

**st（样式，panel/line 通用）**：
- `fill`: `'paper'`(体块遮挡色) | `'void'`(开口内腔暗色) | `'sky'` | `'sun'`(日光束,透明度由 Env 控制) | rgba 字符串 | null
- `w`: `'contour'`(2.4px 主轮廓) | `'struct'`(1.6 结构) | `'detail'`(1.05 细节) | `'hair'`(0.72 发丝) | `'none'`(只填充不描边)
- `wpx`: 数字直接指定线宽（优先于 w）
- `col`: `'ink'` | `'ink2'`(50% 墨) | rgba 字符串
- `dash:[6,5]`, `alpha:0..1`, `pick:bool`(panel 默认 true / line 默认 false), `bias:数字`(排序微调,正=更晚画), `hidden:bool`

线宽会随深度自动缩放（近粗远细），并因 hover 自动 ×1.35 —— 因此**不要**自己实现加粗高亮。

### 4.5 动画方式
静态部件建好即忘。**动画 = 每帧改 part.pts**：
```js
part.set({ rotY: 45, pivot: [0,1.2,0], move: [0.3,0,0], scale: 1.05 })  // 从 part.base 重新推导 pts
```
也可直接算 `part.pts = Engine.X.xform(part.base, {...})`。抽屉/门扇/指针/叶片/布条全部用这个机制。

### 4.6 粒子与光效（世界坐标，画在所有物体之上）
```js
Engine.FX.puff(worldPt, {n:5, spread:.05, rise:.16, size:.016, life:1.6, alpha:.3, col:[r,g,b]}) // 蒸汽/尘埃团
Engine.FX.glow(worldPt, rWorld, rgbArr, alpha)  // 每帧调用=当帧光晕(暖光), 不调用则无
```

### 4.7 Env（昼夜/灯光全局状态）
```js
Env.isNight / Env.lightsOn / Env.skyT(0昼→1夜,已缓动,用于天空内容淡入淡出)
Env.setNight(b) / Env.setLights(b)   // main 接线；1.5s 全局配色过渡
Env.C.bg fill void ink ink2 sky glow sun   // 全部为 css 颜色字符串; C.glowRgb 为 [r,g,b]
Env.mode() -> 'day' | 'nightLit' | 'nightDark'
```
三套配色：day（纸白+墨黑）、nightLit（夜·开灯：暖纸色+窗外夜空）、nightDark（夜·关灯：暗底+浅色线条反相）。

### 4.8 场景与启动（main 已用，子 Agent 不调用）
`Engine.scene.add(obj)` / `Engine.scene.get(id)`；`Engine.start({canvas, onHover, onInteract, cam})`。
输入已内置：左键拖动环视、右键/Ctrl 拖动平移、滚轮缩放、双击复位、悬停拾取、点击派发。

## 5. AudioKit API（audio.js 必须全部实现；未 init 或静音时所有方法必须安全 no-op）

```js
AudioKit.init()            // 首次用户手势时由引擎调用（幂等）；init 后自动开始环境底噪
AudioKit.setMuted(b) / toggleMuted() -> bool / isMuted() / ready
AudioKit.setNight(night)   // 切换环境底噪（昼:极轻室内噪+偶发鸟鸣; 夜:虫鸣+更低噪）
// 一次性音效
click()          // 通用轻点
switchToggle(on) // 电灯/开关拨动（on/off 音高区分）
drawerMove(open) // 抽屉滑轨（噪声扫频+末端木碰）
doorMove(open)   // 开门铰链吱呀+闷响（关=反向）
thunk()          // 木头闷磕
slide()          // 木椅/书本短促滑动
pageFlip()       // 纸页翻动
chimeStrike(n)   // 风铃 n 个五声音阶铃声(A 宫调式, 长衰减)
pop()            // 抱枕压扁回弹的闷噗
puff()           // 蒸汽轻嘶
wobble()         // 木器晃动的低频嗡
swish()          // 布料/织物短促呼喇（窗帘、地毯拍灰）
shift()          // 昼夜切换的柔化过渡垫音
tick(alt)        // 挂钟 tick/tock（音量必须很低）
dong()           // 钟体报时单鸣
// 循环声（句柄式，可重复调用）
fanStart() fanStop() fanRate(x01)   // 吊扇：噪声+低频电机，rate 调音高/速度感
vinylStart() vinylStop()            // 唱片机：黑胶噪点+温柔五声旋律循环(A 小调五声, ~74bpm, 低通+轻微抖晃)
```
实现要点：全部振荡器/噪声缓冲合成；主链 gain(0.9)→轻低通→compressor→destination；循环用 lookahead 调度，Stop 需平滑淡出 0.4s；tick 音量 ≤0.05，环境 ≤0.06，旋律 ≤0.16。

## 6. 交互与动画规范

- **hover**：必须与物体行为相关的轻反馈（如门把手微转、抽屉微露 1.5cm、灯罩轻晃、蒸汽变浓、书微微探出），加引擎自动的线宽加重。禁止统一缩放。
- **press**：物体轻微下沉 3~8mm（update 里读 `this.pressed` 施加）。
- **click 动画**：一律用 `Tweens` + 非线性缓动；往复动作用 backOut / cubicInOut；弹性用 Spring 或 elasticOut。时长 0.35~1.2s。
- **持续动态**（每帧 update 内实现，不许点击才动）：挂钟指针走真实时间、杯中蒸汽持续、风铃常摆、吊扇惯性旋转、唱片旋转、窗帘布摆动、盆栽叶颤、昼间窗台光束尘埃。
- **发现机制**：引擎在 onClick 后回调 main（物件无需实现），物件只需保证 `label` 正确。

## 7. 对象行为规格（编号即各 Agent 任务清单）

### A. objects_arch.js
1. **makeShell**（id:'shell', 无 label, pickable:false, layerBias:-60）
   房间线框：地板矩形、天花矩形、两墙轮廓线（w:'struct', col:'ink'）；地板木纹 12 条平行线沿 x 方向（z 每 0.72 一条）+ 每板 2~3 处错缝短线（'hair'/'ink2'）；两墙踢脚线（y=0.09, 'hair'/'ink2'）。全部 pick:false。
2. **makeDoor**（id:'door', label:'门', pos:[8.62,0,0.02], rotY:0）
   门框（宽0.94 高2.12, 含门楣与侧框线条）；门扇（fill:'paper', 内嵌两块凹面板线 + 把手圆 + 锁孔）；门扇 pivot 在左侧铰链。onClick 切换开合：openT 0→1（rotY 约 -78°, cubicInOut 0.9s, 音 doorMove）+ 末端 thunk。开启后门洞露出 fill:'void' 的暗背板。hover：把手微转 15°。press 下沉。门洞背板 pick:false。
3. **makeWindow**（id:'window', label:'窗', pos:[2.8,0,0.02], rotY:0）
   窗框宽1.84（x 1.88..3.72）、y 1.02..2.78、厚 0.09；十字窗棂分四格；窗台突出。天空背板 fill:'sky'（z=-0.01, pick:false）：昼=太阳圆+光芒短线+2 朵云弧线；夜=月亮(弧)+星(十字/点, 闪烁, 用 Env.skyT 在昼夜两套绘制间淡入淡出，各自的 alpha 乘 (1-skyT)/(skyT))；昼间：地板投 fill:'sun' 光束四边形（z 0.05→1.3 地面, pick:false, bias:-0.5）+ 每 0.7s 在光束内 FX.puff 尘埃（col 用 Env.C.glowRgb, alpha 0.05, n1）。onClick 切换 `Env.setNight(!Env.isNight)`（音 shift）+ 窗框轻微一震（Spring）。hover：天空亮度轻微提升（画一层低 alpha 高亮框）。
4. **makeCurtains**（id:'curtains', label:'窗帘', pos:[2.8,0,0.12], rotY:0）
   帘杆（宽2.6, y2.92, 两端球头）+ 每侧 5 条竖波纹布条（fill:'paper', 底缘波浪线）。curtainT 0(开)/1(合) 用 Tween 0.8s（音 swish）；开态布条收拢在两侧（各自 x 压缩），合态铺满窗宽。持续：每条布底缘随 sin(t+相位) 轻摆，摆幅 ×(1+吊扇开启加成)——读 `Engine.scene.get('fan')` 的 speed 字段（容错：不存在则 0）。hover：布条摆幅+30%。
5. **makeLightSwitch**（id:'switch', label:'电灯开关', pos:[7.78,1.22,0.03], rotY:0）
   底板 0.09×0.13 + 拨钮（竖向小方块）。onClick：拨钮翻向（move y ±0.014, backOut 0.25s）+ `Env.setLights(!Env.lightsOn)`（音 switchToggle）。hover：拨钮微探出 0.004。

### B. objects_deco.js
6. **makeClock**（id:'clock', label:'挂钟', pos:[6.35,2.78,0.04], rotY:0）
   外圈木框环（circ 两圈）+ 表盘 fill:'paper'（z 偏 -0.015, pick:false）+ 12 刻度（整点粗 detail、分刻 hair）+ 时/分/秒针（struct/detail/hair; `new Date()` 每帧; 秒针**每秒步进+过冲**：目标角=秒*6°, 用 Tween 0.12s backOut 追赶，秒变化时调 AudioKit.tick(秒%2)）+ 中心铆钉。onClick：dong() + 挂钟整体 Spring 晃动（rotZ ±2°）。hover：钟体微倾 1°。
7. **makeWallArt**（id:'art', label:'装饰画', pos:[0.05,2.1,3.7], rotY:90）
   画框 0.78×0.98（fill:'paper'）内绘线稿山景：山脊折线 2 层 + 月亮圆 + 水面横线 3 条（'hair'/'ink2'）。onClick：Spring 晃 rotZ ±3.5°（音 wobble）。hover：微倾 1.2°。
8. **makeChime**（id:'chime', label:'风铃', pos:[4.25,0,0.55], rotY:0）
   吊绳从天花板 y4 到 y≈3.0；顶盘（ellip）+ 5 根长短不一铝管（cyl 细, r0.012, 长 0.16..0.30, 悬于盘缘）+ 中心垂坠（小棱锥）。常摆：整体绕吊点 rotX=sin(t*0.9)*1.2°，各管相位差摆动。onClick：阵风——Spring kick，管子大幅摆动 3s 内衰减 + chimeStrike(3)。吊扇开启时摆幅 ×2.2（读 fan.speed, 容错）。hover：管子轻颤。
9. **makeFan**（id:'fan', label:'吊扇', pos:[7.0,0,1.9], rotY:0）
   吊杆 y4→3.62；电机罩（cyl r0.09）+ 4 叶片（长0.55 的斜置薄板, fill:'paper', 各自绕轴心 rotY 自旋）+ 护圈（circ r0.58 两圈 + 3 根辐条, 'hair'）+ 拉绳（细线+末端小珠, 挂在电机侧）。`this.speed` 0..1 惯性趋近目标（加速 2.5s / 减速 3.5s）。onClick：拉绳下拉 0.05 弹回（音 click + thunk 轻）+ 切换 on/off + fanStart/fanStop。旋转：叶片 set({rotY: 叶相位 + speed 累计角})。fanRate(speed) 每帧更新（容错）。hover：拉绳微摆。
10. **makePendant**（id:'pendant', label:'吊灯', pos:[4.8,0,3.3], rotY:0）
    吊杆 y4→3.52；灯罩（圆台 cyl topR0.05 r0.30 h0.18, fill:'paper', 开口向下）+ 灯泡圆（y≈3.44）。`this.on` = Env.lightsOn。开灯：灯泡亮（fill rgba 暖光, alpha 随环境）、FX.glow 暖光晕（夜间明显/昼间极淡）。onClick 同步 `Env.setLights(!Env.lightsOn)`（音 switchToggle）+ 罩体 Spring 轻晃。hover：罩体微转 4°。

### C. objects_study.js
11. **makeDesk**（id:'desk', label:'书桌', pos:[2.8,0,0.52], rotY:0）
    桌面 1.7×0.72 厚0.045（顶面 y0.76）+ 4 腿(0.05 方) + 背板 + 侧望板；桌面上放：摊开的笔记本（两页线）+ 铅笔（细六棱）。onClick：桌面轻微起伏一晃（Spring y 或 rotX 0.6°, 音 wobble 轻）。hover：极轻微下沉 0.004。pick 区域=桌面+腿。
12. **makeChair**（id:'chair', label:'椅子', pos:[2.8,0,1.42], rotY:12）
    木椅：座面 0.46² 厚0.035（y0.46）+ 4 腿（前腿直后腿延伸成背柱）+ 背板两横档。onClick：推进/拉出（局部 z ±0.5, cubicInOut 0.7s, 音 slide + 末端 thunk）。hover：整体微转 2°。按压下沉。
13. **makeLamp**（id:'lamp', label:'台灯', pos:[2.12,0.76,0.48], rotY:0）
    底座圆台 + 立杆两节（微弯折）+ 灯罩圆台（fill:'paper'）+ 开关小拉环。`this.on`。onClick：开关（音 switchToggle；夜间/Env 暗时 FX.glow 暖光 + 灯下桌面光池 fill rgba）；开/关罩体 Spring 晃。hover：灯罩朝镜头微转 6°。点亮时灯泡小圆变亮。
14. **makeCup**（id:'cup', label:'杯子', pos:[3.28,0.76,0.6], rotY:0）
    杯体（cyl topR0.042 r0.036 h0.095）+ 把手弧 + 杯口椭圆 + 碟盘（ellip 0.075）。**持续蒸汽**：每 0.5s 一个 FX.puff（小, 慢升, 'steam'），hover 时改 0.22s。onClick：蒸汽爆发（一次 8 粒 puff + 音 puff）+ 杯身 Spring 微晃。
15. **makeBookshelf**（id:'bookshelf', label:'书架', pos:[0.17,0,1.55], rotY:90）
    架体 1.6 宽（局部 x）×0.32 深×2.05 高，4 层隔板+侧板+背板（fill:'paper'）；三层放书 12~16 本（不同高 0.19..0.26/厚, fill:'paper', 书脊线 1~2 条 'hair', 个别倾斜书 rotZ 8°）；顶格放小相框+收纳盒。**三本互动书**（各自独立 part 组, label 分别「旧书」「厚书」「红封皮书」）：onClick 拉出 0.14（Tween 0.45s cubicOut, 音 pageFlip, 推回 slide）。第三本为「夹信的书」：拉出 >70% 时斜插出一张纸条 part（alpha 淡入, 音 pageFlip），推回隐藏。书架本体 onClick：轻微摇晃（Spring 轻）。hover：三本书各微探出 0.015。
    注：三本书必须是独立 pickable part 组且深度正确；书本被拉出方向 = 局部 +z。

### D. objects_lounge.js
16. **makeDresser**（id:'dresser', label:'五斗柜', pos:[0.27,0,3.7], rotY:90）
    柜体 1.6 长×0.52 深×0.95 高 + 4 短腿；正面（局部 +z）上两层抽屉（各占半宽）+ 下层对开柜门（fill:'paper', 把手圆点）；柜顶面可用。**两个抽屉 + 一扇左柜门可开合**：onClick 判定点击了哪个前脸 part，各自 openT 0/1（抽屉 move 出 0.30 / 柜门绕侧铰链 rotY -95°, 音 drawerMove/doorMove 轻）；抽屉内腔 fill:'void' + 内放折叠衣物线条/小盒子（'detail' 线）。hover：对应抽屉/门微露 0.012。pick 前脸各 part 独立。
17. **makeRecordPlayer**（id:'player', label:'唱片机', pos:[0.30,0.955,3.42], rotY:90）
    机身 0.44×0.36×0.10（fill:'paper'）+ 控制排（两个旋钮圆+拨杆）；转盘（ellip r0.15 两圈）+ 黑胶（circ r0.135 + 纹路弧线 3 条 hair + 中心标签圆 fill rgba 淡暖）; 唱臂（两级杆, pivot 在右后角, 静置角度 -18°, 播放 8°）+ 唱臂底座；透明掀盖（斜立 fill:null 线框, 微透明 fill rgba)。`this.playing`。onClick：切播放——唱臂 Tween 落针（0.7s）→ 转盘/唱片从 0 加速到 33⅓ 转/分（转速字段惯性趋近, 唱片与纹路旋转）+ vinylStart；停止：抬臂归位 + 转速衰减 + vinylStop。hover：唱臂微抬 2°。播放时唱片整体绕心轴 set({rotY:累计角})。
18. **makeGlobe**（id:'globe', label:'地球仪', pos:[0.30,0.955,4.18], rotY:0）
    支架底座（圆盘+短柱）+ 弧形子午支架（circ arc）+ 球体 r0.115：赤道圈 + 3 条经线弧（不同经度 ellip 压扁/竖圆）+ 2 条纬线 + 大陆感示意折线 4~5 段（'hair'）；球轴倾斜 23°（整体组绕 x 倾斜构建）。`this.spin` 速度（rad/s，摩擦衰减 ×exp(-0.8dt)）。onClick：spin += 3.2（音 wobble 轻）；球体每帧 set({rotY:累计角, pivot:球心})。hover：微晃 1°。
19. **makeSofa**（id:'sofa', label:'沙发', pos:[8.42,0,4.8], rotY:-90）
    三人位线稿沙发：底座箱体 + 3 块坐垫（fill:'paper', 前缘圆角线）+ 3 块靠垫 + 两侧卷臂（cyl 横置）+ 4 短脚 + 底缘线；靠垫/坐垫上加 'hair' 缝线与一处 hatch 轻影。onClick：整体 Spring 下沉回弹 0.012（音 pop 轻）。hover：靠垫微鼓（scale 1.01）。
20. **makePillow**（id 由 opts.id 传入 'pillowA'/'pillowB', label:'抱枕', pos 与 rotY 由 main 传入）
    方枕 0.42×0.42 斜靠姿态（先构建直立薄枕再整体后倾 18°+rotY）：fill:'paper' + 表面纹样（一个格纹线 + 一个圆点纹, 'hair'）+ 缝边。onClick：压扁（scaleY 0.82 绕底缘, backOut 回弹带 Spring 余振, 音 pop）+ 微跳起 0.03 落回。hover：微微鼓起 1.03。
21. **makeCoffeeTable**（id:'table', label:'茶几', pos:[6.55,0,4.8], rotY:0）
    椭圆面（ellip rx0.62 rz0.42, y0.40, fill:'paper'）+ 4 斜腿 + 下层搁板（y0.14, 放 2 本平叠书 + 小碗线）。onClick：整体 Spring 晃（y 或 rot 0.5°, 音 wobble）。hover：微沉 0.004。
22. **makePlant**（id:'plant', label:'盆栽', pos:[6.28,0.40,5.12], rotY:0）
    陶盆（圆台）+ 5~7 片叶（细长弧线叶片, 各自 pivot 在盆口）+ 一根短茎。常摆：每叶 sin(t*1.3+相位)*2°。onClick：叶片颤动加剧 Spring（音 swish 轻）。hover：叶摆幅 ×1.8。
23. **makeRug**（id:'rug', label:'地毯', pos:[6.75,0,4.8], rotY:0, layerBias:-0.6）
    圆角矩形 3.4×2.4（y=0.006, fill:'paper', 双重边线圈 + 内部对角 hatch 稀疏 + 四角回纹短线, 全 'hair'/'ink2'）。onClick：拍打一下——整体 y 弹动 + 在点击处 FX.puff 尘埃（col:'warm' 少量, 音 swish 轻）。hover：边线圈加粗即可（线宽已自动）。

## 8. 通用验收清单（每个 Agent 交稿前自查）

- [ ] `node --check js/<file>` 通过
- [ ] 所有工厂注册进 `ROOM_PARTS`，可重复调用
- [ ] 只使用 SPEC 第 4 节 API；AudioKit 调用名与第 5 节逐字一致
- [ ] 每个可交互对象有中文 label；hover/press/onClick/持续动态均已实现
- [ ] 动画全部走 Tweens/Spring，无瞬间跳变；颜色全部来自 Env.C
- [ ] part 数量适度（单对象 ≤220 个）；小圆 segs ≤28
- [ ] 文件头注释：负责对象清单 + 每个对象的交互说明
