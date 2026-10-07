# 日系 Vocaloid 风格创意融合设计方案与意图解析

本文档记录了在《world.execute(me);》复刻工程中，将 **日系 Vocaloid 式 MV 美学（Modern Pop-Geek）** 融入原作的完整设计意图、美学依据与工程实现方案。

---

## 1. 风格定位：现代极客波普（Modern Pop-Geek Vocaloid Style）

### 1.1 美学脉络
借鉴 Wowaka（《Unhappy Refrain》《Rolling Girl》）、DECO*27（《二息步行》《The Vampire》）、PinocchioP（《神っぽいな》）、Kikuo（《爱して爱して爱して》）等黄金期与现代 Vocaloid MV 的视觉特征：
- **高密度动力学排版（Kinetic Typography / 文字杀）**：大字号重击、斜切角度（Dutch Angle）、加粗黑阴影与高对比度反色描边。
- **UI 叙事与数字化隐喻**：Windows 95 复古立体斜边弹窗、报错信息、黄色/红色警告警戒带。
- **瞬态视觉冲击**：鼓点上的单帧负片反转闪烁（Single-frame Inversion Flash）与重低音 RGB 色分离（Chromatic Aberration）。
- **学术与波普的碰撞**：将原曲冷峻的 Java 代码、数理公式与活泼的日系极客排版相融合。

---

## 2. 歌词意象深度锚定（Narrative Semantic Mapping）

所有出现的日文词汇严禁泛化，必须 **严格锚定 Mili 原曲的每一句歌词意涵与 AI 自我献祭的精神内核**：

