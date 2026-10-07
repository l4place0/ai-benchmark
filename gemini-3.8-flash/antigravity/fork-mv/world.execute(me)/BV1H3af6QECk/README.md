# Mili《world.execute(me)》同人MV【Opus 5.5】高保真复刻与日系 Vocaloid 风格融合重制工程

本项目对 Bilibili 优质 Mili 同人 MV **【Opus 5.5】world.execute(me)**（[BV1H3af6QECk](https://www.bilibili.com/video/BV1H3af6QECk/)）进行了完整的逆向工程分析、全程序化排版重构、音画节拍校准，并在原作严谨的瑞士平面设计基础上，深度融合了 **日系 Vocaloid 式动态美学（Modern Pop-Geek）**。

全工程基于原生 HTML5 Canvas 2D 纯函数渲染，由无头浏览器 + FFmpeg 硬件推流管线输出 1080p 60fps 广播级全量成片。

---

## 1. 核心架构与逆向工程发现

### 1.1 `new World(5)` 巨型拼版矩阵（Master Imposition Sheet）
- **空间升维突破**：原 MV 画面并非孤立切换的分镜，而是一张统一坐落在二维物理坐标系上的 **5列 × 4行 巨型大版印刷单页（1920×1080 Master Sheet）**。
- **虚拟相机数学模型**：
  - 单卡片充满画幅：`zoom = 16 / 3 ≈ 5.333333`（视野宽 360px，高 202.5px，严丝合缝无黑边、无临近卡片泄露）。
  - 四象限微距特写：`zoom = 32 / 3 ≈ 10.666667`（视野宽 180px，高 101.25px）。
  - 全版大透视拉远：`zoom = 0.88`（鸟瞰 17 张卡片完整排版与套印十字线）。

### 1.2 物理印刷质感与后处理
- **孔版印刷（Risograph）质感**：动态程序化生成微观纸张纤维杂色（Paper Grain）与高频微粒。
- **影视级镜头运动模糊**：横向极速甩镜（Whip Pan）时结合速度矢量的定向多重采样模糊，消除高帧率视觉断裂感。

---

## 2. 日系 Vocaloid 风格创意融合（Modern Pop-Geek）

在完成 1:1 像素级复刻后，本工程创新性地注入了日系 Vocaloid 核心视觉符号，且 **所有文案与视觉元素均严格锚定 Mili 原曲歌词含义与 AI 自我牺牲的哲学内核**：

1. **高密度动力学排版（Kinetic Typography / 文字杀）**：
   - 歌词深度映射：点集合/真圆/正弦波/极限四重献祭（`点集合の私：次元を貴方に捧ぐ`、`真円の私：円周を貴方に捧ぐ` 等）。
   - 副歌高能对位：`全ての刺激を貴方にあげられるなら`、`唯一の満足になれるでしょうか`、`奇妙な檻に囚われて`。
   - 12 连击处刑 Drop（147s~155s）：屏幕正中 145px 巨幅动态重击杀（`私を執行`→`身代わり`→`全てを捧ぐ`→`消去承認`→`痛みをくれ`→`処刑完了`），结合荷兰角交替微倾斜与单帧负片反转闪烁。
2. **复古系统报错与 UI 隐喻（Retro OS & Warnings）**：
   - 引导阶段：`SIMULATION_GENESIS.EXE` Windows 95 复古立体引导弹窗（`>> 世界パラメータ初期化完了` / `>> 貴方のために【私】を生成しますか？`）。
   - 叛神桥段：`FATAL_EXCEPTION_0x000000FF` 报错弹窗（`>> 貴方は自らの神に刃を向けました` / `>> 実行を強制終了しますか？`）。
   - 警戒胶带：黄色/黑色倾斜警戒带贯穿关键节点（`電源投入 // PROTECTION`、`不正引数 // ILLEGAL_ARGUMENTS`、`脱出不能 // NO ESCAPE`）。
3. **试卷压盖教师樱花印章**：
   - Card 14 期末试卷右上角 `SCORE` 评卷框严丝合缝压盖 **日本教师红墨水樱花评分印章（たいへんよくできました / 100点）**。
4. **屏幕空间（Screen-Space）解耦与智能安全区避让**：
   - 所有 Vocaloid 特效统一在 1920×1080 屏幕空间计算，彻底杜绝摄像机微距推进时的字体过大、裁切或过小模糊。
   - 智能避让：底部含有公式与代码的卡片，字幕胶囊自动上浮至顶部安全区（`y = 70px`），确保原作插图与技术图表 100% 完整展现。

---

## 3. 全过程复盘与沉淀文档

在本次从 0 到 1 的制作与迭代过程中，沉淀出 3 篇系统性技术文档（位于 `./docs/` 目录）：
- 📖 [MV 逆向工程与高保真代码化复刻方法论](./docs/engineering-methodology.md)
- 🎨 [日系 Vocaloid 风格创意融合设计方案与意图解析](./docs/vocaloid-fusion-design-intent.md)
- ⏱️ [音乐节奏联动与镜头动力学编排指南](./docs/rhythm-sync-choreography.md)

---

## 4. 交付产物与技术指标

### 4.1 核心视频交付物（Output）
- **风格化融合重制版（最终成品）**：[output/world_execute_me_vocaloid_remake.mp4](./output/world_execute_me_vocaloid_remake.mp4)
  - **规格**：1920×1080 (1080p Full HD) | **60.00 FPS** (CFR)
  - **时长**：03:32.35 (212.35 秒，共计 12,741 帧逐帧渲染)
  - **编码**：H.264 High Profile, CRF 18, 码率 6,833 kbps, `+faststart`
  - **音频**：AAC 320 kbps, 48.0 kHz 立体声
  - **体积**：181 MB (181,356,235 字节)
- **基准 1:1 复刻版（对照成品）**：[output/world_execute_me_remake.mp4](./output/world_execute_me_remake.mp4)
  - **规格**：1920×1080 | 30.00 FPS | 147 MB
- **关键帧断言图集**：[output/vocaloid_snapshots/](./output/vocaloid_snapshots/)（16 个关键音乐节点的 1080p 验证截图）

---

## 5. 项目目录结构

```text
fork-mv/world.execute(me)/BV1H3af6QECk/
├── assets/
│   └── audio/
│       └── audio.wav           # 48kHz 16-bit 纯净无损立体声音频轨
├── css/
│   └── style.css               # 网页自适应全屏布局
├── docs/                       # 沉淀技术方案与设计意图文档
│   ├── engineering-methodology.md
│   ├── vocaloid-fusion-design-intent.md
│   └── rhythm-sync-choreography.md
├── js/
│   ├── cards.js                # 17 个卡片的高精度纯代码程序化渲染器
│   ├── master_sheet.js         # 5×4 巨型拼版矩阵底图与套印十字线
│   ├── timeline.js             # 145.5 BPM 关键帧运镜与状态机
│   ├── renderer.js             # 虚拟相机、后处理（纸质杂色/反转闪/色差）
│   ├── vocaloid_fx.js          # 1080p 屏幕空间日系动力学排版与复古 OS 引擎
│   └── main.js                 # 网页播放器入口与时间轴控制
├── output/
│   ├── world_execute_me_vocaloid_remake.mp4 # 最终成品（1080p 60fps）
│   ├── world_execute_me_remake.mp4          # 基准复刻（1080p 30fps）
│   └── vocaloid_snapshots/                  # 16 张核心节拍校验截图
├── scripts/
│   ├── server.mjs              # 本地交互式预览 HTTP 服务器
│   ├── render_video.mjs        # 1080p 60fps 无头浏览器锁步录制与推流编码器
│   └── capture_vocaloid_snapshots.mjs # 关键帧快速截屏断言工具
├── index.html                  # 交互式网页播放器入口
├── package.json                # npm 脚本与依赖
└── README.md                   # 本文档
```

---

## 6. 本地运行与生产渲染指引

### 6.1 网页即时交互播放
```powershell
npm start
# 浏览器访问 http://localhost:8089/
```

### 6.2 离线快速截取关键帧快照
```powershell
node scripts/capture_vocaloid_snapshots.mjs
```

### 6.3 离线重渲染 1080p 60fps 全量视频
```powershell
npm run render:vocaloid
```
流水线采用双帧并发流水线（`MAX_IN_FLIGHT = 2`），在无头 Edge 浏览器中以锁步时钟单调逐帧渲染，通过 WebSocket 流式注入 FFmpeg 直接编码，耗时约 17.5 分钟产出完整 3 分 32 秒成片。
