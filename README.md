# teacherHelper

teacherHelper 是面向教师的本地 Windows 桌面备课助手。应用使用 Electron 承载桌面壳，React 提供工作台界面，Node 服务负责调用硅基流动、生成结构化教案、导出 Word、提交视频任务、生成互动题目演示页，并把设置与历史记录保存在本机。

## 功能

- 教案生成：输入教学知识点后，生成包含教学目标、重点、难点、易混点、课堂流程、板书设计、例题、讲解步骤、课堂提问、作业建议和 Markdown 正文的教案。
- 视频脚本与视频任务：教案中会生成视频脚本和视频提示词；当视频模型 API Key 与模型名已配置时，会自动向硅基流动提交视频生成任务，并记录任务状态、`requestId` 和结果信息。
- 互动题目演示：输入数学应用题后，应用会分析题型并生成本地 HTML 演示页。当前包含运动问题演示、一元方程演示，以及工程、几何等简单兜底演示。
- 历史记录：保存已生成的教案、互动演示和视频任务，便于回看标题、题目、生成时间、演示目录、导出路径和视频状态。
- 设置：在应用内保存文本模型与视频模型的 API Key 和模型名；可随时清空本地配置。

## 开发启动

首次准备依赖：

```powershell
npm install
```

启动本地 Electron 开发模式：

```powershell
npm run dev
```

构建生产产物：

```powershell
npm run build
```

## 验证命令

提交前建议按下面顺序运行完整自动验证：

```powershell
npm run test:run
npm run test:e2e
npm run lint
npm run build
npx tsc --noEmit -p tsconfig.node.json
```

其中：

- `npm run test:run` 运行 Vitest 单元与组件测试。
- `npm run test:e2e` 运行 Playwright 互动演示渲染检查。
- `npm run lint` 运行 TypeScript 类型检查。
- `npm run build` 运行完整桌面应用构建。
- `npx tsc --noEmit -p tsconfig.node.json` 单独检查 Electron 与 Node 主进程相关 TypeScript 配置。

## 硅基流动设置

打开应用后进入“设置”页面，填写并保存：

- 文本 API Key
- 文本模型名，例如 `Qwen/Qwen3-32B`
- 视频 API Key
- 视频模型名，例如 `Wan-AI/Wan2.2-T2V-A14B`

文本模型用于教案生成和题目演示分析。视频模型用于根据教案的视频脚本与提示词提交视频生成任务。设置会保存在本机，不会提交到仓库。

也可以在测试或开发时设置数据目录，避免污染默认应用数据：

```powershell
$env:TEACHERHELPER_DATA_DIR = "D:\teacherHelper\teacherhelper-data"
npm run dev
```

## 数据存储

默认数据根目录来自 Electron 的 `app.getPath("userData")`，应用会在其下使用 `teacherhelper-data` 子目录。设置 `TEACHERHELPER_DATA_DIR` 后，会改用该环境变量指向的目录。

当前落盘文件和目录包括：

- `settings.json`：文本模型和视频模型的 API Key、模型名。
- `history.json`：教案、互动演示和视频任务历史。
- `exports\*.docx`：导出的 Word 教案文件。
- `demos\<id>\index.html`：生成的本地互动演示页面。

仓库 `.gitignore` 已忽略本地数据目录和 `.env`，请不要把真实 API Key 写入源码或提交到版本库。

## 限制

- 真实生成教案、分析题目演示和提交视频任务都需要有效的 SiliconFlow API Key 与可用模型名。
- 没有配置视频模型时，教案仍可包含视频脚本和视频提示词，但不会真实提交视频生成任务。
- Playwright 端到端测试检查的是本地演示页面渲染，不会验证真实硅基流动接口。
- 视频任务状态取决于硅基流动接口返回值与账号额度，失败原因会写入历史记录。
