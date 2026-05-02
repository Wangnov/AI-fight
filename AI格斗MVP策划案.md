# 《AI 公司全明星大乱斗》MVP 策划案

## H5 + PixiJS · 低帧 2D 街机格斗 · 讽刺 Demo

---

## 一、MVP 范围

两个角色，每人 **6 个动作**：

| 动作槽 | 奥特曼 | 达里奥 |
|--------|--------|--------|
| 普攻 | 拳击（ChatGPT 图标特效） | 拳击（Claude 菊花图标特效） |
| 组合技 1 | Codex Pull Request | Mythos Locked Chamber |
| 组合技 2 | Benchmark Uppercut | Constitution Gospel |
| 大招 | 椅子瘫坐核爆 | Access Denied 审判 |
| 防御 | 格挡 | 格挡 |
| 移动 | 走 / 跳 / 后退 | 走 / 跳 / 后退 |

加上：血条、能量条、一个场景、胜负判定。这就是全部。

---

## 二、操作方案

```
← →        移动
↑           跳跃
↓           蹲下
J           普攻
K           组合技 1（Codex / Mythos）
L           组合技 2（Benchmark / Constitution）
I           大招（能量满时可用）
S           防御（按住）
```

支持键盘双人：P1 用 WASD + UIO + Q，P2 用方向键 + JKL + S。

---

## 三、核心系统

### 3.1 血条

每人 1000 HP。归零判负，BO3（三局两胜）。

### 3.2 能量条

| 角色 | 能量条名称 | 颜色 |
|------|-----------|------|
| 奥特曼 | HYPE METER | 青绿色 |
| 达里奥 | SAFETY PURITY | 橙色 |

增长方式（两人通用）：
- 普攻命中 +8
- 组合技命中 +15
- 被打 +5（挨揍也涨，鼓励进攻）
- 防御成功 +3

满值 100。满后图标闪烁，按 I 释放大招，释放后清零。

### 3.3 打击反馈

MVP 必须实现的反馈，否则低帧动画撑不住：

| 反馈 | 实现方式 |
|------|----------|
| Hit Stop | 命中瞬间双方冻结 4 帧（约 67ms） |
| Screen Shake | 重击/大招时画面抖动 3-5px |
| 闪白 | 被击中角色闪白 2 帧 |
| 击中火花 | 命中点爆一个白色星形 sprite |
| 字效弹出 | 命中时弹出讽刺文字，上浮后消失 |

### 3.4 伤害表

| 招式 | 伤害 | 启动（帧） | 冷却（帧） |
|------|------|-----------|-----------|
| 普攻 | 50 | 2 | 6 |
| 组合技 1 | 120 | 8 | 30 |
| 组合技 2 | 100 | 6 | 24 |
| 大招 | 300 | 20 | — |
| 格挡减伤 | -70% | — | — |

---

## 四、角色一：奥特曼

### 普攻：ChatGPT Jab（J）

奥特曼向前挥拳。命中瞬间，拳头位置爆出一个 **绿色 ChatGPT 旋涡图标**（约 64×64px），停留 0.3 秒后消散。

命中字效（随机）：
- "Better Prompt!"
- "Summarize this!"
- "Ship it!"

**动画帧：Idle → 出拳 → 回收（共 3 帧循环）**

### 组合技 1：Codex Pull Request（K）

奥特曼打开一个命令行窗口，一个 **PR 文件夹** 飞向对手。

- 投射物，中速，直线飞行
- 命中后爆成代码碎片
- 命中字效："LGTM" / "Ship it" / "Merge conflict"
- 被格挡时字效变成 **"Merge conflict"**

**动画帧：施法姿势 → 投射物飞行 → 命中爆炸**

**资产清单：**
- `altman_codex_cast.png`（施法姿势）
- `vfx_pr_folder.png`（飞行中的 PR 文件夹）
- `vfx_code_explode.png`（命中爆炸碎片）

### 组合技 2：Benchmark Uppercut（L）

奥特曼从地上掀起一张 **Benchmark 柱状图**，上勾打飞对手。

