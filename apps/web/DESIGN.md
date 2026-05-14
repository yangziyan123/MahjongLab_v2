---
name: MahjongLab
description: AI riichi mahjong review and training workspace for serious self-study players.
colors:
  ink-primary: "#030213"
  paper-bg: "#ffffff"
  app-bg: "#f8fafc"
  mist-bg: "#ececf0"
  muted-text: "#717182"
  soft-accent: "#e9ebef"
  selection-blue: "#2563eb"
  table-green: "#064e3b"
  table-green-deep: "#022c22"
  success-green: "#059669"
  warning-amber: "#d97706"
  danger-red: "#d4183d"
  border-subtle: "#0000001a"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.paper-bg}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "{colors.paper-bg}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.label}"
  card-default:
    backgroundColor: "{colors.paper-bg}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.app-bg}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
    typography: "{typography.body}"
  badge-secondary:
    backgroundColor: "{colors.mist-bg}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
    typography: "{typography.label}"
---

# Design System: MahjongLab

## 1. Overview

**Creative North Star: "冷静牌桌实验室"**

MahjongLab 的界面应该像一张安静、可信、随时可复盘的分析牌桌。它不是营销页，也不是炫技仪表盘；它是认真玩家完成导入、阅读报告、比较动作、积累错题和进入训练的工作台。视觉系统以浅色工作区为主体，使用深墨色承载主操作，使用低饱和中性色建立层级，再把深绿牌桌留给麻将状态和回放场景。

产品气质是简洁、专业、有高级感。趣味只出现在状态反馈、牌桌变化、回放进度和学习闭环的关键节点里。系统明确拒绝普通 AI 生成的紫蓝渐变、过多玻璃拟态、卡片套卡片，以及花哨但没意义的动效。

**Key Characteristics:**
- 克制浅色工具界面，优先保证报告和牌桌信息可读。
- 深墨色主操作，蓝色只用于选择和聚焦，绿色只在麻将牌桌和正向状态里承担语义。
- 组件形态稳定，圆角适中，边框轻，阴影少。
- 动效服务加载、筛选、选中、回放和状态变化，不做页面入场表演。

## 2. Colors

这是一套以冷静中性色为地基、深墨主操作为锚点、深绿牌桌为场景记忆点的 restrained 产品色系。

### Primary
- **Deep Ink Primary**: 主按钮、强操作、关键文字和深色工具条。它应当显得可靠、有重量，不要被渐变或高饱和装饰稀释。
- **Selection Blue**: 当前选中项、焦点状态、可操作高亮和少量导航反馈。蓝色必须服务状态，不用于大面积背景装饰。

### Secondary
- **Table Green**: 牌桌、河牌、手牌、回放和麻将局面容器。它是 MahjongLab 的场景色，只在麻将语义明确的区域使用。
- **Table Green Deep**: 牌桌内部面板、玩家区和深色层级。用于建立牌桌深度，而不是做普通暗色主题。

### Tertiary
- **Success Green**: 推荐动作、命中、完成和正向结果。
- **Warning Amber**: 中偏差、待处理、注意事项和未知牌。
- **Danger Red**: 高偏差、删除、失败和破坏性状态。

### Neutral
- **Paper Background**: 卡片、弹层、主内容面板和可输入表面。
- **App Background**: 页面底色、空状态底板和非交互浅色区域。
- **Mist Background**: 次级按钮、tabs 背板、skeleton 和弱提示区域。
- **Muted Text**: 说明文字、时间戳、辅助标签和次级元信息。
- **Soft Accent**: hover、轻量选择底色和非主操作反馈。
- **Subtle Border**: 卡片、列表项、输入框、分隔线和低层级轮廓。

### Named Rules

**The One Accent Rule.** 同一普通工具屏幕只允许一个主状态色占据注意力。报告筛选列表用蓝色选中，偏差状态用语义色，其他区域回到中性。

**The Table Green Rule.** 深绿只属于麻将牌桌、回放和局面状态。不要把它扩散成全站品牌背景。

**The No Purple Gradient Rule.** 禁止普通 AI 生成的紫蓝渐变。任何渐变都必须有明确场景含义，目前默认不用。

## 3. Typography

**Display Font:** System sans stack with native platform fallback  
**Body Font:** System sans stack with native platform fallback  
**Label/Mono Font:** No separate mono or display family is currently used

**Character:** 字体系统应当像严肃工具一样稳定、清晰、低摩擦。不要引入显示字体、花体或过强个性的字形来装饰按钮、标签、数据或报告。

### Hierarchy
- **Display** (700, 1.875rem, 1.2): 首页产品名、报告 hero 标题、极少量一级页面标题。
- **Headline** (700, 1.5rem, 1.3): 页面主标题、报告名称、404 等状态页标题。
- **Title** (500, 1rem, 1.5): 卡片标题、面板标题、分组标题、字段标签的强调态。
- **Body** (400, 1rem, 1.5): 表单、说明文本、普通段落。解释性正文最大行长控制在 65 到 75ch。
- **Label** (500, 0.875rem, 1.5): 按钮、筛选器、徽章、时间轴项目和数据标签。

### Named Rules

**The Native Tool Rule.** 使用系统 sans，保持产品界面的本机感。不要为装饰性高级感牺牲中文可读性和数据扫描效率。

**The Data First Rule.** 数字、动作、偏差和局面标签优先清晰。字体层级必须帮助玩家更快定位失误，而不是制造视觉表演。

## 4. Elevation

MahjongLab 使用轻边框和少量阴影的混合层级。默认表面应接近平面，靠背景色、边框和间距建立结构；阴影只用于 header、hover 卡片、弹层、牌桌容器和需要从页面中浮起的状态反馈。

