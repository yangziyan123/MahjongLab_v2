# 阶段 3 验收报告

## 1. 阶段目标

阶段 3 的目标是把复盘产品从“能看报告”推进到“能导入真实外部牌谱，并把偏差巡目沉淀成训练材料”。

按当前实现，阶段 3 包含三件事：

- `Tenhou` 导入正式可用
- `Majsoul` 采用“导出文件导入”方案落地
- 报告页到错题库的训练闭环打通

## 2. 完成了哪些

### 2.1 外部牌谱导入能力

已完成：

- 后端接通 `tenhou_url / tenhou_id`
- 后端接通 `majsoul_file`
- `Tenhou` 原始牌谱可下载并转换为标准化 `mjai`
- `Majsoul` 导出文件可转换为标准化 `mjai`
- 转换产物会写入 `raw_input_object_key / normalized_mjai_object_key`
- 导入失败时可返回可读错误信息

对应文件：

- [services/api/app/review_engine.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/review_engine.py)
- [services/api/app/config.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/config.py)
- [services/api/app/main.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/main.py)

### 2.2 训练入口与错题库

已完成：

- 新增 `mistake_items` 数据表
- 新增 `POST /api/reviews/{review_id}/mistakes`
- 新增 `GET /api/mistakes`
- 新增 `DELETE /api/mistakes/{mistake_id}`
- 报告页可把偏差巡目加入错题库
- 错题库页可回跳到对应报告和对应巡目
- 删除报告时会级联清理关联错题

对应文件：

- [services/api/app/models.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/models.py)
- [services/api/app/schemas.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/schemas.py)
- [services/api/app/main.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/main.py)
- [apps/web/src/app/pages/review/ReviewReport.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewReport.tsx)
- [apps/web/src/app/pages/training/MistakeLibrary.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/training/MistakeLibrary.tsx)
- [apps/web/src/app/routes.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/routes.tsx)

### 2.3 训练统计摘要

已完成：

- 复盘摘要增加：
  - 总失误数
  - 大失误数
  - 立直判断偏差数
  - 鸣牌判断偏差数
  - 防守失误数
- 复盘项增加训练标签：
  - `defense`
  - `riichi_judgment`
  - `call_judgment`
  - `efficiency`
  - `attack`
- 首页增加错题库条目计数

对应文件：

- [services/api/app/review_engine.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/review_engine.py)
- [services/api/app/main.py](/d:/Code/MahjongLab/MahjongLab/services/api/app/main.py)
- [apps/web/src/app/pages/Home.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/Home.tsx)
- [apps/web/src/app/pages/review/ReviewReport.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewReport.tsx)

### 2.4 前端导入页与导航

已完成：

- 导入页开放 `Tenhou` 链接 / ID
- 导入页开放 `Majsoul` 导出文件上传入口
- 保留 `Majsoul URL` 为未开放态
- 首页和历史页增加错题库导航

对应文件：

- [apps/web/src/app/pages/review/ReviewImport.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewImport.tsx)
- [apps/web/src/app/pages/Home.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/Home.tsx)
- [apps/web/src/app/pages/review/ReviewHistory.tsx](/d:/Code/MahjongLab/MahjongLab/apps/web/src/app/pages/review/ReviewHistory.tsx)

## 3. 遗留问题

### 3.1 `Majsoul URL` 直连仍未做

当前状态：

- 已支持 `Majsoul` 导出文件导入
- 仍不支持 `majsoul_url` 直连抓取

影响：

- 不阻塞阶段 3 目标
- 这属于刻意不做的高风险抓取方案，不应阻塞进入阶段 4

### 3.2 外部网络仍影响 `Tenhou` 下载稳定性

当前状态：

- `Tenhou` 下载链路已可用
- 但成功率仍依赖外网和 `tenhou.net`

影响：

- 不影响本阶段功能完成
- 属于阶段 4 需要继续加固的稳定性项

## 4. 验收成果

本阶段已实测通过以下结果：

- `python -m compileall services/api/app` 成功
- `apps/web` 执行 `npm.cmd run build` 成功
- `tenhou_id` 使用缓存好的 `raw + normalized` 产物可跑到 `completed`
- `majsoul_file` 可跑到 `completed`
- `majsoul_file -> review -> mistake_item` 主链路跑通
- 删除带错题的报告后，关联错题会被清理

本次联调得到的典型结果：

- `tenhou_id` 任务成功进入 `completed`
- `majsoul_file` 任务成功进入 `completed`
- 两条链路都生成 `review_id`
- 两条链路都生成：
  - `reviewed_decision_count=45`
  - `mistake_count=18`
  - `high_deviation_count=10`
  - `medium_deviation_count=8`
- 错题库成功写入并可按 `review_entry_id` 回跳报告
- 首页 `dashboard summary` 可返回 `mistake_count`

## 5. 验收结论

阶段 3 结论：

- `通过（按阶段 3 开发目标口径）`

说明：

- `Tenhou` 导入已完成
- `Majsoul` 已按“导出文件导入”方案完成
- 错题库、训练入口和训练摘要统计已完成
- `Majsoul URL` 直连不属于本阶段必须项，继续保持不做

## 6. 下一阶段入口

下一步进入阶段 4：

- 做下载失败重试、任务稳定性和超时控制
- 补固定回归牌谱集
- 补 API 集成测试和前端 E2E
- 把阶段 3 的导入与训练链路作为后续加固对象

## 7. 文档说明

- 本报告不是冻结文档
- 如果阶段 3 的实现范围、验证结果或阶段边界发生变化，直接修改本文档
- 后续阶段继续沿用同样格式产出验收报告