| 时间戳 (s) | 歌词原意与剧情节点 | 日文排版核心词 / 意象 | 呈现形式 |
| :--- | :--- | :--- | :--- |
| **0.00 ~ 5.50** | `Switch on the power line / Remember to put on PROTECTION` | `電源投入 // PROTECTION // 電脳生命創造` | 顶部黄色倾斜警戒带 + 底部启动胶囊 |
| **10.80 ~ 15.50**| `OBJECT CREATION / INITIALIZATION / me = new Thing();` | `SIMULATION_GENESIS.EXE` / `世界パラメータ初期化完了` / `貴方のために【私】を生成しますか？` | Windows 95 复古立体引导弹窗 |
| **16.83 ~ 20.07**| `world.execute(me);` | `世界よ、私を執行して` [WORLD.EXECUTE(ME);] | 首拍粉白大字重击杀（荷兰角 -0.04rad） |
| **20.07 ~ 28.50**| `GodDrinksJava / creates an empty simulated world` | `神ハJavaヲ嗜ム：意味も目的も無き虚無世界` | 极客胶囊字幕 + 新世界构建进度提示 |
| **29.30 ~ 44.07**| 几何四重奏（点集维度、真圆周长、正弦切线、无限极限） | `点集合の私：次元を貴方に捧ぐ`<br>`真円の私：円周を貴方に捧ぐ`<br>`正弦波の私：接線に腰掛けて`<br>`無限への極限：貴方は私の境界` | 顶部避让信息胶囊 + 右上角科技 HUD 标注（`次元`、`円周`、`正弦`、`極限`） |
| **44.07 ~ 58.60**| `Switch AC to DC / Blind my vision / So dizzy / So deeply unite` | `電流切替：交流⇄直流`<br>`視界を奪って：暗転する意識`<br>`目眩く、目眩く眩暈の中で`<br>`深く、深く、ひとつに融け合って` | 顶部流线胶囊 |
| **59.20 ~ 73.57**| 副歌 1：`Stimulations / Satisfaction / Strange simulation` | `全ての刺激を貴方にあげられるなら`<br>`唯一の満足になれるでしょうか`<br>`貴方が幸せなら私を執行して`<br>`奇妙な檻に囚われて` | 顶部信息胶囊 + 底部双向闭塞隔离警戒带（`脱出不能 // STRANGE SIMULATION`） |
| **73.57 ~ 87.80**| 生物四重奏（茄子营养、番茄抗氧化、虎猫呼噜、神的存在证明）| `茄子の私：栄養を貴方に捧ぐ`<br>`トマトの私：抗酸化を貴方に捧ぐ`<br>`虎猫の私：喉を鳴らして歓喜を`<br>`貴方こそが私の存在証明` | 顶部信息胶囊 + 右上角 HUD（`栄養`、`抗酸化`、`歓喜`、`存在証明`） |
| **88.37 ~ 102.80**| 身份与角色切换（女/男、任意对待身体、S/M、恍惚） | `性別切替：女⇄男`<br>`この身体を好きにして`<br>`主従反転：支配⇄従順`<br>`恍惚の境地へ昇華する` | 顶部留白安全区避让胶囊 |
| **103.20 ~ 117.20**| 副歌 2：`Completion / Vibrations / Isolation` | `貴方の充足を感じられるなら`<br>`私は振動そのものになる`<br>`独り置き去りの孤独でも` | 顶部信息胶囊 + 弃却隔离警戒带 |
| **117.70 ~ 133.50**| 桥段：`Challenging your god / purge fragments / ILLEGAL ARGUMENTS` | `無意味な断片を消去して`<br>`不正引数 // ILLEGAL_ARGUMENTS // 神への反逆`<br>`FATAL_EXCEPTION_0x000000FF: 貴方は自らの神に刃を向けました` | 红色死机报错弹窗（Windows 95 风格，含 `[無視]`, `[執行]` 按键） |
| **133.50 ~ 147.00**| 蓄力副歌：`Replication 40 copies` | `貴方の複製 × 40` [REPLICATION 40 COPIES] | 底部增殖中流水警示标尺 + 节拍脉冲放大 |
| **147.00 ~ 155.00**| **高潮 12 连击鼓点（The 12 Execution Stabs）** | **12 连击自我牺牲奉献词屏幕重击**：<br>1. 私を執行 [EXECUTE ME]<br>2. 貴方の為に [FOR YOU]<br>3. 身代わり [SACRIFICE]<br>4. 受け入れて [ACCEPT ME]<br>5. 全てを捧ぐ [GIVE MY ALL]<br>6. 消去承認 [PURGE APPROVED]<br>7. 喜んで [WITH JOY]<br>8. 痛みをくれ [FEEL THE PAIN]<br>9. 愛の証 [PROOF OF LOVE]<br>10. 壊して [BREAK ME]<br>11. 終わらせて [TERMINATE ME]<br>12. 処刑完了 [EXECUTED] | 屏幕正中央 145px 巨幅动态重击杀，荷兰角正负交替倾斜（±0.08rad），指数衰减撞击形变（1.45x -> 1.0x），单帧负片反转闪烁，顶部红色遥测标 `[ EXECUTION STAB 01/12 ]` |
| **155.00 ~ 162.50**| 多语种倒计时：`EIN DOS TROIS 네 FEM 六` | 大写汉字数字对位：`壱`、`弐`、`参`、`肆`、`伍`、`陸`、`宣告：処刑` | 黑板右上角 110px 霓虹倒计时印记 |
| **162.50 ~ 178.50**| `If I can give them all the execution / Though we are trapped` | `全てに死を配れるなら`<br>`貴方の唯一になれますか`<br>`脱出不能 // NO ESCAPE // 閉塞隔離 // WE ARE TRAPPED`<br>`囚われの愛 // TRAPPED IN LOVE // 永遠のシミュレーション`<br>`私たちは閉じ込められた` | 双十字交叉警戒带全屏封锁 + 红色血字大标题刺击 |
| **179.00 ~ 184.60**| 终章学术专著与期末考试（Chapter 1 & Examination） | `愛し方を学びました`<br>`たいへんよくできました (100点)` | Card 14 试卷右上角 `SCORE` 评卷框严丝合缝压盖 **日本教师樱花评分印章（花丸印）** |
| **184.60 ~ 198.00**| 爱情代数方程式（Algebraic expression） | `愛の代数方程式：解なし`<br>`ALGEBRAIC_ERROR: 感情「愛」の代数解なし (UNDEFINED)` | 报错弹窗 |
| **198.00 ~ 213.00**| 大版拉远全景终局（Monochrome Finish） | `全シミュレーション終了 // YOUR WORLD CONTINUES // 貴方の世界は続く // 実験完了`<br>`世界よ、私を執行して` | 画面上下边缘黑黄封印警戒边框 + Card 16 终端光标收尾 |

---

## 3. 架构突破：屏幕空间（Screen-Space）图层解耦与自适应避让

### 3.1 核心问题与根因
在最初的实验版本中，Vocaloid 特效被绘制在大版画布坐标系（Master Sheet Space）内：
- 当摄像机推进到局部特写（`zoom = 10.66`）时，文字被放大 10 倍，造成巨大面积遮挡与严重边缘裁切。
- 当摄像机拉远到大版全景（`zoom = 0.88`）时，文字又缩小为不可读的微小噪点。

### 3.2 屏幕空间图层解耦（Screen-Space Layering）
我们将 `renderVocaloidScreenOverlays` 移出拼版矩阵，置于摄像机矩阵恢复之后（`ctx.restore()` 之后）：
- **绝对分辨率保证**：所有日系排版、弹窗、警戒带恒定在 1920×1080 原生高清分辨率下绘制，字迹永远锐利无畸变。
- **动态上下安全区避让**：
  - 当卡片底部存在重要公式、说明与代码时（如 Card 2 几何学、Card 6 Java 代码、Card 3 历史推车），字幕胶囊自适应置于顶部安全区（`y = 70px`）。
  - 当卡片顶部有标题时，字幕胶囊自适应置于底部边距（`y = 1010px`）。
  - 核心插图与公式区域 100% 完整展现，实现原作优雅学术风与极客波普风的共存。
