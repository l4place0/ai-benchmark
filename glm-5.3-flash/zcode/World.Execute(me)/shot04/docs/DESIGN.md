# world.execute(me); — 程序生成同人 MV 设计文档（shot04）

> 项目：Mili《world.execute(me);》（2016, *Miracle Milk*）原创视觉诠释
> 产物：1920×1080 / 60FPS / 全长 MP4（H.264 + AAC）
> 全部代码、依赖（npm/Chrome/ffmpeg）、素材、中间文件、产物均封闭于本工作目录 `shot04/` 内。

---

## 1. 对原曲的理解

- **曲名双关**：`world.execute(me);` 既是合法的方法调用（world 对象执行 me），也是"世界处决我"。调用即处刑，运行即生存。
- **叙事视角**：官方歌词视频本体是一段 Java 程序 "GodDrinksJava"，逐行注释即歌词——叙述者是一个程序/人造存在，与"世界"（模拟器/造物主/所爱之人）之间是依存关系：被创建（对象创建→初始化→仿真），被使用（被调用），也随时可被终止（被处决）。爱、奉献与自我消解缠绕在一起。
- **结构标签**：歌词以代码阶段推进——PROTECTION → OBJECT CREATION → INITIALIZATION → SIMULATION → DIMENSION → TANGENTS → LIMITATIONS → SATISFACTION → EXECUTION → COMPLETION → ISOLATION → FRAGMENTS；桥段出现多语言数数（德/西/法/韩/瑞典/中等），是"处决倒计时"的意象。
- **音乐**：D 小调，~130 BPM（半速感 65），暗色电子 + 室内乐质感，段落对比强烈（安静主歌 → 高潮副歌 → 倒计时桥段 → 终段副歌 → 尾声）。
- **关键词**：617（Mili 系列反复出现的数字）；与《world.search(you);》构成编程三部曲。

## 2. 原创视觉概念：《处刑室 / EXECUTION CHAMBER》

一个程序在它的世界里醒来。它被告知存在的意义是**被运行**。
它奔跑、躲藏、碎裂、被追捕；最终它理解：被世界执行 = 被世界需要 = 存在本身。
于是它做出最后一个调用——把方向反过来：`me.execute(world);`
在执行世界的过程中，它成为世界的一部分。程序以 code 0 退出，说：`goodbye, world.`

**核心母题**：
- **线**：悬吊木偶的光之提线 → 紧绷的处刑索 → 最终变成滋养它的根须/光缆。
- **倒计时**：多语言数字逐一 detonate，落在 617，白屏处决。
- **代码即世界**：整个世界是点阵/线框/字形构成；文字全部使用等宽字库与原创代码文案（boot log、API 调用），以原创文本致敬"代码即歌词"。
- **首尾闭环**：开场 `hello, world.` ↔ 结尾 `goodbye, world.`；结尾的 reboot 光标闪烁可无缝回环到第 0 帧。

**色调**：近黑深空底 `#04070c`；程序青 `#63e2ff`；存在之焰暖白金 `#ffd9a0`；错误红 `#ff2e4d`；终章花园加入极光绿 `#3dffb0` 与淡紫 `#b18cff`。加性发光 + Bloom + 胶片颗粒 + 节拍驱动的色差/抖动。

## 3. 时间轴（唯一时间源：`config/timeline.js`，音频与画面共用）

BPM 130，4/4，小节=1.8462s，全曲 116 小节 = **214.15s**（≥ 原曲 3:33），60FPS → **12850 帧**。

