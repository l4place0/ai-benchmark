# world.execute(me); — procedural fan MV, take 03 "orrery"

Mili《world.execute(me);》(Miracle Milk, 2016) 的程序生成同人 MV **第三版**。
画面 100% 由 Canvas/WebGL 程序实时计算，**每一帧都是时间 t 的纯函数**，逐帧离线渲染成 1080p60 视频。
（shot01 为终端/机房风格，shot02 为白纸提线木偶剧场；本版为全新视觉：黄铜浑天仪 + 星野的"世界机器"剧场。）

## 成品

- `out/world.execute(me)_fanMV_1080p60_take03.mp4` — 1920×1080 / 60fps / H.264 (High@5.1, ~14Mbps) + AAC 192k，时长 218.0s（歌曲 212.33s + 片尾 5.7s）
- `mv/index.html` — 交互版：浏览器直接打开 `mv/index.html`（双击即可，经典脚本无 CORS 限制），点击画面播放（含声音），Space 暂停，←/→ 快进 ±5s

## 概念：Orrery（星轨仪 / 世界机器）

世界是一台巨大的黄铜浑天仪。小人被"世界" prescribed 在一条行星轨道上——
轨道即命运，执行即存在。随着歌曲推进：星轨仪组装 → 齿轮咬合 → 轨道图表（切线/近点/渐近线）→
行星被反复 repaint（eggplant/tomato/tabby）→ 逆行错误（红色警报 + stack trace 雨）→
六次倒数处刑（EIN/DOS/TROIS/NE/FEM/LIU，与唱词逐拍同步）→ 她化为星光 → 在世界中心重燃为太阳，
心形轨道包裹（r = 1 − sin θ），但机器从此绕她运转（"though you are free, I am trapped in orbit"）→
最后一次 EXECUTION 白闪 → 心电平线 → 黑暗中一颗新星球亮起："hello, world."

## 纯函数架构

- 所有动画 = f(t)：节拍网格（**BPM 130.00，beat0 = 0.233s**，相位锁定得分 3 倍于次优候选）、
  60Hz 烘焙能量包络（bass/high/flux/rms → 16384×1 RGBA 纹理）、12 段落状态机（全部吸附到小节线）、
  131 条 LRC 歌词 cue（网易云 API，互相关对齐 +0.07s）、连续的环角度积分（分段速度表，跨段落连续）
- 无 wall-clock、无 Math.random（mulberry32 播种 / hash(t)），无跨帧累积；
  `window.__selftest()` 在页面内渲染 t=61.234 → t=99.555 → t=61.234 并比较像素哈希 —— `det: true`
- 分层渲染：GL2 射线步进（3 黄铜环 SDF + 刻度/齿 + 行星 + 22 胶囊小人 + 背景齿轮盘 + 星野/星云）
  → GL 点粒子（轨道微尘 / 处刑爆散 / 花瓣 / 红色火花，全部由 seed+t 解析计算）
  → 2D 画布艺术层（轨道图表、星座、观测日志、大字标题、倒计时、心形轨道、心电、片尾）
  → GL 内后期（色差、故障切片、闪白、暗角、颗粒、扫描线、tonemap）

## 段落（12 幕，全部吸附到 130BPM 小节线）

| t | 幕 | 内容 |
|---|-----|------|
| 0:00–0:16.8 | void | 黑暗观测站启动，黄铜环自平面向三维组装，小人醒来伸手 |
| 0:16.8–0:29.8 | ignite | "world.execute(me);" 标题砸落（色差重影），齿轮组咬合升速 |
| 0:29.8–0:59.3 | orbit | 三张天体力学图表：轨道&切线 / 近远点 / 逃逸渐近线 |
| 0:59.3–1:14.1 | wheels | 副歌：相机俯冲穿越环面，节拍频闪切镜，STIMULATIONS/SATISFACTION/EXECUTION 金字 |
| 1:14.1–1:43.6 | rewrite | 行星按歌词重涂（eggplant→tomato→tabby），人物换位 |
| 1:43.6–1:56.5 | aurora | 自旋-轨道共振，青色涟漪逐拍扩散 |
| 1:56.5–2:05.8 | alone | 拉远至极远，小人独立于小行星，"the catalog no longer lists me" |
| 2:05.8–2:27.9 | retro | 逆行错误：齿轮卡顿倒转、红色堆栈雨、ILLEGAL ARGUMENTS 印章、画面撕裂 |
| 2:27.9–2:42.7 | exec | 处刑：EXECUTION 红字频闪，环逐段收缩，EIN→LIU 六次倒数（与 LRC 逐拍同步），爆发成星尘 |
| 2:42.7–3:25.2 | sun | 她在核心重燃为太阳，心形轨道（r=1−sinθ）包裹，花瓣飘落；歌唱的每一次 EXECUTION 都让太阳耀发；临近结尾心形长出铁栏与挂锁 |
| 3:25.2–3:32.3 | last | 最后一次 EXECUTION 白闪 → 绿色心电平线 "vital(sign) = FLATLINE" |
| 3:32.3–3:38 | hello | 黑暗中星点亮起，"hello, world." 打字机 + 制作名单，淡出 |

## 渲染管线

```
mv/index.html + timeline.js + mv_core.js + mv_main.js（经典脚本，file:// 双击可跑）
        ↓ puppeteer + Chrome for Testing 154（下载于 render/.chrome，GPU: ANGLE/D3D11, GTX 960）
window.__renderFrame(t) → 1920×1080 → WebCodecs VideoEncoder（avc1.640033，页内硬件编码，AnnexB）
        ↓ 流式写入 .out/video.h264（每 60 帧排空，故障自动续渲）
        ↓ tools/ffmpeg.exe（-c:v copy + aac 192k，apad 对齐 218.0s，+faststart）
out/world.execute(me)_fanMV_1080p60_take03.mp4
```

命令：`cd render && node main.js samples`（79 关键帧抽样）| `node main.js full`（全片，失败自动续渲）|
`node main.js probe <t>`（单帧）| `node main.js selftest`（确定性自检）| `node main.js encoders`

## 素材与工具（全部位于本工作空间内，均为互联网下载）

- 音频：Mili 官方 B站频道 MV (BV1ds411e7df) 音轨，AAC 164kbps / 48kHz / 212.331s → `mv/audio/song.m4a`
  （经 B站 web API 直取最高码率 DASH 音频流，`analysis/fetch_audio.js`）
- 歌词时间轴：网易云 API LRC 131 行（song id 435278010），互相关对齐偏移 +0.07s → `analysis/netease_lyric.json`
- 工具：`tools/` ffmpeg/ffprobe 6.1.1 静态版（npmmirror ffmpeg-static）、便携版 Node v22.21.1（`tools/node/`）、
  Chrome for Testing 154（`render/.chrome/`）；`render/node_modules` puppeteer + @fontsource 字体（OFL：
  JetBrains Mono、Cinzel，已复制到 `mv/fonts/`）
- 分析脚本：`analysis/`（BPM/节拍相位/能量包络/LRC 对齐，全部 workspace node 可复现）

## 版权说明

音乐版权归 Mili 及其厂牌所有；本视频为个人学习用途的同人创作（fan work），非商用。
