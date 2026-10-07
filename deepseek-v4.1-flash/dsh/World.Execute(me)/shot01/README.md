# world.execute(me); — 程序生成同人 MV

Mili《world.execute(me);》的同人 MV。**画面全部由代码生成**：一个在浏览器里运行的
Canvas / WebGL2 程序，每一帧都是时间 `t` 的**纯函数**，逐帧计算并编码成 1920×1080 @ 60fps
的视频成品。

> 原曲：Mili – world.execute(me);（专辑 *Miracle Milk*, 2016）
> 本作是非商业同人作品，音频版权归 Mili 所有。

---

## 成品

```
out/world.execute(me)_MV_1080p60.mp4       1920×1080 · 60fps · H.264 24Mb/s + AAC · 222.000s  (674 MB，母版)
out/world.execute(me)_MV_1080p60_web.mp4   同上，CRF 23 压缩版（便于分享/上传）
```

视频长 **222.0 s**，比歌曲本体（211.91 s）长出约 10 s：多出来的部分是
「世界重启 / 标题卡」尾奏，也让画面首尾相接成一个循环。

### 校验结果

```
$ node _dev/qa.mjs
duration     : 222.000 s        > song 211.91s  OK
video        : h264 1920x1080 @ 60/1              OK
video frames : 13320                              OK
pix_fmt      : yuv420p                            OK
audio        : aac 44100Hz 2ch                    OK
decoding all frames to verify stream integrity…   no decode errors
```

「每帧是 t 的纯函数」不是口头承诺，而是可执行的测试 —— 把同一批帧**打乱顺序、
并在中间插入无关帧**渲染两遍，逐帧比对像素哈希：

```
$ node _dev/determinism.mjs
frame        passA         passB         match
   137   1424328300   1424328300  OK
  6600   3522786678   3522786678  OK
 13100   1235506171   1235506171  OK
DETERMINISTIC: every frame is a pure function of t (order-independent, no hidden state).
```


---

## 快速开始

### 当播放器用（浏览器里实时播放）

```bash
cd World.Execute\(me\)/shot01
node _dev/server.mjs --port=8791     # 需要 HTTP 服务（ES module + fetch 资源）
# 浏览器打开 http://127.0.0.1:8791/index.html
```

空格播放/暂停，←/→ 逐帧步进。页面会把音频和画面同步播放。

### 重新渲染整支 MV

```bash
cd World.Execute\(me\)/shot01/_dev
node start-chrome.mjs --port=9333          # 一个长期运行的无头 Chrome
node capture.mjs --start=0 --end=13320 --chunk=900 \
     "--out=out/world.execute(me)_MV_1080p60.mp4"
```

渲染进度会写进 `_dev/tmp/capture-state.json`；**中断后直接重跑同一条命令即可续渲**
（H.264 码流按字节精确回滚到检查点，不会重复或丢帧）。

---

## 设计约束：每一帧都是 t 的纯函数

这是整个项目的核心约束，代码里处处遵守：

* 没有任何 `Math.random()`；所有"随机"都是 `hash(i)`、`hash33(p)` 之类的确定性哈希。
* 没有上一帧的累积缓冲（无 feedback / trail buffer），画面不依赖历史。
* 不读挂钟时间。`renderFrame(i)` 只做 `t = i / 60`，同一帧在任何时刻、任何机器上重跑都完全一致。
* 音频分析结果**离线烘焙**成 `assets/analysis.json`（每帧的 bass/mid/high/RMS/flux + 拍点表），
  运行时只做查表插值，因此在渲染过程中不依赖任何实时音频状态。
* 颗粒噪声用 `hash(gl_FragCoord, floor(t*60))`，同样是 t 的函数。

```
renderTime(t) = Scene(v(t)) → Text(v(t)) → Bloom → Composite(v(t))
                其中 v(t) = visualAt(t, music)   ——   score.js
```

---

## 目录

