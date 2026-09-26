# 🏛️《时光画廊》(Time Gallery)

纯浏览器、单机、完全离线运行的沉浸式西方艺术史科普游戏。

---

## 一、项目简介

《时光画廊》是一个无需后端、零外部网络依赖的沉浸式艺术史单机科普游戏。游戏覆盖西方艺术史八大黄金时期，收录 31 位艺术名家的 56 幅公有领域传世名作，将古典建筑美学与现代交互体验融为一体。

### 核心主流程
**欢迎页 → 树状时间轴 → 第一人称 3D 万神殿画廊 → 画作近全屏详情 → 返回时间轴**

---

## 二、启动与运行方式

本项目为标准单机静态 Web 应用，无需编译构建，无需安装任何 npm / pip 依赖。

### 启动方式 A（Windows 双击启动，推荐）
双击运行项目根目录下的：
```bash
start.bat
```
脚本将自动启动 Node.js 原生轻量服务并打开默认浏览器：`http://localhost:8080/`

### 启动方式 B（命令行启动）
在本项目根目录下执行：
```bash
node scripts/server.js
```
随后在浏览器中访问：`http://localhost:8080/`

### 启动方式 C（任意本地静态服务器）
例如使用 Python 原生模块：
```bash
python -m http.server 8080
```
或直接通过 VS Code Live Server 打开。

---

## 三、艺术史内容与 Manifest 说明

* **艺术史时期数**：**8 大时期**（早期文艺复兴、盛期文艺复兴、威尼斯画派、巴洛克艺术、洛可可艺术、新古典主义、浪漫主义、印象派与后印象派）
* **收录名家大师**：**31 位**（波提切利、达·芬奇、米开朗基罗、拉斐尔、提香、卡拉瓦乔、伦勃朗、维米尔、委拉斯开兹、弗拉戈纳尔、大卫、安格尔、德拉克罗瓦、透纳、莫奈、梵高、塞尚、雷诺阿等）
* **收录经典画作**：**56 幅**（每时期 7 幅，涵盖《蒙娜丽莎》、《维纳斯的诞生》、《夜巡》、《戴珍珠耳环的少女》、《自由引导人民》、《日出·印象》、《星夜》等）
* **版权合规**：100% 公有领域（Public Domain / CC0），原始馆藏来自大都会艺术博物馆、芝加哥艺术博物馆、卢浮宫、乌菲兹美术馆、维基共享资源等。
* **清单位置**：
  * 机器可读全量 JSON：[`js/data/manifest.json`](./js/data/manifest.json)
  * JavaScript 模块：[`js/data/artHistoryData.js`](./js/data/artHistoryData.js)
  * 本地高清画作图片：[`assets/paintings/`](./assets/paintings/)（56 张已校正 JPEG）

每条画作数据均记录：
`id`, `localPath`, `titleZh`, `titleEn`, `artistZh`, `artistEn`, `birthDeath`, `year`, `periodId`, `periodZh`, `periodEn`, `periodDesc`, `sourceUrl`, `license`, `width`, `height`, `aspectRatio`。

---

## 四、核心系统设计与规格

### 1. 欢迎页 (Welcome Screen)
* **背景设计**：包含透视与黄金分割穿插线条，搭配 5 组呼吸律动的涂鸦风半透明柔和色块。
* **蓝色拱门上方布局**：标题、副标题与主按钮整体居于页面上半区，位于深邃古典的罗马蓝色透视拱门上方，垂直间距充裕，**绝不遮挡拱门**。
* **严格无黑边按钮**：全局按钮强制去除黑边，采用金箔微光光晕与弹性非线性悬停动画。

### 2. 树状时间轴 (Tree Timeline)
* **动态生长动画**：时间轴采用 SVG 树状路径，进入时沿主干向枝丫平滑生长舒展。
* **画家分支纯装饰**：派生的名家大师名单采用不可点击的典雅小字（`pointer-events: none`）。
* **悬停卡片直接进入**：悬停时期节点浮现代表作本地图片、年代与简介；卡片内不设冗余“进入画廊”按钮；**直接点击时期节点即可直达对应 3D 画廊**。

### 3. 3D 万神殿艺术长廊 (3D Pantheon Rotunda)
* **第一人称防反向映射**：
  * `W` / `↑`：向前推进；
  * `S` / `↓`：向后退行；
  * `A` / `←`：**严格向左平移**（Strafe Left）；
  * `D` / `→`：**严格向右平移**（Strafe Right）；
  * 鼠标自由转向，支持 Pointer Lock（点击画布锁定，Esc 解锁）。
