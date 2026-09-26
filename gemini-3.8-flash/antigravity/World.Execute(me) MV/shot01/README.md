# ⚡ Mili《world.execute(me);》完整同人 MV // 全曲无损 1080p60 成品

> **基于浏览器原生 Canvas / WebGL 程序化生成 · 每一帧均为时间 $t$ 的纯函数 · 1080p 60FPS 逐帧锁步渲染成品**

---

## 📖 项目概述

本项目为独立乐团 **Mili** 的传世神作**《world.execute(me);》**制作的**全长程序化同人音乐视频（MV）成品**。

* **原曲时长**：3 分 32 秒（212.35 秒）
* **视频成品全长**：**3 分 36 秒（216.00 秒）**（严格大于歌曲时长，含尾声终端休眠与光标闪烁结算画卷）
* **渲染规格**：**1920 × 1080 Full HD @ 60.00 FPS**，共计精确计算并合成 **12,960 帧**！
* **音画标准**：H.264 High Profile 视频编码 + 320 kbps AAC 立体声无损音轨，`+faststart` 流式元数据前置。
* **画面纯度**：100% 浏览器原生程序实时绘制，无任何外部视频素材贴片。

---

## 🎯 核心技术特色

### 1. 严格的时间纯函数架构（Pure Function: $\text{Frame} = f(t)$）
* **数学闭式确定性**：每一帧的画面状态完全由当前时间自变量 $t$ 计算得出，杜绝任何 `requestAnimationFrame` 累加漂移（如 `x += v * dt`）；
* **任意时间定格回溯**：跳跃至任意时间点（如 $t = 186.0\text{s}$），绘制结果在像素级 100% 确定且完全可复现；
* **节拍冲激解析式**：结合歌曲 145.5 BPM 节拍，采用指数衰减解析式计算节拍能量：
  $$\text{beatPhase} = \left(\frac{t}{T_{\text{beat}}}\right) \bmod 1.0, \quad \text{beatImpulse} = \exp(-4.5 \times \text{beatPhase})$$

### 2. 双运行模式设计
* **模式 A：实时交互式播放器（Interactive Player）**
  * 在浏览器中直接打开，内置高保真无损音频播放；
  * 支持毫秒级时间轴滑动、全曲 30+ 场景下拉快速跳转、播放/暂停、全屏切换；
  * 保持 1920×1080 内部超清画布，自适应屏幕比例与全屏渲染。
* **模式 B：无头逐帧锁步渲染管线（Headless Lock-Step Video Renderer）**
  * 自动化调起 Chromium / Edge 无头实例，按 $t_n = \frac{n}{60}$ 进行逐帧推进；
  * 画布渲染完成一帧即通过 WebSocket 流式推送到工作区本地 FFmpeg；
  * 零掉帧、零撕裂，高精度压制成 1080p 60FPS H.264 + 320kbps AAC 完整音画同步 MP4 视频成品。

### 3. 严格合规约束
* **工作空间局部化**：所有工具（`ffmpeg-static` 二进制文件、`ws` 模块）、字体及无损音频素材均下载并安装在当前工作区内，无任何系统全局环境污染。

---

## 🎨 画面场景与全曲 10 大乐章结构

