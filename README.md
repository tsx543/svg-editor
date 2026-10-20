# Lab1 Phase 1：SVG 编辑器（CLI）

- Git 仓库地址：[https://github.com/tsx543/svg-editor](https://github.com/tsx543/svg-editor)（公开仓库）。
- 最终版本标签：`final`（开发与验收完成后创建，目前尚未创建）。
- 截止时间：10 月 31 日 23:59，以课程平台为准。

按课程平台要求，最终上传一份包含 Git 仓库地址的 `README.md`。本文件作为该提交文件的基础，完成作业后更新最终信息。

## 当前进度

工程初始化已完成并推送至上方公开仓库：配置了 TypeScript、启动入口、类型检查和构建方式，并已建立 Git 仓库。第三步架构方案已编写，下一步按阶段实现基础编辑器；SVG 编辑命令尚未实现。

正式的[架构方案、过程记录、一致性自查和质量保证说明](https://github.com/tsx543/svg-editor/blob/main/doc/README.md)保存在 `doc/README.md`，其中明确区分计划、已完成内容和待验证事项。这里使用完整链接，上传本 README 后也能访问正式文档。本地操作路线见[作业完成指南](作业完成指南.md)。

## 本地运行

需要 Node.js 22 或更高版本及 npm。在本仓库根目录执行：

```bash
npm ci
npm run cli
```

当前启动入口只显示初始化提示。后续阶段将在同一入口实现作业规定的 `svg>` 交互界面。

## 检查与构建

```bash
npm run typecheck
npm run build
npm start
```

`typecheck` 检查 TypeScript 类型，`build` 生成 `dist/`，`start` 运行构建产物。目前尚无编辑器功能测试，测试会随功能实现一起加入。

依赖记录在 `package.json` 和 `package-lock.json` 中。npm 缓存放在本项目的 `.npm-cache/`，不提交到 Git。

## 初始化记录（2026-10-19）

- 使用当前已连接的 GitHub 账号 `tsx543` 配置本仓库的提交身份，邮箱采用 [GitHub 的隐私邮箱格式](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)，不修改全局 Git 配置。
- 默认 npm 缓存目录在当前环境不可写，因此改用项目内缓存；没有修改系统目录权限。
- 在 Node.js 26.3.0、npm 11.16.0 下验证了依赖安装、类型检查、开发启动、构建和构建后启动；从锁文件重新安装后也通过类型检查与启动检查。
- 用户选择的公开仓库 `tsx543/svg-editor` 已创建，初始化提交已推送；后续按实际开发阶段逐步提交与推送。
- 首次推送发现旧 HTTPS 凭据失效，且无可用 SSH 登录。随后通过 GitHub 官方 CLI 完成用户授权，将凭据存入 macOS 钥匙串，仅对本仓库配置凭据助手。辅助工具位于 `.tools/`，已排除出 Git。