* **真实立体古典建筑几何**：
  * **藻井穹顶 (Coffered Dome)**：5 环共 140 组实体 3D 凹陷方形凹槽，内设阶梯收分与金雕花网格；
  * **齿饰 (Dentils)**：额枋下方环绕 160 个实体 3D 矩形齿饰块；
  * **壁柱 (Pilasters)**：8 对带有 5 条凹槽与复合柱头的半嵌古典柱；
  * **拱券 (Arches)**：8 处向外凹进的展湾，具备凸起同心线脚与拱顶石；
  * **线脚 (Moldings)**：柱底、腰线与挑檐均具备车削古典轮廓。
* **PBR 光影与防黑洞**：
  * 卡拉拉白大理石漫反射、粗糙度与法线贴图；
  * 采用 `Reflector.js` 实现抛光地面镜面反射；
  * 真实日光阴影与展湾暖光射灯；
  * 万神殿天窗（Oculus）开凿直通 65 米高保真程序化大气散射天幕，**绝无黑色空洞**。
* **自适应真实画框**：
  * 根据画作原始宽高比（`aspectRatio`）动态计算画框比例，宽画配横框，高画配竖框，严禁拉伸变形。

### 4. 画作近全屏详情面板 (Detail Modal)
* **四周 24px 留白**：面板四周精确保留约 24px 画廊背景可见区域，搭配高透毛玻璃蒙版。
* **双栏完整信息**：左侧高清巨幅画作展示，右侧结构化展示中外文名称、生卒年、创作年份、流派深度解读、馆藏来源与公有领域授权。
* **单例防重复与快速响应**：具备状态锁，快速连按 `E` 键不叠层；支持按 `Esc` 键、右上角关闭按钮或点击留白区域优雅退出。

---

## 五、项目工程结构

```
Time Gallery/shot01/
├── index.html                   # 主应用入口 (含 <script type="importmap">)
├── start.bat                    # Windows 单击启动脚本
├── README.md                    # 本文档
├── css/
│   ├── common.css               # 古典博物馆色彩规范、非线性缓动与无黑边按钮约束
│   ├── welcome.css              # 欢迎页（穿插线条、涂鸦色块、蓝色拱门上方布局）
│   ├── timeline.css             # 树状时间轴样式（动态生长、分支、悬停卡片）
│   ├── gallery.css              # 3D 画廊 HUD、准星、提示框、导航条
│   └── modal.css                # 近全屏画作详情面板（24px画廊留白、双栏排版）
├── js/
│   ├── libs/
│   │   ├── three.module.js      # Three.js 核心库 (ES Module, 本地静态化)
│   │   └── Reflector.js         # 平面大理石镜面反射组件
│   ├── data/
│   │   ├── manifest.json        # 56 幅画作全量机器可读清单 (JSON)
│   │   └── artHistoryData.js    # 8 大时期定义、31 位画家与代表作映射 (ESM)
│   ├── systems/
│   │   ├── App.js               # 全局状态机调度器 (Welcome -> Timeline -> Gallery -> Detail)
│   │   ├── WelcomeView.js       # 欢迎屏交互控制器
│   │   ├── TimelineView.js      # 树状时间轴控制器
│   │   ├── GalleryScene.js      # 3D 万神殿建筑建模与 PBR 光影渲染系统
│   │   ├── ProceduralTextures.js# 卡拉拉大理石贴图、天幕与金箔程序化纹理生成器
│   │   ├── FirstPersonControls.js# 第一人称控制器 (WASD严格映射、碰撞、射线交互)
│   │   ├── FrameManager.js      # 依据画作真实比例自适应画框与黄铜铭牌挂载
│   │   └── DetailModal.js       # 详情模态窗控制器 (单例防重锁、ESC关闭)
│   └── main.js                  # 入口初始化引导
├── assets/
│   └── paintings/               # 56 幅本地化公有领域高清画作图片 (*.jpg)
└── scripts/
    ├── server.js                # 原生 Node.js 零依赖本地静态 HTTP 服务器
    ├── curator.py               # 策展抓取与 manifest 生成脚本
    ├── test_3d_systems.mjs      # 3D 渲染与漫游方向单元测试脚本
    ├── test_browser_flow.js     # 端到端无头浏览器全流程自动化测试脚本
    └── verify_all.js            # 64 项综合合规性质检脚本
```
