# 音乐节奏联动与镜头动力学编排指南 (Rhythm Sync & Camera Choreography)

本文档归纳了《world.execute(me);》工程中如何实现音乐节拍（BPM）、虚拟镜头运镜（Camera Choreography）与瞬态视觉特效（FX）的精准视听联动。

---

## 1. 节拍网格基准参数

- **BPM**：145.50
- **四分音符周期（Beat Interval）**：$\approx 0.412371\text{ s}$ (412.37 ms)
- **八分音符周期（Half Beat）**：$\approx 0.206186\text{ s}$
- **十六分音符周期（Quarter Beat）**：$\approx 0.103093\text{ s}$
- **音频 onset 静音补偿**：$0.1300\text{ s}$

---

## 2. 镜头运镜时空切换模型

全片共编排 70+ 个高精度镜头节点（`CAMERA_SHOTS`），支持以下 4 类切换模式：

| 运镜模式 | 特征与数学函数 | 典型适用场景 | 音乐对位 |
| :--- | :--- | :--- | :--- |
| **硬切 (Hard Cut)** | 瞬时阶跃函数（Step Function），时间差 $\Delta t = 0$ | 局部特写跳切、象限瞬切 | 鼓点重音拍（Downbeat）或电音 Stab |
| **极速甩镜 (Whip Pan)** | 5阶平滑多项式（Quintic Easing / Smoothstep）：<br>$S(u) = 6u^5 - 15u^4 + 10u^3$，时长 $0.35\sim 0.50\text{ s}$ | 横向卡片扫过（如 Card 2 -> 3, 5 -> 6） | 伴随军鼓滚奏与定向运动模糊（Motion Blur） |
| **缓动推进 (Ease In-Out)** | 3阶余弦或贝塞尔缓动，时长 $0.8\sim 1.5\text{ s}$ | 开篇微观拉至宏观大版、终局退回全景 | 抒情弦乐段落与情绪转折 |
| **缩放潜入 (Zoom Dive)** | 指数级视距深潜（Zoom 5.33 -> 35.0），时长 $0.60\text{ s}$ | Card 3 底部黑洞潜入 -> Card 4 副歌爆点 | 踩镲滚奏爆发与瞬时黑屏反转 |

---

## 3. 荷兰角（Dutch Angle）倾斜动力学

为了增强日系 Vocaloid 的动感与不安感，在 `timeline.js` 的相机状态中引入 `rot` 弧度参数：
- **常态探索**：水平校准 $\text{rot} = 0.0$。
- **快节奏 Verse 与副歌**：交替微倾斜 $\text{rot} = \pm 0.08 \sim \pm 0.14\text{ rad}$（$\approx 4.5^\circ \sim 8.0^\circ$）。
- **12 连击处刑 Drop**：每一击跟随重鼓正负交替倾斜（$-0.08 \rightarrow +0.08 \rightarrow -0.06 \dots$）。
- **大版鸟瞰**：自动平滑复位至 $\text{rot} = 0.0$ 水平直角，保证工业设计印刷大版的严谨感。

---

## 4. 后处理与打击感三阶叠加（Multi-stage Impulse Stacking）

在 `renderer.js` 中，每个渲染帧将实时叠加三层节拍动力学：
1. **微动呼吸脉冲（Beat Pulse）**：
   $$\text{pulseZoom} = 1.0 + k_{\text{scale}} \cdot \exp(-6.0 \cdot \text{phase}(t))$$
   副歌时 $k_{\text{scale}} = 0.020$，intro 时 $k_{\text{scale}} = 0.003$。
2. **重击物理震屏（Screen Shake）**：
   在 12 个 EXECUTION 击打点（147.4s, 147.8s, 148.8s...）激发高频伪随机震动位移 `(shakeX, shakeY)`，结合指数衰减（Decay Rate = 16.0）。
3. **光电打击瞬态（Transient Flash）**：
   在每个大拍或踩点帧激发 **单帧负片差值反转（Difference Inversion Flash）** 与 **RGB 屏幕色差（Chromatic Aberration）**。