- 近战技，判定范围比普攻大
- 命中后对手被击飞（小幅浮空）
- **柱状图纵轴没有数字，只有↑箭头**——这是核心讽刺细节
- 命中字效："SOTA!" / "Cherry-picked!"

**动画帧：蓄力下蹲 → 上勾挥出（带柱状图） → 回收**

**资产清单：**
- `altman_benchmark_windup.png`（蓄力）
- `altman_benchmark_swing.png`（挥出）
- `vfx_benchmark_chart.png`（柱状图，纵轴无数字）

### 大招：椅子瘫坐核爆 —— "Here It Is."（I，需能量满）

**总时长约 3 秒，分 4 个阶段：**

**① 黑场（0.5 秒）**
- 屏幕变暗，聚光灯打在奥特曼身上
- 字幕弹出：`"我只是问了一个问题……"`

**② 椅子瘫坐（0.8 秒）**
- 人体工学椅从天降落
- 奥特曼坐下、后仰、眼神放空
- 大字弹出：`OH MAN... HERE IT IS.`
- 小字闪过：`"人类突然显得有点多余。"`

**③ 营销核爆（0.7 秒）**
- 奥特曼从椅子弹起
- 全屏释放青绿色冲击波
- 背景出现卡通蘑菇云（由 ChatGPT 泡泡 + Benchmark 图 + "AGI SOON™" 贴纸组成）
- 命中字效：`"WHAT HAVE WE SHIPPED?!"`

**④ 收招（1 秒）**
- 奥特曼整理外套
- 台词气泡：`"Anyway, we have a lot to show you."`

**效果：300 伤害 + 全屏判定 + 命中后对手硬直 1 秒**

**资产清单：**
- `altman_sit_down.png`（坐下）
- `altman_lean_back.png`（后仰瘫坐）
- `altman_burst.png`（弹起释放）
- `altman_recover.png`（整理外套）
- `vfx_chair.png`（人体工学椅）
- `vfx_shockwave.png`（青绿色冲击波）
- `vfx_mushroom_cloud.png`（营销蘑菇云）

---

## 五、角色二：达里奥

### 普攻：Claude Tap（J）

达里奥向前挥拳（或用卷轴敲）。命中瞬间，拳头位置爆出一个 **橙色 Claude 菊花图标**（约 64×64px），停留 0.3 秒后消散。

命中字效（随机）：
- "Be Helpful."
- "Be Harmless."
- "Be Honest."

**动画帧：Idle → 出拳 → 回收（共 3 帧循环）**

### 组合技 1：Mythos Locked Chamber（K）

达里奥召唤一扇 **紫橙色禁室大门**，门开一道缝，从缝里射出漏洞碎片。

- 投射物，中速，直线飞行
- 门只开 30%，然后关闭
- 命中字效："ZERO-DAY?" / "APPLY FOR ACCESS"
- **被格挡时字效变成 "Not Generally Available"**

**讽刺细节：门缝里飞出的碎片上标着 "1/198"**——引用 Mythos 实际只审核 198 个样本的事实。

**动画帧：召唤门 → 门开缝 + 碎片飞出 → 门关闭**

**资产清单：**
- `dario_mythos_cast.png`（召唤姿势）
- `vfx_mythos_gate.png`（紫橙色大门）
- `vfx_vulnerability_shard.png`（漏洞碎片投射物）

### 组合技 2：Constitution Gospel（L）

达里奥翻开 **《AI 宪法》**，释放一排发光条款砸向对手。

- 近战/近距离范围技
- 条款像扇面展开拍出
- 飞行中条款上依次显示：`Helpful → Harmless → Honest → Denied`
- 命中字效："Harmless!" / "Mostly Honest."

**讽刺细节：条款序列的最后一个永远是 "Denied"。**

**动画帧：展开宪法 → 条款拍出 → 回收**

**资产清单：**
- `dario_constitution_cast.png`（展开宪法）
- `dario_constitution_swing.png`（拍出）
- `vfx_constitution_pages.png`（飞行条款页）

### 大招：Access Denied — KYC 审判（I，需能量满）

**核心讽刺：用 AI 聊天之前，先交护照和自拍。**