```
index.html            播放器页面；?t=<秒>&still=1 定格某一帧，?capture=1 进入渲染模式
js/
  main.js             WebGL2 渲染器：几何/粒子/文字/泛光/合成
  shaders.js          全部 GLSL：世界 SDF、粒子与字形广告牌、泛光、CRT 合成
  score.js            「总谱」：段落、歌词时间点、镜头运动、所有动画参数
  music.js            烘焙音频数据的查表与包络
  text.js             字形图集（两套字重）+ 实例化屏幕文字
  glutil.js           WebGL 小工具
  capture.js          逐帧渲染 → WebCodecs H.264 (Annex-B) → 流式回传
assets/
  analysis.json       离线烘焙的逐帧音乐特征（60Hz）
  JetBrainsMono-*.ttf 字幕/终端字体
  world.execute(me).mp3
_dev/                 开发与渲染工具链（不进成品）
  server.mjs          静态服务 + H.264 分块落盘（支持按字节精确回滚）
  start-chrome.mjs    启动长期运行的无头 Chrome
  capture.mjs         分段渲染 + 断点续渲 + 与音轨封装
  qa.mjs              成品校验 / 抽帧
  determinism.mjs     纯函数性验证
  bake-audio.mjs      离线音乐特征烘焙
  tempo.mjs           速度/相位搜索
  shot.mjs            单帧预览
out/                  成品
```

---

## 渲染管线

```
                    ┌──────────────── 每一帧 ────────────────┐
 t = frame / 60  →  │ world shader (raymarch + 网格 + 轨道环) │
                    │        ↓  (RGBA16F FBO)                 │
                    │ 26k 点精灵 + 15k 字形广告牌（世界由文字构成）
                    │        ↓                                │
                    │ 文字层（歌词 / 终端 HUD / 标题卡）        │
                    │        ↓                                │
                    │ 泛光 3 级 mip + 色散 + 扫描线 + 颗粒     │
                    └────────────────────────────────────────┘
                                     ↓
                    VideoEncoder (H.264, 24 Mb/s, GOP 2s)
                                     ↓  fetch POST /chunk
                    本地服务按序落盘 → ffmpeg 与音轨封装
```

选择在**页面内**编码而不是逐帧截图，是因为它逐帧确定性、且能在 GPU 上跑到 ~28fps，
整支 MV 约 9 分钟渲完；同时避免了逐帧 PNG 落盘带来的数十 GB 中间文件。

---

## 音乐与画面结构

离线分析（`_dev/bake-audio.mjs`、`_dev/tempo.mjs`）测得：

| 量 | 值 |
|---|---|
| 脉冲 | 130.18 BPM |
| 拍 | 65.09 BPM（4/4） |
| 小节 | 1.840 s |
| 歌曲长度 | 211.907 s |

段落与画面（详见 `js/score.js`）：

| 时间 | 段落 | 画面 |
|---|---|---|
| 0:00 | 上电 | 电力线亮起，世界从噪声中聚拢 |
| 0:01 | 对象创建 | 点阵凝结成形，终端打出 `world.create(object);` |
| 0:15 | 世界浮现 | 镜头后拉，数据球体、地面网格与轨道环全貌 |
| 0:30 | 爱的几何 | 四句歌词对应四种几何演示：点→维度、圆、正弦波、无穷 |
| 0:44 | 交流 / 直流 | 波形形变、画面抽搐、数字在 A.D./B.C. 间倒转 |
| 0:59 | 执行世界 | 线框立方体（模拟的边界）显形，节拍冲击波扫过 |
| 1:14 | 茄子 / 番茄 / 猫 / 神 | 形态在圆环、心形、螺旋间蹦跳 |
| 1:29 | 性别 / 时辰 / 角色 | 镜像翻转、绕轴滚动、螺旋入神 |
| 1:43 | 隔离 | 世界被扯散成尘埃，只剩核心孤零零跳动 |
| 2:09 | 虚空 | 近黑的空景，少量残骸 |
| 2:28 | EXECUTION | 暖色警报，五次「执行」脉冲，倒数以六种语言计数 |
| 2:44 | 终曲 | 世界重新聚成一颗心 |
| 2:56 | 爱的代数式 | 平静环绕，慢慢溶解成字符星尘 |
| 3:08 | 困在爱里 | 消散、淡出 |
| 3:32 | `world.execute(me);` | 世界重启，标题打出，光标闪烁，归于黑 |

---

## 工具链

* **Chrome 154**（无头，CDP 驱动）— 渲染
* **WebCodecs `VideoEncoder`** — 页面内 H.264 编码
* **ffmpeg 9.0.2** — 音轨封装 / 分析 / 校验
* **JetBrains Mono** — 字幕字体
* **whisper.cpp（经 ffmpeg whisper 滤镜）** — 歌词段落定位（base.en）

所有下载物（音频、字体、whisper 模型、yt-dlp）都只落在本工作目录内。

---

## 版权

* 音乐：Mili — world.execute(me);（词曲 Yamato Kasai / Cassie Wei，专辑 *Miracle Milk*）
* 歌词文本仅用于同人字幕展示
* 画面：100% 程序生成，无外部图像素材
