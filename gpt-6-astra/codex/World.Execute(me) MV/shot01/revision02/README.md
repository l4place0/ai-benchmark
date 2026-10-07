# 第二版：按音乐重做剪辑

第一版的问题：把社区歌词时间当作切镜表，许多动作仍按绝对秒数匀速运动；虽然视频规格正确，音乐剪辑并没有得到有效验证。

## 本次修改

- 音源改为 Mili 官方账号 ProjectMili 的公开视频音轨：https://www.bilibili.com/video/BV1ds411e7df/ 。保存为 `../assets/song-official.m4a`，时长 212.3305 秒。
- Essentia 的多特征拍点检测 + 实际音轨频谱通量，拟合约 130.002 BPM、0.244 秒的节拍相位；再在 ±38ms 窗口内对齐局部瞬态峰值。
- 446 个拍点，114 个镜头节点。结构切镜与人声弱起分别处理，不把每句歌词开始的时刻直接当作小节重拍。
- 主歌保留较长乐句；副歌按小节改变机位；连续执行按两拍交替；数字段使用单独的音节事件；失联处暂停主要运动；尾声减慢剪辑。
- 花瓣开合、圆环扩散、镜头冲击、碎片甩出由实际拍点触发。删除第一版的固定暗场转场和大部分持续显示的小字。
- 每帧以音轨时间求值，最终编码使用恒定 60 FPS。保留第一版，以便比较。

## 文件

- `output/world.execute-me_v2_1080p60.mp4`：修订完整成片。
- `output/proof_0.mp4`：原曲 56–76 秒的带声音节奏校准样片。
- `output/proof_1.mp4`：原曲 146–163 秒的带声音节奏校准样片。
- 样片底部：竖线表示拍点，金色表示小节起点，红色标记表示切镜；正式成片没有此校准条。
- `analysis/timing-audit.json`：实际分析方法和旧版部分切镜偏移。
- `output/edit-points.csv`：帧号、切镜位置及其对应拍点。
- `output/verification.json`：最终成片的编码及时间轴检查。

自动检测的拍点是剪辑依据，不代表已逐字人工听审。检查中的 8.334ms 上限只指将已选落点量化到 60FPS 帧网格的误差，不等同于音乐理解误差。

## 复现

在 shot01 下双击 `render-v2.cmd` 重新渲染，`preview-v2.cmd` 打开浏览器预览。改动视觉后需移走 `revision02/renders/segment_*.mp4` 与对应 `.done` 文件再导出。

分析代码：`../tools/rhythm-v2.cjs`、`../tools/timeline-v2.cjs`。
视觉代码：`src/film-v2.js`。`src/direction.js` 保存新版镜头编排主体。
渲染代码：`../tools/render-v2.cjs`，使用本机浏览器 WebCodecs 硬件编码；无支持时自动改用本地软件编码。

新增分析依赖 Essentia.js 0.1.3（AGPL-3.0），已置于 `../tools/essentia/package`，许可文件随包保留。原有 HDR 素材与依赖说明见 `../docs/ASSETS.md`。所有本次文件均保存在 shot01 内。