2026 年 4 月 14 日，Anthropic 悄悄上线了 Claude 的身份验证（KYC）系统——要求用户提交实体政府证件照 + 实时自拍，由金融级 KYC 供应商 Persona 处理。ChatGPT 不需要，Gemini 不需要，只有 Claude 需要。社区炸锅。有人说"Anthropic 把 AI 当金融资产管"，有人说"mandatory KYC just to use an AI model"，Reddit 用户说"等不及能离线跑的大模型了"。更讽刺的是：中国身份证不在接受范围内——等于 KYC 本身就是一层地缘封锁。而且有用户验证通过之后反而被封号了。

**这个大招就是让对手亲身体验被 KYC 的全过程。**

**总时长约 3.5 秒，分 5 个阶段：**

**① 升格（0.5 秒）**
- 屏幕变暗，达里奥身后出现 Claude 大教堂光影
- 胸前 Claude 菊花圣印发光
- 字幕弹出：`"Identity Verification Required."`

**② KYC 弹窗（1.2 秒）——核心讽刺阶段**

屏幕中央弹出一个仿真的 KYC 验证界面，覆盖战斗画面。界面依次闪过 3 个步骤（每步停留 0.4 秒）：

**Step 1：证件上传**
```
┌─────────────────────────────┐
│  🔒 IDENTITY VERIFICATION   │
│  powered by Persona™        │
│                             │
│  📄 Upload Government ID    │
│                             │
│  ✅ Passport                │
│  ✅ Driver's License        │
│  ✅ National ID Card        │
│  ❌ Photocopies             │
│  ❌ Digital IDs             │
│  ❌ Student Cards           │
│  ❌ 中国身份证              │
│                             │
└─────────────────────────────┘
```

**Step 2：实时自拍**
```
┌─────────────────────────────┐
│  📸 LIVE SELFIE REQUIRED    │
│                             │
│     ┌─────────────┐        │
│     │  👤 ← YOU   │        │
│     │  (scanning) │        │
│     └─────────────┘        │
│                             │
│  Hold still...              │
│  "This typically takes      │
│   under five minutes."      │
│                             │
└─────────────────────────────┘
```

**Step 3：审核结果**
```
┌─────────────────────────────┐
│                             │
│   ⏳ VERIFYING...           │
│                             │
│   ██████████████░░  87%     │
│                             │
│   ...                       │
│                             │
│   ❌ VERIFICATION FAILED    │
│                             │
│   Reason:                   │
│   UNSUPPORTED REGION        │
│                             │
│   [Appeal] [Contact Sales]  │
│                             │
└─────────────────────────────┘
```

**这整套 KYC 流程就是大招的"蓄力阶段"——对手必须看完这三页才会吃到伤害。** 其他格斗游戏的大招用华丽动画蓄力，达里奥用官僚流程蓄力。

**③ 红章降临（0.8 秒）**
- KYC 弹窗碎裂
- 巨大红章从天降下砸在对手身上：

```
ACCESS DENIED
ADVERSARIAL REALM
```

- 全屏橙紫色光柱
- 一群 mini 红章雨从天落下，每个上面写着：`KYC FAILED` / `REGION BLOCKED` / `ID REJECTED`

**④ 命中字效（0.5 秒）**

大字：`"YOU WERE NOT SELECTED BY CLAUDE."`

小字（快速闪过）：
- `"ChatGPT doesn't require this."`
- `"Gemini doesn't require this."`
- `"Anthropic just handed their competitors a gift."`

（最后一句引用社区原话。）

**⑤ 收招（0.5 秒）**
- 达里奥合上宪法
- 台词气泡：`"For your safety."`
- 极小字补一句：`"Not even a regulatory requirement."`

**效果：300 伤害 + 全屏判定 + 命中后封锁对手组合技 2 秒（技能图标变灰，显示 "UNDER REVIEW"）**

**隐藏讽刺：有 5% 概率 Step 3 的结果不是 "VERIFICATION FAILED" 而是 "VERIFIED — ACCOUNT SUSPENDED ANYWAY"。** 引用真实事件：有用户通过 KYC 验证后反而被封号。

