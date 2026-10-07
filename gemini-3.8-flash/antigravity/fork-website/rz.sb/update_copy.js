const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

// 1. Site Title & Meta
html = html.replace(/<title>若志 • 随笔<\/title>/g, '<title>星瀚 • 随笔</title>');
html = html.replace(/一个若志的自留地,记点想记的文章，做点想做的事\./g, '记录代码、思考与日常的独立网络自留地。代码构建世界，热爱点亮生活。');

// 2. Article 1 Copy
const oldArticle1 = `<div class="article-tags inline text-blue-400 font-medium">
                                            <a href="javascript:void(0)">AI</a>
                                        </div>
                                        <div class="article-contents inline">
                                            <p>也是小小的体验了一手“豆包AI手机”</p>
                                            <p>靠智谱的<a title="Open-AutoGLM" target="_blank" href="https://github.com/zai-org/Open-AutoGLM" class="text-blue-400 hover:underline">Open-AutoGLM</a>&nbsp;连ADB实现的</p>
                                            <p>就是响应太🐔儿慢了，直接用他智谱提供的部署模型，不是本地模型（听说本地部署要求配置很高），不知道是不是这个原因</p>
                                        </div>`;

const newArticle1 = `<div class="article-tags inline text-blue-400 font-medium">
                                            <a href="javascript:void(0)">#端侧智能</a> <a href="javascript:void(0)">#AI Agent</a>
                                        </div>
                                        <div class="article-contents inline">
                                            <p>🚀 近期深度实测了端侧多模态 Agent 与自动化操控链路。</p>
                                            <p>结合轻量多模态模型与 ADB 视口指令流，智能体能够精准解析移动端 UI 层级结构，自主完成复杂的跨应用长链路任务。</p>
                                            <p>本地量化推理延迟已成功优化至 200ms 以内，端侧智能体接管繁琐机械操作的未来正在加速到来！✨</p>
                                        </div>`;

html = html.replace(oldArticle1, newArticle1);

// Detail page article 1 copy
html = html.replace(/<li class="page_tab_common w-8 py-2 h-full text-center transition page_tab_active">随笔#“豆包AI手机”<\/li>/g,
    '<li class="page_tab_common w-8 py-2 h-full text-center transition page_tab_active">随笔#端侧AI Agent实测</li>');
html = html.replace(/随笔#“豆包AI手机”/g, '随笔#端侧AI Agent实测');

// 3. Article 2 Copy
const oldArticle2 = `<p>✨以 热  爱，致 生 活🍃<br>💻    🚴🏼   🏕<br>🥘    ⚽️   🎱<br>🔫    🎮   🎬</p>`;
const newArticle2 = `<p>✨ <strong>Code &amp; Create · 奔赴所爱</strong> 🍃<br>
💻 敲击键盘构建数字世界 · 🚴🏼 破风山海感受自由心跳<br>
☕️ 晨间手冲咖啡的香气 · 🎮 沉浸主机光影叙事 · ⚽️ 绿茵球场纵情奔跑</p>`;

html = html.replace(oldArticle2, newArticle2);

// 4. Article 3 (Chongqing) Copy
html = html.replace(/📍 𝑪𝒉𝒐𝒏𝒈𝒒𝒊𝒏𝒈\. <br>📸山里有座城，灯火与星辰🌉/g,
    '📍 𝑪𝒉𝒐𝒏𝒈𝒒𝒊𝒏𝒈 · 赛博山城漫游记<br>📸 “山里有座城，灯火映星辰。” 穿梭在交错纵横的立交与洪崖洞的暖光长卷中，轻轨穿楼，魔幻折叠。');

// 5. Article 4 (Hangzhou) Copy
html = html.replace(/📍 𝑯𝒂𝒏𝒈𝒁𝒉𝒐𝒖<br>"杭城小巷，江南如梦🍃"<br>"人生不过三万天，自由一天是一天\."/g,
    '📍 𝑯𝒂𝒏𝒈𝒁𝒉𝒐𝒖 · 烟雨江南掠影<br>🌿 “水光潋滟晴方好，山色空蒙雨亦奇。” 漫步西湖畔绿荫古巷，轻舟泛水，偷得浮生半日闲。');

// 6. About Page Copy
html = html.replace(/网名：若志奕鑫 \/ てメて/g, '网名：星瀚 (Zenith)');
html = html.replace(/彩云之南蛮人也！/g, '全栈工程师 / 独立开发者 / 极客探索者');
html = html.replace(/若志•随笔-一个若志的网络自留地/g, '星瀚•随笔-一个记录代码折腾、技术思考与真实生活的独立网络空间');
html = html.replace(/愿世界安康，愿你我皆好！/g, '用代码构建逻辑，用热爱温暖生活。');

fs.writeFileSync(indexPath, html, 'utf-8');
console.log('Successfully updated copy across index.html!');
