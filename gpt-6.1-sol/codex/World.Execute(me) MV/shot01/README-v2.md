# world.execute(me); — 爱的验收机

完整程序生成同人 MV 的第二版。音乐为 Mili《Miracle Milk》原版录音，原曲实测 212.362449 秒。成片以 60 个固定时刻/秒计算动画，1920×1080，覆盖全曲及短尾署名。

## 观看

- `output/v2/world-execute-me_paper-theatre_1080p60.mp4`：完整第二版。
- `output/v2/watch.html`：离线播放器，含十个章节入口。
- `output/v2/contact-sheet.jpg`：全曲关键画面索引。
- `output/v2/verification.json`：尺寸、帧率、时长、全片解码、原曲音轨相关性、音画时差及文件 SHA-256。

旧版仍在 `output/world-execute-me_1080p60.mp4`，没有覆盖。

## 创作变化

本片使用原创可动纸偶与可折叠剧场。蓝色纸偶通过改造自身邀请另一位黄色纸偶，纸带先承担连接、支持和亲密，随后保存记忆并成为重演的回路。对方自己选择离开；重演产生的投影始终无法替代回应。后半段纸偶、舞台、动作与空位都带着早先关系的痕迹。

两位角色没有设定固定性别，造型、服装与领舞位置可以交换。前半段保留食物变形、猫般姿态与舞蹈的乐趣，后半段用等待、缺席、剪断和身体缺损改变同一动作的意义。这是原创解读，不声称为歌曲的官方剧情。

画面有 42 个镜头时间段。视线、邀请手势、等待、双人舞步、离开、记忆剪影、机械重演、损失、配对图案及门内外空间对照均由程序控制。文字仅用于片名、少量场景内标记与署名。没有用解释性旁白字幕承担剧情。

全曲段落和歌词位置人工编排到时间轴；步态与重复动作使用原曲 130 BPM、首拍偏移 0.213 秒作为周期基准。它不依赖实时播放的帧速度。保存、跳转、逐帧渲染都对音乐时间独立求值；随机纸纤维使用固定种子。完整导出使用每段 1200 帧的独立浏览器会话，随后直接拼接编码视频，原曲音轨统一合成一次。

## 来源与素材

- 音乐：[Mili 官方 osu! Featured Artist 页面](https://osu.ppy.sh/beatmaps/artists/331)，本目录原有音乐包与录音。Mili 及相关权利人保留音乐权利。本项目的素材来源不意味着取得通用音乐再发行许可。
- 纸张：[ambientCG Paper002](https://ambientcg.com/view?id=Paper002)，Lennart Demes，CC0；本地文件 `assets/textures/v2/paper-ambientcg.jpg` 从 [Wikimedia 文件页](https://commons.wikimedia.org/wiki/File:Paper002_4K_Color.jpg) 对应原图下载，用于染色纸片和轻微纤维合成。
- 字体：本目录原有 Cormorant Garamond 和 IBM Plex Mono，SIL OFL；许可证在 `assets/fonts/`。
- 角色、纸偶关节、舞台、房屋、鸟、植物、机械、剪影、纸带、动作和镜头全部为本项目原创程序图形。
- 参考研究见 `research/mv-reference-study.md`，参考作品的角色、视频和静帧没有放入成片。

## 复现

在本目录内运行 PowerShell。工具已保存在 `tools/`，无需全局安装。

```powershell
.\render-v2.ps1 --qa
.\render-v2.ps1
.\verify-v2.ps1
```

生成带原曲的样片：

```powershell
.\render-v2.ps1 --sample --start 14.6 --duration 15 --name meeting
.\render-v2.ps1 --sample --start 147.66 --duration 20 --name restoration
```

浏览器源程序预览：

```powershell
.\render-v2.ps1 --preview
```

随后访问 `http://127.0.0.1:9461/`。预览和离线播放器均提供原曲，不需要网络音乐服务。源动画需由 HTTP 提供模块、音频与本地纹理，不能直接双击源 HTML。

## 关键文件

| 文件 | 作用 |
| --- | --- |
| `src/v2/art.js` | 染色纸张、固定纤维、可动纸偶、关节逆运动学与图形道具 |
| `src/v2/mv.js` | 全曲分镜、角色动作、舞台变化、相机、逐帧输出 |
| `src/v2/index.html` | 浏览器 Canvas 和原曲控制 |
| `scripts/render-v2.mjs` | 目录内 Chromium/CDP、HTTP 帧传输与 FFmpeg 合成 |
| `scripts/render-v2-segmented.mjs` | 20 秒分段导出、片段验证、断点继续与原曲统一合成 |
| `scripts/verify-v2.mjs` | 成片媒体与同步验证 |
| `research/v2/storyboard.json` | 实际 42 镜头时间轴与镜头事件 |
| `research/v2/scene-audit.json` | 代表时刻随机跳转前后画面一致性 |
| `logs/v2/` | 当前渲染进度、浏览器与编码日志 |

全片进度位于 `logs/v2/segmented-progress.json`；各段日志位于 `logs/v2/parts/`。重新执行完整导出会验证并复用已经完成的片段。片段文件是中间产物，观看时使用合成后的完整 MP4。

拼接前会移除片段音轨，以消除 AAC 预滚对视频起点的影响。全片音轨从原曲统一编码一次。最终画面索引与检查帧均从合成后的 MP4 提取。

渲染程序把 TEMP、TMP、浏览器用户目录、磁盘缓存、崩溃目录及指定图形缓存重定向到本目录的 `tmp/` 和 `cache/`。新增代码、纹理、样片、中间文件、日志和最终视频均写入本目录或子目录。