| 乐章 | 时间段 ($t$) | 歌词唱段 | 视觉呈现与数学算法 |
|---|---|---|---|
| **第一幕：系统开机** | 0.0s ~ 16.0s | *Power line / Protection / Pieces / Object Creation / Initialization / Simulation* | 高压母线通电电弧、三层同心六边形护盾、等轴测棋盘拓扑、3D正二十面体欧拉旋转、双环内存加载进度条 |
| **第二幕：数学几何** | 16.0s ~ 44.4s | *Points (Dimension) / Circle / Sine wave / Infinity* | 3D代码雨穿梭、**4D超正方体（Tesseract）多平面投影**、金色极坐标圆环与切向速度矢量、正弦波动态切线 $m=\frac{dy}{dx}$、渐近线 $\lim_{x \to \infty} f(x)$ 与脉冲无穷大符号 $\infty$ |
| **第三幕：电流与时空** | 44.4s ~ 58.0s | *AC to DC / Blind vision / A.D to B.C / Unite* | 双通道示波器交流转直流整流平波、频闪强光爆破与RGB色差偏移、双螺旋时间旋涡量子纠缠与融合 |
| **第四幕：初次高潮** | 58.0s ~ 74.0s | *Stimulations / Satisfaction / Execution / world.execute(me);* | 全屏频闪报警边框、动态巨幅断续文字冲击、粒子核爆扩散、第一乐章终极指令 `world.execute(me);` 居中震击 |
| **第五幕：生化重构** | 74.0s ~ 88.5s | *Eggplant / Tomato / Tabby cat / God existence* | **3D DNA双螺旋结构旋转**与碱基对发光、25Hz猫咪呼噜声波共振图样、神圣几何光芒与观测者效应认证 |
| **第六幕：极性回旋** | 88.5s ~ 103.5s | *Gender (F/M) / AM to PM / Role (S/M) / The trance* | 二进制位翻转符号（♀/♂）、24小时昼夜雷达扫描、主从总线翻转、八角星万花筒催眠迷幻隧道 |
| **第七幕：孤寂与报错** | 103.5s ~ 133.5s | *Vibrations / Completion / Isolation / Fragments / Disheartened / Illegal arguments* | 波动涟漪波纹、测地线全息球体闭合、丢包率100%孤寂虚空地平线、内存碎片消解爆破、心形破裂网格、非法参数异常警告框 |
| **第八幕：蓝屏与狂暴** | 133.5s ~ 162.5s | *BSOD Kernel Panic / Execution spam / Multilingual countdown* | **经典复古蓝屏（BSOD）物理内存倾倒**、满屏狂暴倾泻的 `EXECUTION` 倾斜图章（Fork炸弹模拟）、EIN / DOS / TROIS / NE / FEM / LIU 多语言巨型数字狂闪 |
| **第九幕：代数之爱** | 162.5s ~ 191.0s | *Execution purge / Proper LOVE / Algebraic expression of LOVE* | 全局进程排他性清理、爱之代数方程解算、**三维心形线参数方程 $(x^2+y^2-1)^3 - x^2 y^3 = 0$** 霓虹光芒成型 |
| **第十幕：死循环与尾声** | 191.0s ~ 216.0s | *while(true) this.love('you'); / world.execute(me); / Epilogue* | 嵌套分形递归爱心跳动、`while(true)` 语法高亮代码框、终极爆破、宁静黑屏终端：`[SIMULATION TERMINATED] Exit Code: 0` 与光标闪烁 |

---

## 📁 目录结构

```text
world.execute(me)/shot01/
├── assets/
│   └── audio/
│       └── world-execute-me.wav    # Mili 原版无损音频素材 (3:32.35)
├── css/
│   └── style.css                   # 赛博朋克控制台与全屏自适应样式
├── js/
│   ├── engine3d.js                 # 3D/4D 透视投影与几何体数学算法 (Tesseract, DNA, Polyhedra)
│   ├── main.js                     # 纯函数帧分发器与双模式核心控制器
│   ├── timeline.js                 # 歌词时间戳、代码片段与全曲场景定义
│   └── visuals.js                  # 全曲 20+ 主题视觉场景纯函数渲染器
├── output/
│   ├── shot01.mp4                  # 最终交付：1080p 60FPS 音画同步完整视频 (03:36.00)
│   ├── cover_4x3.jpg               # 4:3 官方同人黑客/数学美学画集封面
│   └── snapshots/                  # 各乐章关键帧的高清截图留存
├── scripts/
│   ├── capture_snapshots.mjs       # 关键场景截图自动化脚本
│   ├── render_video.mjs            # 1080p60 逐帧锁步渲染导出脚本
│   └── server.mjs                  # 本地静态交互 HTTP 服务
├── node_modules/                   # 工作区本地安装的工具与依赖（ffmpeg-static, ws）
├── index.html                      # 浏览器 WebGL/Canvas 主页面
├── start.bat                       # Windows 一键启动交互播放器脚本
└── README.md                       # 项目说明文档
```

---

## 🚀 启动与运行方式

### 1. 观看完整 1080p 60FPS 视频成品
视频文件位于：
```text
world.execute(me)/shot01/output/shot01.mp4
```
* **时长**：**00:03:36.00 (216.00 秒)**（大于原曲 212.35 秒）
* **分辨率**：**1920 × 1080 (1080p)**
* **帧率**：**60.00 fps (共 12,960 帧逐帧生成)**
* **视频编码**：H.264 High Profile (yuv420p, CRF 18)
* **音频编码**：AAC 320 kbps 立体声 44.1 kHz
* **元数据**：`+faststart` 保证即点即播

### 2. 在浏览器中体验实时交互式播放器
#### 方法 A：双击运行（推荐）
双击运行目录下的：
```cmd
start.bat
```
将自动启动轻量服务并在浏览器中打开 `http://localhost:8080/`。

#### 方法 B：命令行启动
```bash
node scripts/server.mjs
```
访问 `http://localhost:8080/`。

### 3. 重新导出渲染任意时长视频
```bash
node scripts/render_video.mjs 216
```
即可自动启动无头渲染管线。
