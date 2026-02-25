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
| experiments | 实验（含截止时间、复核设置） |
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
1. **我的任务**: 显示分配给自己的待完成任务列表（含实验信息、截止时间）
2. **标注工作台**: 双栏商品信息展示，标注选项：
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

## 后台定时任务
- 每小时检查 in_progress 实验的 deadline
- 距截止 ≤24h 生成 warning 通知，≤1h 生成 urgent 通知
- 只针对有未完成任务的标注员

## 关键文件
- `shared/schema.ts` - 全部数据库表定义和 TypeScript 类型
- `server/storage.ts` - DatabaseStorage 接口实现
- `server/routes.ts` - API 路由 + 定时任务
- `client/src/hooks/use-auth.ts` - 认证（localStorage current_user）
- `client/src/pages/my-tasks.tsx` - 标注员任务列表
- `client/src/pages/annotation-workspace.tsx` - 标注工作台
- `client/src/pages/experiment-detail.tsx` - 实验详情+任务分配
- `client/src/components/layout/dashboard-layout.tsx` - 通知铃铛
- `client/src/components/layout/app-sidebar.tsx` - 角色化导航侧边栏
