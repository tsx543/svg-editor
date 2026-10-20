# Lab1 Phase 1：SVG 编辑器（CLI）

- Git 仓库地址：[https://github.com/tsx543/svg-editor](https://github.com/tsx543/svg-editor)（公开仓库）。
- 最终版本标签：`final`（开发与验收完成后创建，目前尚未创建）。
- 截止时间：10 月 31 日 23:59，以课程平台为准。

按课程平台要求，最终上传一份包含 Git 仓库地址的 `README.md`。本文件作为该提交文件的基础，完成作业后更新最终信息。

## 当前进度

**阶段 C 已完成：基础图形、编辑撤销、层级与顺序。** 六种图形和十种编辑操作已实现；下一步是阶段 D 的 SVG 文件读写。

| 已实现命令 | 功能 |
| --- | --- |
| `init/canvas` | 新建、查询及修改画布尺寸 |
| `create` | 创建 `rect/circle/ellipse/line/text/g`，全部支持 `in <containerId>` |
| `tree/show/help` | 显示几何属性与层级、查询父级与明细、查看全部命令语法 |
| `move/scale/set/delete` | 移动、缩放、设置白名单属性与文字、删除整棵子树；组和叶子统一操作 |
| `group/ungroup/addto` | 收编已有图形、解散嵌套组、调整归属；保留顺序并拒绝循环 |
| `front/back` | 在当前父级内移到最上层/最下层，不改变其他层级 |
| `undo/redo` | 支持全部十种编辑；一条编辑一个单元，新编辑清 redo，文档操作后禁止撤销重做 |

`read/save` 尚未开放，CLI 和 help 会明确提示尚未实现。当前图形只保存在内存中，退出后不保留；SVG 文件读写将在阶段 D 完成。

正式的[架构方案、过程记录、一致性自查和质量保证说明](https://github.com/tsx543/svg-editor/blob/main/doc/README.md)保存在 `doc/README.md`，其中明确区分计划、已完成内容和待验证事项。这里使用完整链接，上传本 README 后也能访问正式文档。本地操作路线见[作业完成指南](作业完成指南.md)。

## 本地运行

需要 Node.js 22 或更高版本及 npm。在本仓库根目录执行：

```bash
npm ci
npm run cli
```

交互终端显示 `svg>`，逐行输入命令；macOS 下按 Ctrl+D 退出。支持双引号文字、整行 `#` 注释，颜色中的 `#` 保留。

也可以回放创建、编辑恢复和层级调整的演示脚本：

```bash
npm run cli < examples/stage-a-flowchart.txt
npm run cli < examples/stage-b-editing.txt
npm run cli < examples/stage-c-hierarchy.txt
```

## 检查与构建

```bash
npm run typecheck
npm test
npm run build
npm start
```

`typecheck` 检查业务与测试源码，`test` 运行模型、应用、编辑历史、解析器、真实 CLI 进程和架构检查，`build` 生成 `dist/`，`start` 运行构建产物。阶段 C 的 **117 项测试全部通过**，类型检查与构建成功；开发与构建入口的层级调整回放输出一致。测试包含 120 层嵌套、宽树多选及深层多选的复制与遍历预算。阶段 A 已检查交互终端的提示符、错误后继续和 EOF 退出。

依赖记录在 `package.json` 和 `package-lock.json` 中。npm 缓存放在本项目的 `.npm-cache/`，不提交到 Git。

## 初始化记录（2026-10-19）

- 使用当前已连接的 GitHub 账号 `tsx543` 配置本仓库的提交身份，邮箱采用 [GitHub 的隐私邮箱格式](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)，不修改全局 Git 配置。
- 默认 npm 缓存目录在当前环境不可写，因此改用项目内缓存；没有修改系统目录权限。
- 在 Node.js 26.3.0、npm 11.16.0 下验证了依赖安装、类型检查、开发启动、构建和构建后启动；从锁文件重新安装后也通过类型检查与启动检查。
- 用户选择的公开仓库 `tsx543/svg-editor` 已创建，初始化提交已推送；后续按实际开发阶段逐步提交与推送。
- 首次推送发现旧 HTTPS 凭据失效，且无可用 SSH 登录。随后通过 GitHub 官方 CLI 完成用户授权，将凭据存入 macOS 钥匙串，仅对本仓库配置凭据助手。辅助工具位于 `.tools/`，已排除出 Git。
