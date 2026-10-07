# 素材与依赖来源

## 音乐

作品：Mili — world.execute(me);，Miracle Milk（2016）。
音乐、词与录音的权利属于各自权利人。本项目是未获官方背书的同人视觉创作，不能将项目代码或素材的开放许可理解为对歌曲版权的授权。

音频文件：`assets/song.wav`，公开仓库下载副本，48 kHz / 双声道 / 16 bit PCM，212.288438 秒。
下载地址：https://raw.githubusercontent.com/Lxtharia/world.execute-me/main/song.wav
对应仓库：https://github.com/Lxtharia/world.execute-me
官方作品链接：https://www.youtube.com/watch?v=ESx_hy1n7HA

## 公开视觉素材

Poly Haven `studio_small_09_1k.hdr`，CC0。用于所有金属花瓣、珍珠与金色圆环的真实摄影环境光及反射，而非直接显示背景图片。
https://polyhaven.com/a/studio_small_09
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr

本片没有使用 Mili 官方插画、官方 MV 视频或其他同人视频画面。花体、星场、几何笼、碎片、园林和文字排版均由本工程生成。

## 依赖与工具

- Three.js 0.170.0 与 RGBELoader，MIT，许可文件 `src/THREE-LICENSE.txt`；下载自 jsDelivr 的固定版本。
- Playwright Core 1.51.1，Apache-2.0，包含在 `tools/playwright/package` 内。
- Chromium / Google Chrome 154.0.8037.93，从机器上已有浏览器复制为 `tools/browser`，渲染只调用该目录的副本。
- Node.js v26.4.0，从机器上已有运行时复制为 `tools/node.exe`。
- FFmpeg / FFprobe，从机器上已有安装复制为 `tools` 内便携工具。
- 字体采用本机已有的 Georgia Italic / Courier New，已复制到 assets 并通过本地 @font-face 加载，无外部字体请求。字体保留其原有版权。

所有本任务的下载、生成文件、浏览器用户目录、缓存、临时文件、图像、视频和工具副本都位于 shot01 目录内。未进行全局包安装。浏览器通过显式用户目录、磁盘缓存目录与子进程临时目录隔离。预览与渲染无需外网。

内置图像生成器因为默认写入 `$CODEX_HOME`，与用户的工作目录限制冲突，故未调用。使用公开 HDR 素材代替，并在 WebGL 中建立可实时运动的三维场景。

