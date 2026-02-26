# LabelFlow - 价格比对标注平台

企业内部使用的商品比价标注实验管理平台。

## 技术栈
- **后端**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL + Drizzle ORM
- **前端**: React + Vite + TypeScript + Wouter + TanStack Query + Shadcn UI

## 数据库表

| 表名 | 说明 |
|------|------|
| users | 用户（admin/annotator 角色） |
| annotation_templates | 标注模板（展示字段+标注字段+判断字段） |
| experiments | 实验（含 code 唯一编码、priority 优先级 P1/P2/P3、截止时间、复核设置、templateId FK） |
| tasks | 标注任务（含 assignedTo、assignedAt） |
| annotations | 标注结果（支持 draft/initial/review 类型） |
| notifications | 系统通知（info/warning/urgent） |
| logs | 操作日志 |
| api_connectors | API 数据源配置 |

## 测试账号
- admin / password123（管理员）
- annotator1 / password123（标注员）
- annotator2 / password123（标注员）

## 状态流转
`pending` → `assigned` → `annotated` → `needs_review`（复核抽中）→ `completed`（裁定完成）

## 功能模块

### 管理员
1. **仪表盘**: 实验、任务、用户统计概览
2. **实验管理**: 创建/编辑实验（含截止时间），查看详情和进度
3. **任务分配**: 实验详情页手动分配（选人+数量）/ 随机均匀分配给多个标注员
4. **数据导入**: CSV/Excel 拖放上传，列字段映射，批量创建任务
5. **API 连接器**: 配置外部 API 数据源（API Key/Bearer），手动触发或定时拉取
6. **用户管理、标注结果、系统日志**

### 标注员
1. **我的任务** (`/my-tasks`): 以实验为单位展示，每个实验卡片含优先级 badge（P1红/P2黄/P3灰）、实验编码、名称、截止时间、任务进度条。按优先级排序（P1优先）。管理员可查看所有实验。
2. **实验内联标注** (`/my-tasks/:experimentId`): Excel 式表格，每行显示原始数据字段（来自模板 displayFields）和内联标注选项（来自模板 annotationFields）。点击选项即时保存，无需跳转。支持搜索和分页（50条/页）。
3. **标注工作台**: 双栏商品信息展示，标注选项：
   - 是否同款（是/否/不确定）
   - 价格对比（A更贵/A更便宜/相同/无法判断）
   - 质量对比（可选）
   - 备注
   - 暂存（草稿）/ 提交标注
3. **通知中心**: 顶部铃铛，显示截止提醒和系统消息

### 复核流程（管理员/复核员）
1. **自动复核触发**: 初标提交后，按实验设定的比例（如30%）随机抽取任务进入复核流程
2. **复核自动分配**: 自动选择待复核任务最少的管理员作为复核员，并发送系统通知
3. **复核任务列表** (`/review-tasks`): 展示分配给复核员的所有待复核任务，显示初标结果摘要
4. **复核工作台** (`/review/:id`): 
   - 复核员视图：显示初标结果参考，填写复标选项并提交
   - 管理员视图：左右两栏并排对比初标/复标结果，不一致字段用红色高亮标出
5. **最终裁定**: 管理员可一键采纳初标、采纳复标，或输入自定义裁定结果
6. **完成归档**: 裁定后任务状态变为 `completed`，最终结果存入 `tasks.finalResult` 字段

### 差异检测
- 自动比较 `is_same_product`、`price_comparison`、`quality_comparison` 三个核心字段
- 任何字段不一致即标记 `hasConflict: true`，在复核队列表格中显示"有分歧"警告

### 统计看板（仪表盘页面）
管理员仪表盘完全重设计，含三大统计模块：
1. **实验完成进度**：水平柱状图展示每个实验的任务完成百分比（已完成/总任务数）
2. **人均标注效率表格**：累计完成任务数、日均标注量、近7天产出
3. **个人准确率排行**：对比初标与复标是否一致，生成准确率百分比，带进度条可视化（绿/黄/红根据准确率分级）
- API：`GET /api/stats/overview`