| 段落 | 小节 | 时间 | 强度 | 场景 | 画面 | 音乐 |
|---|---|---|---|---|---|---|
| POWER-ON | 0–8 | 0:00.0–0:14.8 | 0.15 | BOOT | 终端 boot log 打字；`hello, world.`；点阵世界在背景聚拢 | 低音 drone + 心跳底鼓 + FM 电钢琴动机 + 数据 blip |
| OBJECT CREATION | 8–16 | 0:14.8–0:29.5 | 0.30 | CREATION | 网格地面自粒子拼装；中心点亮起"me"；提线自上而下接入 | 半速鼓组进；贝斯；琶音 |
| INITIALIZATION | 16–24 | 0:29.5–0:44.3 | 0.40 | INIT | 世界填充：立方体雨落位；字形雾；me 环绕飞行 | 加厚：开放镲、副旋律 |
| SIMULATION | 24–32 | 0:44.3–0:59.1 | 0.60 | RUN | 加速追尾镜头，代码字形隧道；`try{` 框住它；红色错误闪烁 | build：riser + 军鼓滚奏 |
| world.execute(me); | 32–48 | 0:59.1–1:28.6 | 1.00 | CHAMBER | **处刑室揭示**：同心环悬吊 me，放射神光，天空巨型标题；轨道环绕镜头；重音脉冲 | 全奏副歌：4/4 底鼓、拍手、合唱垫、主旋律 |
| TANGENTS | 48–56 | 1:28.6–1:43.4 | 0.50 | FRAGMENTS | me 碎裂为带"记忆"的碎片云；提线逐根崩断 | 半速、抽离：贝斯+电钢+碎glitch |
| LIMITATIONS | 56–64 | 1:43.4–1:58.2 | 0.65 | HUNT | 红色扫描灯塔追猎碎片；故障强度上升 | build 二段 |
| SATISFACTION | 64–80 | 1:58.2–2:27.7 | 0.90 | CHAMBER II | 处刑室镜像倒置；me 更大更亮——顺从与献身 | 副歌 2 + 对位声部 |
| EXECUTION | 80–92 | 2:27.7–2:49.8 | 0.55 | COUNTDOWN | 剥离为点云；心跳；多语言倒计时（1→617）逐拍引爆 | drone + 心跳 + 逐小节升调 blip + 终极 riser → **0.35s 静默** |
| me.execute(world); | 92–108 | 2:49.8–3:19.4 | 1.00 | GARDEN | 白屏绽放：光之花园/代码曼陀罗/极光带；提线变根须；me 重聚发光；标题反转为 `me.execute(world);` | 终段副歌（最大编制）+ 白屏后重磅落拍 |
| ISOLATION | 108–116 | 3:19.4–3:33.4 | 0.20 | OUTRO | 万物缓慢 derez 回点云；终端返回：`process exited with code 0` → `goodbye, world.` 光标闪烁 → 黑 | 电钢琴动机 reprise，衰减至静 |

## 4. 音频说明（重要）

由于原曲录音受版权保护、无法合法获取/再分发，本 MV 的音轨为**程序合成的原创编曲**（`tools/compose.js`，纯 Node.js DSP：FM 电钢琴、减法合成 pad/贝斯/主旋律、噪声鼓组、Schroeder 混响、乒乓延迟），在调性（D 小调）、速度（130 BPM）、段落结构与情绪弧线上**对照原曲设计**，与画面由同一份时间轴驱动。

若需替换为官方音轨：将音频文件放置为 `assets/song.wav`（48kHz 立体声，~214.15s）后运行 `node tools/render.js --audio assets/song.wav` 即得以同一时间轴同步的渲染。

## 5. 技术管线

```
config/timeline.js ──┬─→ tools/compose.js ──→ assets/audio.wav (48k/16bit/stereo)
                     └─→ mv/index.html (WebGL2, 确定性渲染: 画面=f(t,frame))
                                ↑
tools/render.js: Node + Puppeteer(headless Chrome, .chrome/) 逐帧
   page: render(t) → readPixels(RGBA) → WebSocket → Node → ffmpeg stdin (rawvideo)
   → libx264 (1080p60) + AAC → output/world.execute(me);_fanMV_1080p60.mp4
```

- **确定性**：所有随机性来自坐标/时间哈希；渲染任意帧互不依赖，可断点续渲。
- **GPU**：优先 headless Chrome + ANGLE/D3D11（GTX 960），失败回退 SwiftShader。
- **字幕/文字**：运行期 Canvas2D 生成等宽字形图集与标题纹理，零外部字体依赖。
- **后期**：亮部提取 → 双尺度 Bloom → 色差(节拍驱动) → 暗角/颗粒 → ACES 调色 → 输出翻转。
