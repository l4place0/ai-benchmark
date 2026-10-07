# 《时光画廊》共享规格（各 Agent 必须遵守的契约）

项目根：`Time Gallery/shot01/`（下文所有相对路径均以它为根）。
纯浏览器、单机、离线。运行时零外部请求（无 CDN、无外链图片、无外部字体）。

## 0. 文件所有权（并行工作，禁止越界写文件）

| 拥有者 | 可写文件 |
|---|---|
| 主控(main) | `index.html`, `js/main.js`, `js/data.js`, `README.md`, `tools/*`, `server.js`, `SPEC.md` |
| UI Agent | `css/style.css`, `js/ui/welcome.js`, `js/ui/timeline.js`, `js/ui/detail.js` |
| 3D Agent | `js/gallery3d/*.js`, `js/gallery3d/gallery.css` |
| 内容 Agent×3 | `data/manifest_<period>.json`, `assets/paintings/<period>/**` |

三个参与者都会读：本文件、`vendor/three/`（只读）、`js/data.js`（只读）。

## 1. 技术底座

- Three.js r0.170.0 已 vendor：`vendor/three/three.module.js`，addons 位于 `vendor/three/addons/**`。
- 页面用 importmap（`index.html` 已写好）：`"three"` → `./vendor/three/three.module.js`，`"three/addons/"` → `./vendor/three/addons/`。
- 所有代码为 ES Module，本地静态服务器（`node server.js`，端口 8021）启动。
- 不引入任何其他库；UI 动画用 CSS + 少量 JS（rAF）。
- 字体只用系统字体栈（如 `"Palatino Linotype", Georgia, "Microsoft YaHei", "PingFang SC", sans-serif`），标题 font-weight 800–900。**禁止外部字体**。

## 2. 数据契约（manifest）

`data/manifest_<period>.json` 每时期一个文件（内容 Agent 产出），主控合并生成 `data/manifest.json`：

```json
{
  "period": {
    "id": "impressionism",
    "nameZh": "印象派",
    "nameEn": "Impressionism",
    "years": "1860–1890",
    "introZh": "2–3 句中文简介，用于时间轴详情卡与画作详情面板。",
    "accent": "#4f7cac",
    "coverPaintingId": "monet-impression-sunrise",
    "painters": [ { "nameZh": "克劳德·莫奈", "nameEn": "Claude Monet", "years": "1840–1926" } ]
  },
  "paintings": [
    {
      "id": "monet-impression-sunrise",
      "file": "assets/paintings/impressionism/monet-impression-sunrise.jpg",
      "titleZh": "印象·日出",
      "titleEn": "Impression, Sunrise",
      "artistZh": "克劳德·莫奈",
      "artistEn": "Claude Monet",
      "artistBirth": "1840",
      "artistDeath": "1926",
      "year": "1872",
      "period": "impressionism",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:...",
      "license": "Public Domain（来源：Wikimedia Commons, PD-Art）",
      "width": 1280,
      "height": 996
    }
  ]
}
```

- 8 个时期 id 固定（按时间顺序）：`renaissance`(1400–1600), `baroque`(1600–1750), `rococo`(1715–1770), `neoclassicism`(1750–1820), `romanticism`(1780–1850), `impressionism`(1860–1890), `post-impressionism`(1885–1910), `modernism`(1900–1950)。
- `paintings[].file` 必须真实存在且为 JPEG；`width/height` 为实际文件像素（用 `tools/imgsize.mjs` 校验后填写）。
- 授权仅允许：Wikimedia Commons PD-Art / Met Open Access CC0 / AIC 公有领域。
- 画作 id：`<artist-slug>-<work-slug>` 小写 kebab；文件名 = id + `.jpg`。

## 3. index.html 结构（主控提供，Agent 只挂接，不改结构）

```html
<body>
  <main id="app">
    <section id="screen-welcome" class="screen"></section>
    <section id="screen-timeline" class="screen"><div id="timeline-root"></div></section>
    <section id="screen-gallery" class="screen">
      <canvas id="gallery-canvas"></canvas>
      <!-- 3D Agent 在此 section 内自建 HUD/DOM，样式放 gallery.css -->
    </section>
    <div id="detail-root"></div>
  </main>
  <div id="veil"></div> <!-- 主控的转场遮罩，样式由 css/style.css 提供 -->
</body>
```

屏幕切换：`.screen.active` 显示；转场由主控用 `#veil`（透明→不透明→透明，缓动 cubic-bezier(.4,0,.2,1)）完成。

## 4. 模块接口

### js/ui/welcome.js（UI Agent）
```js
export function mountWelcome(rootEl, { onStart }) // 挂载欢迎页内容; onStart 由主控在“开始”按钮 click 时调用
export function animateWelcomeIn()  // 入场动画（每次 show 调用）
```

### js/ui/timeline.js（UI Agent）
```js
export function mountTimeline(rootEl, { periods, paintings, onSelectPeriod })
export function animateTimelineIn() // 树状展开动画（初始状态后缓缓展开，非线性）
export function hideTimelineCards() // 点击节点后由主控调用，收起详情卡
```
- `paintings` 用于取每个时期封面图（`coverPaintingId` 对应项的 `file`）。

