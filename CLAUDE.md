# lowbar —— 极简每日自重健身 App

本文件是项目的长期规范。任何改动都先对照这里；与本文件冲突的需求，先改本文件再改代码。

## 背景与目标

每天打开就知道"今天练什么"的个人健身工具。唯一器械是一根矮单杠：吊在上面时双脚无法完全离地。
目标是降低每天坚持的门槛：不需要做选择，打开就练，练完打卡，并给人每天想打开它的一点动力。只有一个用户（作者本人）。

## 核心原则（所有决策以此为准）

1. 首页只显示今天的训练，没有菜单，不让用户做选择
2. 极简：能不加的功能就不加，能不加的依赖就不加
3. 任何设备都能使用，尤其是电脑浏览器；同时适配手机
4. 零后端、零费用

## 技术约束

- 原生 HTML + CSS + JavaScript（ES modules），不使用任何框架，不使用任何构建工具，没有 npm 运行时依赖（也没有 package.json）
- 部署在 GitHub Pages（从 main 分支根目录发布），浏览器直接运行源码；所有路径用相对路径，以便在 `/lowbar/` 子路径下工作
- PWA：manifest.json + service worker（sw.js），支持离线使用和安装到桌面/主屏幕
- 界面语言：简体中文
- 日期一律按用户本地时区计算，格式 YYYY-MM-DD；`plan.js` 中的 `TIMEZONE` 常量供 Node 脚本使用（浏览器用设备本地时区）

## 文件结构

```
lowbar/
├── CLAUDE.md
├── README.md
├── index.html
├── style.css
├── app.js          # 只负责界面和事件，不包含业务逻辑
├── core.js         # 纯函数：今日计划、连续天数、进阶判断，不访问 DOM 和存储
├── plan.js         # 训练计划数据，ES module，浏览器和 Node 共用
├── storage.js      # 数据读写的唯一入口（v0.1 用 localStorage，v0.2 加 GitHub 同步）
├── sw.js
├── manifest.json
├── icon.svg        # 主图标；apple-touch-icon.png（180）与 icon-512.png 由它渲染而来
├── .nojekyll       # 让 Pages 跳过 Jekyll，原样发布
├── test/core.test.js
└── .github/workflows/test.yml   # push 和 PR 时运行 node --test
```

分层规则：
- `core.js` 只能 import `plan.js`；不得访问 `window`、`document`、`localStorage`，不得读取当前时间（"今天"由调用方传入）
- `storage.js` 是唯一读写持久化数据的地方；接口全部 async，为 v0.2 的远程同步预留
- `app.js` 不写业务规则，只调用 `core.js` 和 `storage.js`
- 修改了 `sw.js` 的缓存资源列表时，把 `CACHE` 版本号加一

## 训练设计

原则：动作少、名字直白、每天一样，打开一眼看懂。

### 周期

- 周一到周六每天练同样的动作，周日休息（首页显示"休息日"和几条拉伸建议）
- 每次约 15 分钟，每个动作 3 组
- 每组只做到最大次数的六成左右，不练到力竭，所以可以天天练

### 动作（按顺序显示）

1. 引体向上（pull，1–20 次）：矮单杠，弯膝让脚离地；拉不动时脚可以点地借力
2. 俯卧撑（push，5–40 次）
3. 卷腹（crunch，10–40 次）：代替仰卧起坐，下背贴地，更少伤腰
4. 深蹲（squat，10–40 次）：可选，不做也不影响打卡

每个动作在 `plan.js` 中包含：id、名称、一句话动作要点、计量单位、目标次数下限 `min` 与上限 `max`，可选动作带 `optional: true`。没有"等级"，不会自动换动作。

### 进阶规则（core.js 实现）

- 每个动作记录当前目标 `target` 和连续完成计数 `streak`
- 某个动作连续 3 次训练都完成（勾选 = 3 组都达到目标）→ 目标 +1，不超过上限
- 某次没完成 → 计数清零，目标不变，不降（不惩罚，降低心理负担）

