# AI Benchmark Lab

**AI 模型实战评测、横评数据与视频展示实验室。**

用同一批真实创意编程任务横评不同 AI 模型与 Agent 工具链，公开完整过程记录、可复现交付物与评审结论——不是跑分表，而是「同一个需求交给不同模型，谁真的做出来了」的实战对照。

---

## 这是什么

把同一份提示词分别交给不同厂商的模型、在不同 IDE / Agent 工具链里执行，然后保留全部原始产物：源码、素材、中间分析数据、渲染脚本、成片视频、评审意见与复盘结论。

评测结论按 **S / A / B / C / 不合格** 分级，评分理由与反驳意见一并留档，包括被用户当场推翻的自评——失败案例同样是数据。

## 目录结构

顶层为**模型**，其下为**执行工具链**，再下为**任务**，最内层为 **shot / 修订版本**。层级与实际工作目录逐层对应，不做扁平化。

```
<模型>/
└── <工具链>/
    └── <任务名称>/
        └── shot01/  shot02/  revision02/  ...
```

| 模型 | 工具链 | 已评测任务 |
|---|---|---|
| **Claude Opus 5.5** | `antigravity` | World.Execute(me) |
| **DeepSeek v4.1 Flash** | `dsh`, `dsh(cb2api)` | Pure Line Room, World.Execute(me), World.Execute(me) MV, City Corner P1 Plus, Rural China P1 Plus |
| **Gemini 3.8 Flash** | `antigravity`, `codex(agy2api)`, `pi(agy2api)` | World.Execute(me) MV, Sakura Station, City Corner P1 Plus, Rural China P1, Rural China P1 Plus, Pure Line Room, Time Gallery, My Soul Knight, Riding Pelican, fork-mv, fork-website |
| **GLM 5.3 Flash** | `zcode` | World.Execute(me), Pure Line Room, Sakura Station, City Corner P1 Plus, Rural China P1, Rural China P1 Plus, Time Gallery, My Soul Knight, Riding Pelican |
| **GPT-6 Astra** | `codex` | World.Execute(me) MV |
| **GPT-6.1 Sol** | `codex` | World.Execute(me) MV |

> 同一模型经不同工具链执行的记录分开保存，便于区分「模型能力」与「工具链加成」。

### 任务类型

| 类型 | 任务 | 提示词 |
|---|---|---|
| 音乐视频 / 程序化 MV | World.Execute(me) MV | [`prompts/World.Execute(me) MV.md`](prompts/World.Execute%28me%29%20MV.md) |
| 3D 场景 | City Corner P1, City Corner P1 Plus, Rural China P1, Rural China P1 Plus, Sakura Station | [`prompts/场景_3D/`](prompts/场景_3D) |
| WebGL 交互 | Pure Line Room, Time Gallery | [`prompts/WebGL/`](prompts/WebGL) |
| 游戏 / 其他 | My Soul Knight, Riding Pelican | [`prompts/My Soul Knight.md`](prompts/My%20Soul%20Knight.md), [`prompts/Riding%20Pelican.md`](prompts/Riding%20Pelican.md) |

- [`prompts/`](prompts) —— 原始任务提示词，按任务类型整理，是横评的**唯一自变量**。
- 各模型目录 —— 保留工具环境、任务名称与 `shot` / 修订版本的原有层级。
- 每个作品 —— 运行方式、素材来源、渲染参数与评测记录见其目录内的 README。

很多任务会在不同模型下重复出现（如 `Pure Line Room`、`World.Execute(me) MV`），这些重复目录就是**同题横评的对照样本**。

## 获取完整交付物

图片、视频、音频、字体、体素及二进制模型等文件使用 Git LFS。克隆前安装 Git LFS，然后执行：

```sh
git lfs install
git clone https://github.com/l4place0/ai-benchmark.git
cd ai-benchmark
git lfs pull
```

> 未执行 `git lfs pull` 时，二进制文件只会是几百字节的指针文件，视频与贴图无法播放。

## 文件管理

保留源码、提示词、素材、最终交付物、展示截图和评测记录。临时渲染片段、浏览器用户数据、缓存、日志和原始 PCM 等中间产物不纳入版本控制。

`node_modules`、`_build`、Python 虚拟环境、便携 Node / FFmpeg / Chrome 和下载的模型属于本地运行依赖，不上传；需要重建作品时，请按各项目说明准备对应依赖。预览和分析脚本直接引用的随附 JavaScript 库及许可证保留在仓库中。