**资产清单：**
- `dario_judge_pose.png`（审判姿势，圣印发光）
- `dario_slam.png`（拍下红章）
- `dario_recover.png`（合上宪法）
- `vfx_cathedral_bg.png`（教堂光影背景层）
- `vfx_access_denied_stamp.png`（巨大红章）
- `vfx_orange_pillar.png`（橙紫色光柱）
- `vfx_kyc_step1.png`（KYC 证件上传界面）
- `vfx_kyc_step2.png`（KYC 实时自拍界面）
- `vfx_kyc_step3.png`（KYC 审核失败界面）
- `vfx_mini_stamps.png`（mini 红章雨）

---

## 六、通用动作

两人共用逻辑，美术各自独立：

| 动作 | 帧数 | 说明 |
|------|------|------|
| Idle | 2 帧循环 | 微微呼吸/晃动 |
| Walk | 2 帧循环 | 前进/后退共用，后退镜像翻转 |
| Jump | 1 帧 | 上升和下落共用同一张图 |
| Crouch | 1 帧 | 蹲下 |
| Block | 1 帧 | 双手护胸，半透明护盾 |
| Hit | 1 帧 | 被击中后仰 |
| Knockdown | 1 帧 | 倒地 |
| Win | 1 帧 | 胜利姿势 |
| Lose | 1 帧 | 失败姿势 |

---

## 七、帧数汇总

| 动作 | 奥特曼 | 达里奥 |
|------|--------|--------|
| Idle | 2 | 2 |
| Walk | 2 | 2 |
| Jump | 1 | 1 |
| Crouch | 1 | 1 |
| Block | 1 | 1 |
| Hit | 1 | 1 |
| Knockdown | 1 | 1 |
| Win | 1 | 1 |
| Lose | 1 | 1 |
| 普攻 | 3 | 3 |
| 组合技 1 | 2 | 2 |
| 组合技 2 | 2 | 2 |
| 大招 | 4 | 3 |
| **合计** | **22** | **21** |

**两人主体图合计：43 张。**  
加上特效 sprite 约 25 张，**总资产约 68 张图。**

完全可做。

---

## 八、场景

**一张背景图，左右分区：**

```
┌────────────────────────────────────────────┐
│  ┌──────────┐              ┌──────────┐    │
│  │LIVE DEMO │              │CLAUDE    │    │
│  │          │              │CATHEDRAL │    │
│  └──────────┘              └──────────┘    │
│                                            │
│  🟢 ChatGPT泡泡    MODEL    🟠 Claude圣印  │
│  🟢 Codex终端      ARENA    🟠 宪法卷轴    │
│  🟢 AGI SOON™              🟠 小螃蟹      │
│                                            │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 地面 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└────────────────────────────────────────────┘
```

左半：OpenAI 发布会（蓝绿色调），右半：Claude 教堂（橙紫色调）。

中央地面写着：`PUBLIC BENEFIT? PRIVATE ACCESS?`

**资产：1 张全屏背景图（1280×720 或等比）。**

---

## 九、HUD

```
┌────────────────────────────────────────────┐
│ ALTMAN                            DARIO    │
│ ████████████░░░░    ░░░░████████████       │
│ HP: 750/1000            HP: 900/1000       │
│                                            │
│ HYPE ████░░░░░░        ░░░░░░████ SAFETY   │
│      [42/100]              [35/100]        │
│                                            │
│              ⏱ 60                          │
│    WHO GETS TO USE THE MODEL?              │
└────────────────────────────────────────────┘
```

- 血条：奥特曼青绿色，达里奥橙色
- 能量条：在血条下方，小一号
- 计时器：60 秒/回合
- 底部滚动标题（可选，优先级低）

---

## 十、字效系统

每次命中弹出一个讽刺字效，白色描边大字，从命中点向上浮 40px 后在 0.8 秒内淡出。

字效池：

