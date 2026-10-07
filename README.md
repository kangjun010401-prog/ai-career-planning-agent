# A13 AI 大学生职业规划智能体

React + TypeScript 前端与 FastAPI 后端组成的职业规划 Web 应用。生产环境由 FastAPI 同源提供前端静态页面和 `/api` 接口。

仓库根目录包含 `render.yaml`。在 Render 中连接本仓库并创建 Blueprint/Web Service 后，平台会自动安装依赖、构建前端并启动 FastAPI。

未设置 `LLM_API_KEY` 时，系统自动使用离线规则和模板，完整演示流程仍可运行。