### 数坊集成配置
- 仪表盘右上角 "数坊集成配置" 按钮
- 配置 API 地址（`shufang_api_url`）和 API 密钥（`shufang_api_key`）
- 配置保存至 `system_settings` 数据库表（密钥在 GET 接口中自动脱敏为 `••••••••`）
- API：`GET /api/settings`、`PUT /api/settings/:key`、`GET /api/settings/shufang-status`

### 实验归档功能（实验详情页）
- 实验详情页头部新增 "归档实验" 按钮（当实验已归档则禁用）
- 点击后弹出确认对话框，执行以下操作：
  1. 导出 `tasks.csv`（含任务状态、分配信息）
  2. 导出 `annotations.csv`（含所有类型的标注记录）
  3. 导出 `experiment.json`（实验配置）
  4. 三个文件打包为 ZIP 自动下载到本地
  5. 若数坊已配置，自动 POST 上传至数坊 API（请求头 `X-API-Key`、`Content-Type: application/zip`）
  6. 实验状态更新为 `archived`
- 对话框内显示数坊同步状态（成功/未配置/失败）
- API：`POST /api/experiments/:id/archive`

## 实验编码
新建实验时，后端自动生成唯一编码，格式：`EXP-{YYYYMMDD}-{PRIORITY}-{6位随机大写字母数字}`，例：`EXP-20260226-P2-A3F9KR`。创建表单不含编码输入框，编码由服务器端生成。

## 侧边栏 Logo
侧边栏左上角内嵌 SVG Logo：蓝色（#2563EB）圆角方块 + 白色对勾，旁边为平台名称"数据标注实验平台"和当前用户角色标签。

## 标注工作台截止时间倒计时
标注工作台头部显示实验截止时间 + 实时倒计时（每秒刷新）。颜色规则：>3天 灰色；1-3天 amber；<24h 红色加粗；已超期 红色背景。

## 后台定时任务
- 每小时检查 in_progress 实验的 deadline
- 距截止 ≤24h 生成 warning 通知，≤1h 生成 urgent 通知
- 只针对有未完成任务的标注员

## 运行环境
- Workflow 命令：`bash -c 'trap "" HUP; exec npm run dev'`（bash 级 SIGHUP 屏蔽，同时留在 Replit 监控的进程组中以保证端口检测正常）
- `server/index.ts` 中的稳定性保护：
  1. `process.on('SIGHUP', () => {})` — 防止 Node.js 主进程因 SIGHUP 退出
  2. `process.exit` 拦截（code === 1）— esbuild 是 Go 二进制，Go runtime 会重置 SIG_IGN，因此 esbuild 仍会被 SIGHUP 杀死；Vite 的 customLogger 随后调用 `process.exit(1)`，这里拦截该调用以保持服务器存活，Vite 会在下次请求时自动重启 esbuild

## 关键文件
- `shared/schema.ts` - 全部数据库表定义和 TypeScript 类型
- `server/storage.ts` - DatabaseStorage 接口实现
- `server/routes.ts` - API 路由 + 定时任务
- `client/src/hooks/use-auth.ts` - 认证（localStorage current_user）
- `client/src/pages/my-tasks.tsx` - 标注员实验级任务列表（优先级卡片视图）
- `client/src/pages/experiment-task-list.tsx` - 实验内联标注表格（Excel 式，`/my-tasks/:id`）
- `client/src/pages/annotation-workspace.tsx` - 标注工作台（单任务详情模式）
- `client/src/pages/experiment-detail.tsx` - 实验详情+任务分配
- `client/src/components/layout/dashboard-layout.tsx` - 通知铃铛
- `client/src/components/layout/app-sidebar.tsx` - 角色化导航侧边栏