| 触发 | 奥特曼字效 | 达里奥字效 |
|------|-----------|-----------|
| 普攻命中 | "Better Prompt!" / "Summarize!" / "Ship it!" | "Be Helpful." / "Be Harmless." / "Be Honest." |
| 组合技 1 命中 | "LGTM" / "Ship it" / "Fix pushed" | "ZERO-DAY?" / "APPLY FOR ACCESS" |
| 组合技 1 被挡 | "Merge conflict" | "Not Generally Available" |
| 组合技 2 命中 | "SOTA!" / "Cherry-picked!" | "Harmless!" / "Denied!" |
| 大招命中 | "WHAT HAVE WE SHIPPED?!" | "VERIFICATION FAILED — UNSUPPORTED REGION" |

---

## 十一、胜负结算

### 奥特曼胜利

角色做出 Win 姿势，背景弹出：

```
ALTMAN WINS
"Anyway, we have a lot to show you."
```

### 奥特曼失败

```
"这个结果不代表最终版本。"
```

### 达里奥胜利

```
DARIO WINS
"Your defeat has been safety-audited."
```

### 达里奥失败

```
"This was a packaging issue, not a defeat."
```

---

## 十二、全部资产清单

### 角色主体图（43 张）

**奥特曼（22 张）：**

| 文件名 | 用途 |
|--------|------|
| `altman_idle_01.png` | 站立 1 |
| `altman_idle_02.png` | 站立 2 |
| `altman_walk_01.png` | 走路 1 |
| `altman_walk_02.png` | 走路 2 |
| `altman_jump.png` | 跳跃 |
| `altman_crouch.png` | 蹲下 |
| `altman_block.png` | 防御 |
| `altman_hit.png` | 被击 |
| `altman_knockdown.png` | 倒地 |
| `altman_win.png` | 胜利 |
| `altman_lose.png` | 失败 |
| `altman_jab_01.png` | 普攻准备 |
| `altman_jab_02.png` | 普攻出拳 |
| `altman_jab_03.png` | 普攻回收 |
| `altman_codex_cast.png` | Codex 施法 |
| `altman_codex_throw.png` | Codex 投出 |
| `altman_benchmark_windup.png` | Benchmark 蓄力 |
| `altman_benchmark_swing.png` | Benchmark 上勾 |
| `altman_sit_down.png` | 大招：坐下 |
| `altman_lean_back.png` | 大招：后仰瘫坐 |
| `altman_burst.png` | 大招：弹起释放 |
| `altman_recover.png` | 大招：整理外套 |

**达里奥（21 张）：**

| 文件名 | 用途 |
|--------|------|
| `dario_idle_01.png` | 站立 1 |
| `dario_idle_02.png` | 站立 2 |
| `dario_walk_01.png` | 走路 1 |
| `dario_walk_02.png` | 走路 2 |
| `dario_jump.png` | 跳跃 |
| `dario_crouch.png` | 蹲下 |
| `dario_block.png` | 防御 |
| `dario_hit.png` | 被击 |
| `dario_knockdown.png` | 倒地 |
| `dario_win.png` | 胜利 |
| `dario_lose.png` | 失败 |
| `dario_jab_01.png` | 普攻准备 |
| `dario_jab_02.png` | 普攻出拳 |
| `dario_jab_03.png` | 普攻回收 |
| `dario_mythos_cast.png` | Mythos 施法 |
| `dario_mythos_release.png` | Mythos 碎片释放 |
| `dario_constitution_cast.png` | 宪法展开 |
| `dario_constitution_swing.png` | 宪法拍出 |
| `dario_judge_pose.png` | 大招：审判姿势 |
| `dario_slam.png` | 大招：拍下红章 |
| `dario_recover.png` | 大招：合上宪法 |

### 特效 sprite（26 张）