### Shadow Vocabulary
- **Resting Hairline** (`border: 1px solid`): 普通卡片、列表项、输入框和筛选器的默认层级。
- **Soft Surface** (`shadow-sm`): 顶栏、首页卡片和轻量容器，表示可独立扫描但不抢注意力。
- **Interactive Lift** (`hover:shadow-md` / `hover:shadow-lg`): 可点击历史记录、首页入口等区域的 hover 反馈。
- **Overlay Lift** (`shadow-lg` / `shadow-xl`): 弹层、下拉菜单、牌桌和暗色报告 hero。

### Named Rules

**The Flat By Default Rule.** 静止界面默认平。阴影必须说明层级、hover、弹层或牌桌场景，不得为了高级感滥用。

**The No Glass Default Rule.** `backdrop-blur` 只允许用于粘性顶栏或浮层可读性，不作为装饰风格扩散。

## 5. Components

### Buttons

按钮应当短、清楚、有确定触感。图标按钮使用 Lucide 图标，文本按钮只承担明确命令。

- **Shape:** 适中圆角，默认 8px；图标按钮保持 36px 方形。
- **Primary:** 深墨背景、浅色文字、36px 高度、水平 16px 内边距。用于页面唯一主操作，如导入牌谱、进入对战、加入错题库。
- **Hover / Focus:** hover 降低主色透明度或使用轻色背景；focus 使用 3px ring，必须键盘可见。
- **Secondary / Ghost / Outline:** outline 用浅色背景加边框；ghost 只用于返回、辅助导航和低风险操作。

### Chips

徽章用于状态和分类，不用于装饰。

- **Style:** 8px 圆角，2px x 8px 内边距，12px 字号，500 字重。
- **State:** 偏差等级必须同时依赖文字和颜色。`高偏差` 使用危险色，`中偏差` 使用 outline 或 warning，`命中最优` 使用 secondary 或 success。

### Cards / Containers

卡片是内容容器，不是页面组织的唯一答案。

- **Corner Style:** 默认 14px；内部小面板 10px 到 14px。
- **Background:** 普通卡片使用白色；页面底色使用 slate-50；牌桌容器使用深绿。
- **Shadow Strategy:** 默认无阴影或轻阴影；hover 才允许增强。
- **Border:** 轻边框是默认结构线。禁止彩色侧边条。
- **Internal Padding:** 普通卡片 24px；列表项和紧凑面板 16px；牌桌小状态块 12px。

### Inputs / Fields

输入控件必须稳定、朴素、可快速识别。

- **Style:** 36px 高度，8px 圆角，浅底色，1px 边框，12px 水平内边距。
- **Focus:** 边框切到 ring 色，并出现 3px 透明焦点环。
- **Error / Disabled:** 错误使用危险色边框和 ring，disabled 降低透明度并禁止指针事件。

### Navigation

导航使用标准工具产品模式：顶部返回按钮、页面标题、右侧轻量操作组，或未来可扩展为侧栏。

- **Style:** 背景白色或半透明白色，底部边框，必要时轻阴影。
- **Typography:** 页面标题使用 headline 或 title，导航按钮使用 label。
- **States:** hover 使用 soft accent；当前页面或当前筛选状态用 selection blue 或 active tab。
- **Mobile:** 操作组允许换行，不压缩主要标题和返回路径。

### Mahjong Review Table

这是项目的 signature component。它可以比普通工具界面更有场景感，但仍必须服务复盘。

- **Surface:** 外层使用深绿牌桌，内部用更深的绿色面板组织玩家、手牌、河牌和局面信息。
- **Tiles:** 牌张使用白底、浅边框、短阴影和紧凑固定尺寸。红五只改变牌字颜色，不改变牌张结构。
- **Highlight:** 当前相关牌使用 sky ring，立直牌允许旋转，未知牌使用 amber。
- **Layout:** 桌面端按上左右下四家布局；窄屏可转为纵向堆叠，不能让牌张挤压到不可读。

### Alerts / Empty States

警告和空状态应解释下一步，而不是只告诉用户“没有数据”。

- **Alert:** 8px 到 10px 圆角，轻边框，文本直接说明失败原因或可恢复动作。
- **Empty State:** 保持简短，给出下一步入口，例如创建第一份报告或从复盘报告加入错题。

## 6. Do's and Don'ts

### Do:

- **Do** 保持工具型产品的克制：浅色工作区、轻边框、稳定组件和清晰数据优先。
- **Do** 把深绿留给麻将牌桌、回放和局面状态，让它成为项目识别点。
- **Do** 用颜色加文字共同表达偏差、成功、警告和错误，满足色盲可读性。
- **Do** 使用 150 到 250ms 的状态动效表达 hover、focus、loading、筛选切换、回放进度和选中变化。
- **Do** 使用 8px 到 14px 的圆角范围，除麻将牌张或小控件外不要突然改变组件词汇。
- **Do** 让导入、复盘、回放、错题库、训练之间的路径始终可见。

### Don't:

- **Don't** 使用普通 AI 生成的紫蓝渐变。
- **Don't** 使用过多玻璃拟态；`backdrop-blur` 只能服务顶栏或浮层可读性。
- **Don't** 做卡片套卡片。需要分组时使用间距、边框、背景带或列表结构。
- **Don't** 加入花哨但没意义的动效。没有状态含义的动效禁止出现。
- **Don't** 使用彩色 `border-left` 或 `border-right` 侧边条作为卡片强调。
- **Don't** 用渐变文字、装饰性 hero、重复 icon-card 网格或营销页布局包装产品工作流。
- **Don't** 在按钮、标签、数据或表单里使用显示字体。