### js/ui/detail.js（UI Agent）
```js
export function mountDetail(rootEl)             // 创建唯一面板 DOM（全局仅此一份）
export function openDetail(painting, period)    // 已打开时必须 no-op（防重复叠加）
export function closeDetail()                   // 播放关闭动画
export function isDetailOpen()
```
- 面板：fixed 定位 `inset:24px`（四周保留 24px 画廊可见区域），半透明暗背景透出画廊；左侧大图（保持原始宽高比、不拉伸），右侧完整信息（中文标题/英文标题/画家中英文名/生卒年/年代/所属时期/时期简介/来源 URL 文本/授权说明）。
- 打开/关闭均有动画（translateY+scale，缓动 cubic-bezier(.22,1,.36,1)，≥350ms）；关闭按钮 hover/press 有动画；面板自身监听 Esc 关闭。
- 面板打开期间不得因连按 E 产生第二个面板（openDetail 幂等 + 主控层面禁用画布输入双保险）。

### js/gallery3d/gallery.js（3D Agent）
```js
export function createGallery(canvasEl, { onPaintingClick, onExitTimeline }) → {
  enterPeriod(period, paintings), setEnabled(bool), setVisible(bool), resize(), dispose()
}
```
- `setEnabled(false)`：只停交互（键盘/鼠标/raycast/HUD 提示），**必须继续渲染**（详情面板打开时背景画廊要保持可见）。
- `setVisible(false)`：停渲染循环省 GPU（切回时间轴时主控调用）；`setVisible(true)` 恢复。
- `enterPeriod(period, paintings)`：period 为 manifest 中的时期对象，paintings 为该时期画作数组；建筑一次建好，换时期只换画作/铭牌。
```
- 内部自建 HUD（准星、提示、暂停遮罩、返回按钮），样式写 `js/gallery3d/gallery.css`（由 index.html 引入）。
- 点击/按 E 选中画作 → `onPaintingClick(painting)`（painting 为 manifest 对象）。
- 入口拱门触发区或 HUD 按钮 → `onExitTimeline()`。

## 5. 主控流程（主控实现）

加载 `data/manifest.json` → 欢迎页 →（开始）→ 时间轴 →（点击时期）→ veil 转场 → 画廊 `enterPeriod` →（点击画作）→ `openDetail`（画廊 `setEnabled(false)`）→（Esc/关闭）→ `setEnabled(true)` →（返回）→ veil 转场 → 时间轴（重播展开动画）。

## 6. 视觉与动效总则

- 统一暖色博物馆美学：羊皮纸底 `#f3ecdd` 系、深蓝 `#2b4a9b`、金 `#c8a24b`、朱红点缀；UI 无黑色边框按钮。
- 所有进入/hover/press 动画使用非线性缓动，如 `cubic-bezier(.22,1,.36,1)`、`cubic-bezier(.34,1.56,.64,1)`；禁止整体线性。
- 每个可点击元素必须有 hover 与 active(:press) 反馈。

## 7. 3D 画廊硬性要求（3D Agent）

- 万神殿式圆厅：环形鼓座墙 + 半球穹顶（带凹方格藻井数圈）+ 顶部天窗洞（可见 Sky 天空）+ 大理石地面（镜面反射）。
- 真几何建筑细节：壁柱（带柱头/柱础）、拱券（Shape+Extrude）、齿饰（小方块列）、线脚（torus/盒带）、藻井、圆厅中心地面拼花。
- 材质：程序化 Canvas 大理石纹理（暖白/蜜色/灰纹等变体）+ 金色金属（画框、藻井描边）；PBR（MeshStandard/PhysicalMaterial）。
- 光照：天窗下射 SpotLight（castShadow，2048 shadow map）+ 每画一盏暖色 SpotLight + HemisphereLight 环境 + PMREM 环境贴图（RoomEnvironment）+ Sky 通过天窗可见。
- 后处理：EffectComposer → SSAOPass（AO）→ UnrealBloomPass（轻微）→ OutputPass（ACES 色调映射）。
- 控制：Pointer Lock；W/↑ 前、S/↓ 后、**A/← = 向左 strafe、D/→ = 向右 strafe**（实现：以 `new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion)` 为世界右方向，A 取负、D 取正，禁止凭感觉写符号）；鼠标转向，pitch 限 ±75°；玩家限制在半径 R-1.2 的圆内。
- 反黑洞：所有面必须有材质；门洞通向有暖光的门厅过渡空间（尽头发光渐变板）；天窗必须透出天空；全场景禁止无意义的大面积近黑区域。
- 画作：按 manifest 的 `width/height` 保持真实宽高比（等比缩放到墙面适配高度），横画横框、竖画竖框；金框 + 底部铭牌。
- 性能：pixelRatio ≤ min(dpr,1.75)；几何用 Instancing；帧率过低（<30fps 持续 3s）自动降级关闭 SSAO。

## 8. 内容下载规则（内容 Agent）

- 优先 Wikimedia Commons API：`https://commons.wikimedia.org/w/api.php?action=query&titles=File:<名>&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1400&format=json` → `thumburl` 下载（UA：`TimeGalleryEdu/1.0 (offline art-history game; contact dev@example.com)`）。
- 备用 Met Open Access：`collectionapi.metmuseum.org` 搜 `primaryImage`（授权 CC0）；再备用 AIC IIIF。
- 校验：文件头为 JPEG(FF D8)/PNG、>20KB、可用 `node tools/imgsize.mjs <file>` 读尺寸并回填 manifest。
- sourceUrl 填可回溯的页面 URL（Commons 文件页 / Met object 页）；license 写明（PD / CC0）。
- 单画失败→同画家/同时期替换作品，不许空缺；尺寸：宽度≥1000px（超宽壁画允许 2000px）。

## 9. 验收对照（开发时自查）

详见任务书：A/←向左、D/→向右；画作无变形；详情面板唯一；无外部请求；无大块黑洞；8 时期/20 画家/50 画作；manifest 每项有 sourceUrl+license。
