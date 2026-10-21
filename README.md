# Lab1 Phase 1：SVG 编辑器（CLI）

- Git 仓库地址：[https://github.com/tsx543/svg-editor](https://github.com/tsx543/svg-editor)（公开仓库）。
- 最终版本标签：[final](https://github.com/tsx543/svg-editor/tree/final)。
- 截止时间：10 月 31 日 23:59，以课程平台为准。

按课程平台要求，上传本 `README.md` 文件即可，其中已包含公开 Git 仓库地址。代码、正式工程文档和最终标签保存在仓库中。

## 当前进度

**2026-10-21：工程最终验收通过，179 项测试通过。** 19 条命令全部实现，支持六种图形、十种可撤销编辑、SVG 读写、缺失 id 补全与文件操作后的历史屏障。代码与文档已推送，`final` 指向最终工程版本；用户亲自演示与课程平台上传仍需完成。

| 已实现命令 | 功能 |
| --- | --- |
| `init/canvas` | 新建、查询及修改画布尺寸 |
| `create` | 创建 `rect/circle/ellipse/line/text/g`，全部支持 `in <containerId>` |
| `tree/show/help` | 显示几何属性与层级、查询父级与明细、查看全部命令语法 |
| `move/scale/set/delete` | 移动、缩放、设置白名单属性与文字、删除整棵子树；组和叶子统一操作 |
| `group/ungroup/addto` | 收编已有图形、解散嵌套组、调整归属；保留顺序并拒绝循环 |
| `front/back` | 在当前父级内移到最上层/最下层，不改变其他层级 |
| `read/save` | 读取与原子保存 SVG；缺失 id 自动补全并警告，成功后建立历史屏障 |
| `undo/redo` | 支持全部十种编辑；一条编辑一个单元，新编辑清 redo，文档操作后禁止撤销重做 |

新建文档后首次保存须指定路径，例如 `save demo.svg`；成功 `read` 后，无参数 `save` 保存到该读入路径。带路径另存不会改变默认路径，`init` 会清除它。

SVG 支持六种标签、公共样式、文字属性及嵌套 `translate`/正等比 `scale`。旋转、非等比缩放、未知标签或属性、根 `style/transform` 等会整体报错。完整兼容范围见正式文档；`box` 与插件仍留待后续课程阶段。

正式的[架构方案、过程记录、一致性自查和质量保证说明](https://github.com/tsx543/svg-editor/blob/final/doc/README.md)保存在 `doc/README.md`。亲自操作请按[演示步骤](https://github.com/tsx543/svg-editor/blob/final/doc/演示步骤.md)逐步执行，每步都有预期结果。以上使用完整链接，上传本 README 后也能访问。本地操作路线见[作业完成指南](作业完成指南.md)。

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
npm run cli < examples/stage-d-roundtrip.txt
npm run cli < examples/final-demo.txt
```

阶段 D 脚本生成的 [flowchart.svg](examples/flowchart.svg)、[roundtrip.svg](examples/roundtrip.svg) 和 [transformed-edited.svg](examples/transformed-edited.svg) 可直接在浏览器打开。脚本有两次故意在保存后执行 `undo`，应得到 `error: undo not allowed after io command`，用于演示老师要求的屏障。

最终演示脚本将结果写到 `/tmp/svg-editor-demo.svg`，有三条预期错误（一次 `nothing to redo`，两次历史屏障）和一条补 id 警告。自动回放不能代替用户亲自操作。

## 检查与构建

```bash
npm run typecheck
npm test
npm run build
npm start
```

`typecheck` 检查业务与测试源码，`test` 运行模型、SVG 往返、真实文件、历史、CLI 进程及架构检查，`build` 生成 `dist/`，`start` 运行构建产物。最终验收 **179 项测试全部通过**，类型检查与构建成功；A–D 及最终演示的开发/构建入口输出均一致，保存结果已在浏览器预览。

测试包含深层/多选复制预算、变换下的重挂与缩放、失败保留历史，以及写入/重命名故障和临时文件名碰撞。XML 库 `saxes 6.0.0` 的声明与当前编译器存在兼容问题，工程用 `skipLibCheck` 跳过声明内部检查，业务和测试仍保持严格检查；原因与验证依据记录在正式文档。

依赖记录在 `package.json` 和 `package-lock.json` 中。npm 缓存放在本项目的 `.npm-cache/`，不提交到 Git。

## 初始化记录（2026-10-19）

- 使用当前已连接的 GitHub 账号 `tsx543` 配置本仓库的提交身份，邮箱采用 [GitHub 的隐私邮箱格式](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)，不修改全局 Git 配置。
- 默认 npm 缓存目录在当前环境不可写，因此改用项目内缓存；没有修改系统目录权限。
- 在 Node.js 26.3.0、npm 11.16.0 下验证了依赖安装、类型检查、开发启动、构建和构建后启动；从锁文件重新安装后也通过类型检查与启动检查。
- 用户选择的公开仓库 `tsx543/svg-editor` 已创建，初始化提交已推送；后续按实际开发阶段逐步提交与推送。
- 首次推送发现旧 HTTPS 凭据失效，且无可用 SSH 登录。随后通过 GitHub 官方 CLI 完成用户授权，将凭据存入 macOS 钥匙串，仅对本仓库配置凭据助手。辅助工具位于 `.tools/`，已排除出 Git。
