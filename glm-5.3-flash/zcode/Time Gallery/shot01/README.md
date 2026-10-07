# 时光画廊 · Time Gallery

一个**纯浏览器、单机、离线**运行的沉浸式西方艺术史科普游戏。从欢迎页出发，沿一棵缓缓生长的树状时间轴穿越 8 个艺术史时期，走进万神殿式的第一人称 3D 石材圆厅，在穹顶天光与金色画框之间近距离欣赏 62 幅公有领域名画，点击任意画作即可查阅完整的作品档案。

- **8 个艺术史时期**：文艺复兴 → 巴洛克 → 洛可可 → 新古典主义 → 浪漫主义 → 印象派 → 后印象派 → 现代主义
- **29 位画家**、**62 幅画作**，全部内置本地文件，运行时零外部网络请求
- 真实 PBR 材质、实时光照与阴影、SSAO、Bloom、ACES 色调映射、镜面大理石地板反射
- Three.js r0.170（MIT）已 vendor 至 `vendor/`，无需 npm install

## 启动方式

必须通过本地 HTTP 服务访问（ES Module 与 WebGL 纹理不允许 `file://` 直开）：

```bash
# 方式一（推荐，Node ≥ 18）
node server.js            # 默认 http://127.0.0.1:8021/
node server.js 9000       # 自定义端口

# 方式二（Python ≥ 3.7）
python -m http.server 8021
```

然后浏览器打开 `http://127.0.0.1:8021/`。

## 操作

| 场景 | 操作 |
|---|---|
| 欢迎页 | 点击「开始旅程」 |
| 时间轴 | 悬停时期节点查看详情卡；点击节点进入该时期画廊（画家分支为装饰性文字） |
| 画廊 | `W/A/S/D` 或方向键移动（A/← 向左，D/→ 向右）、鼠标转向、Shift 加速 |
| 查看画作 | 准星对准画作后按 `E` 或点击左键 |
| 关闭详情 | `Esc` / 右上角 × / 点击面板外 |
| 返回时间轴 | 走到入口拱门前按 `F`，或点击右上角「⏎ 返回时间轴」 |

## 目录结构

```
shot01/
├─ index.html              入口（含 importmap）
├─ server.js               零依赖静态服务器
├─ css/style.css           全站 2D UI 样式
├─ js/
│  ├─ main.js              状态机：欢迎页 → 时间轴 → 画廊 → 详情 → 返回
│  ├─ data.js              manifest 读取辅助
│  ├─ ui/                  欢迎页 / 树状时间轴 / 详情面板
│  └─ gallery3d/           3D 画廊引擎（建筑/材质/画作/控制/HUD）
├─ vendor/three/           Three.js r0.170 + addons（本地 vendor，无 CDN）
├─ assets/paintings/       62 幅画作 JPEG（按时期分目录）
├─ data/
│  ├─ manifest.json        合并后的完整作品清单（机器可读）
│  └─ manifest_*.json      各时期原始策展数据
└─ tools/                  build-manifest.mjs（合并校验）、imgsize.mjs（图片尺寸）
```

## 作品与授权

`data/manifest.json` 记录每幅作品的：本地文件路径、中文/英文标题、画家中英文名、生卒年、创作年代、所属时期、**来源 URL**、**授权说明**、原始像素宽高。全部 62 幅均为公有领域：

- Wikimedia Commons（PD / PD-Art 标记）
- The Met Open Access（CC0，备用源）
- Art Institute of Chicago（公有领域，备用源）

重建 manifest：修改任一 `data/manifest_<period>.json` 后运行 `node tools/build-manifest.mjs`（自动合并、校验字段/文件/尺寸并重新生成 `data/manifest.json`）。

## 构建方式

无构建步骤——纯静态站点，直接由 `server.js`（或任意静态服务器）托管即可。开发期修改代码后刷新浏览器即可生效。

## 声明

本项目为教育演示用途。画作图像均来自开放艺术数据源的公有领域扫描件，各作品的原始来源页与授权信息见 `data/manifest.json`。
