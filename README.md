# AI Benchmark

用于测试和比较 AI 能力的作品与源码仓库。

- `prompts/`：原始任务提示词，按任务类型整理。
- 各模型目录：保留工具环境、任务名称和 `shot` / 修订版本的原有层级。
- 每个作品的运行方式、素材来源和评测记录见其目录内的 README。

## 获取完整交付物

图片、视频、音频、字体、体素及二进制模型等文件使用 Git LFS。克隆前安装 Git LFS，然后执行：

```sh
git lfs install
git clone https://github.com/l4place0/ai-benchmark.git
cd ai-benchmark
git lfs pull
```

## 文件管理

保留源码、提示词、素材、最终交付物、展示截图和评测记录。临时渲染片段、浏览器用户数据、缓存、日志和原始 PCM 等中间产物不纳入版本控制。

`node_modules`、Python 虚拟环境、便携 Node / FFmpeg / Chrome 和下载的模型属于本地运行依赖，不上传；需要重建作品时，请按各项目说明准备对应依赖。预览和分析脚本直接引用的随附 JavaScript 库及许可证保留在仓库中。