| 文件名 | 用途 |
|--------|------|
| `vfx_chatgpt_icon.png` | 普攻特效：ChatGPT 旋涡图标 |
| `vfx_claude_icon.png` | 普攻特效：Claude 菊花图标 |
| `vfx_hit_spark.png` | 通用命中火花 |
| `vfx_block_flash.png` | 通用防御闪光 |
| `vfx_pr_folder.png` | Codex 投射物：PR 文件夹 |
| `vfx_code_explode.png` | Codex 命中爆炸 |
| `vfx_benchmark_chart.png` | Benchmark 柱状图（纵轴无数字） |
| `vfx_mythos_gate.png` | Mythos 紫橙色大门 |
| `vfx_vulnerability_shard.png` | Mythos 漏洞碎片投射物 |
| `vfx_constitution_pages.png` | 宪法飞页条款 |
| `vfx_chair.png` | 大招：人体工学椅 |
| `vfx_shockwave.png` | 大招：青绿色冲击波 |
| `vfx_mushroom_cloud.png` | 大招：营销蘑菇云 |
| `vfx_cathedral_bg.png` | 大招：教堂光影背景层 |
| `vfx_access_denied_stamp.png` | 大招：ACCESS DENIED 红章 |
| `vfx_orange_pillar.png` | 大招：橙紫色光柱 |
| `vfx_kyc_step1.png` | 大招：KYC 证件上传界面 |
| `vfx_kyc_step2.png` | 大招：KYC 实时自拍界面 |
| `vfx_kyc_step3.png` | 大招：KYC 审核失败界面 |
| `vfx_mini_stamps.png` | 大招：mini 红章雨 |
| `vfx_ko.png` | KO 爆字 |
| `vfx_screen_lines.png` | 屏幕震动线 |
| `vfx_dust.png` | 落地烟尘 |
| `vfx_flash_white.png` | 全屏闪白 |
| `vfx_under_review.png` | 技能封锁标记（大招附加效果） |
| `bg_arena.png` | 场景背景（1280×720） |

### 资产总计

| 类别 | 数量 |
|------|------|
| 奥特曼主体图 | 22 |
| 达里奥主体图 | 21 |
| 特效 sprite | 26 |
| **总计** | **69 张** |

---

## 十三、开发步骤

### Phase 1：灰盒可打（1-2 天）

用两个彩色矩形代替角色，实现：
- 移动 / 跳跃 / 蹲下
- 普攻（近战判定框）
- 组合技 1（投射物）
- 组合技 2（近战范围技）
- 防御（减伤 70%）
- 血条 + 能量条
- 胜负判定

**验收标准：两个矩形能互殴到 KO。**

### Phase 2：贴图上角色（1-2 天）

替换矩形为角色 sprite，实现帧切换：
- Idle 循环
- Walk 循环
- 各招式帧切换
- 被击/倒地帧

**验收标准：看起来像两个人在打架。**

### Phase 3：特效 + 字效 + 大招（2-3 天）

- 普攻命中时弹出 ChatGPT / Claude 图标
- 投射物 sprite
- 字效弹出系统
- 两个大招的完整分镜演出
- Hit Stop / Screen Shake / 闪白

**验收标准：打起来有街机味，大招有表演感。**

### Phase 4：包装（1 天）

- HUD 美化
- 简单开始画面（按任意键开始）
- 胜负结算画面 + 台词
- 音效（拳击声 / 命中声 / 大招音效）

**验收标准：可以录一段视频发到社交媒体。**

---

## 十四、技术参数

| 参数 | 值 |
|------|------|
| 画布 | 1280 × 720 |
| 游戏帧率 | 60 FPS（逻辑帧），动画 8-12 FPS（低帧风格） |
| 角色 sprite 尺寸 | 约 200 × 350 px |
| 投射物速度 | 6-8 px/帧 |
| 地面线 | y = 520（距底部 200px） |
| 重力 | 0.6 px/帧² |
| 跳跃初速 | -14 px/帧 |
| 移动速度 | 4 px/帧 |
| 击退距离 | 普攻 30px，组合技 60px，大招 120px |

---

## 十五、一句话总结

**69 张图，6 个动作/人，两个大招演出，一个讽刺场景。**

**奥特曼用 ChatGPT 泡泡拍脸、Codex PR 砸人、Benchmark 上勾拳打飞人、最后坐在椅子上被自己的模型吓到然后释放营销核爆。**

**达里奥用 Claude 菊花敲头、Mythos 门缝射碎片、AI 宪法条款扇脸、最后弹出 KYC 验证界面——要你交护照、拍自拍、等审核——然后告诉你 VERIFICATION FAILED。**

**这就是 MVP。**