### 首次使用（引导页）

1. 输入体重（kg）
2. 每个动作做一组到做不动，记下次数（深蹲可不填）
3. 起始目标 = 最大值的 60%（四舍五入），并限制在该动作的上下限之间；没填的从下限开始
4. 所有初始值之后都可以在设置中修改
5. 训练计划增删动作后（已存的 profile 缺少某个动作），会重新进入引导

## 界面

- 首页：日期、"今天练"或"休息日"、动作列表（名称、组数 × 目标次数、一句话要点，可选动作标"可选"）
- 每个动作一张卡片，大字显示目标次数；每做完一组点一下卡片（3 个圆点依次点亮，满 3 组后再点归零）；做满 3 组 = 该动作完成
- 训练中途的进度存为草稿（storage.js 的 draft），刷新或切出去不丢
- 底部一个大按钮"完成今天"；一组都没做时按钮不可用，空格也无效（防止误触打卡）
- 只做了部分动作也可以点"完成今天"，当天算打卡
- 完成后当天可以"撤销"：删掉当天记录并恢复完成前的目标（这是 history 只追加规则唯一的例外，只限当天）
- 完成后在页面内显示连续天数 +1 和目标变化的简短文字反馈，不弹窗，不播放动画
- 连续天数大字显示；休息日不打断连续（周日不练不算断，也不计数）；今天还没练时从昨天算起
- 键盘：空格键 = 完成今天；数字键 = 给对应动作记一组
- 窄屏上下排列；宽屏（≥ 900px）左侧今日训练，右侧连续天数、本周七天打卡条和统计（本周、累计、体重）
- 设置页（右上角一个小图标）：修改体重、各动作目标次数、导出 / 导入 JSON
- 支持深色模式（跟随系统）
- 视觉简洁克制，大字号，高对比度；暖灰底色，唯一强调色为橙色；数字用圆体（ui-rounded）

## 数据

history 是以日期为键的对象，只追加不覆盖：

```json
{
  "2026-10-02": { "type": "train", "done": true, "exercises": { "pull": true, "push": true, "crunch": true, "squat": false } }
}
```

profile：

```json
{
  "weights": { "2026-10-01": 70 },
  "exercises": { "pull": { "target": 4, "streak": 0 }, "push": { "target": 15, "streak": 1 } }
}
```

- 所有读写只通过 `storage.js`；v0.1 使用 localStorage，键为 `lowbar.profile`、`lowbar.history`、`lowbar.draft`（当天进度）、`lowbar.undo`（撤销快照）
- 某天已有记录时不再写入（`completeDay` 返回 null，`appendHistory` 返回 false）
- 导出文件：`{ app: "lowbar", version: 1, exportedAt, profile, history }`
- 导入：profile 整体替换（经 `normalizeProfile` 修正）；history 合并，已有日期保留

## 测试

- 用 Node 自带的 `node:test` 和 `node:assert`，不安装任何依赖
- 覆盖 core.js：训练日/休息日判断、跨月跨年的连续天数计算、周日不打断连续、进阶、上下限边界、首次引导的起始值计算
- 每次修改代码后运行 `node --test`，测试全部通过才算完成
- 需要 Node 22+（无 package.json，依赖 Node 自动识别 ES module 语法）

## 版本路线

- v0.1：首页、勾选与完成、连续天数、进阶规则、首次引导、设置、导出导入、PWA、测试、Pages 部署 ✅
- v0.2：通过 GitHub Contents API 将数据同步到私有仓库 lowbar-data 的 history.json，实现多设备同步
- v0.3：在 lowbar-data 仓库中用 GitHub Actions + ntfy 每日推送提醒
- v0.4：GitHub 贡献图式打卡格子（一年）、体重趋势折线（内联 SVG）
- v0.4 之后不再增加功能
