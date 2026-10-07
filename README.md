# AI Career Planning Agent · 大学生职业规划智能体

一个面向在校大学生与应届毕业生的 AI 职业规划全栈 Web 应用。项目将简历解析、自我认知测评、学生能力画像、岗位画像、人岗匹配、职业路径图谱与个性化发展报告整合在同一套流程中，帮助学生回答三个核心问题：**我适合什么、为什么适合，以及下一步应该做什么。**

> 本项目目前处于比赛展示与持续开发阶段。系统生成的匹配结果和职业建议仅用于学习、求职准备与生涯探索，不构成招聘录用承诺或唯一的职业决策依据。

## 核心功能

- **简历解析与学生画像**：支持上传 PDF / Word 简历或手动填写，提取教育、实习、项目、证书、技能与求职意向，并计算画像完整度。
- **多维自我认知测评**：整合霍兰德职业兴趣、MBTI、多元智能与工作价值观，形成完整的个人特征描述。
- **人岗匹配与差距分析**：综合专业、学历、实习、专业技能、软技能和职业兴趣进行规则化评分，展示匹配依据、命中技能与待补能力。
- **岗位画像与职业探索**：提供岗位职责、学历要求、薪资、城市、技能、行业信息和“典型的一天”等内容。
- **职业路径图谱**：通过可视化图谱展示岗位的纵向晋升路线和横向转岗路线，并说明路径之间的技能关联。
- **韦恩四区职业分析**：围绕职业经验、个人兴趣与岗位情况，生成基石区、稳定区、前景区和发展区的差异化建议。
- **个性化行动计划**：根据目标岗位生成短期学习计划、中期项目或实习安排，以及可复盘的阶段指标。
- **报告生成与导出**：支持报告生成、内容润色、局部编辑，以及 PDF / DOCX 导出。
- **离线演示模式**：没有配置大模型 API Key 时自动使用确定性规则和模板，核心流程仍可完整运行。

## 产品流程

```text
注册 / 登录
    ↓
选择虚拟形象
    ↓
上传简历或完善个人档案
    ↓
完成职业兴趣与个人特征测评
    ↓
生成学生能力画像
    ↓
岗位推荐与人岗匹配
    ↓
查看岗位详情、晋升路径与转岗图谱
    ↓
选择目标岗位
    ↓
生成韦恩四区建议与阶段性行动计划
    ↓
编辑并导出职业发展规划报告
```

## 数据与知识库

当前演示知识库包含：

- **125 个岗位画像节点**
- **449 条职业路径关系**
  - 235 条晋升关系
  - 214 条转岗关系
- 招聘岗位数据、职业经验资料和职业规划方法论素材

岗位画像数据由招聘数据清洗、聚合后生成，主要包含岗位名称、学历、薪资、城市、行业、专业技能、软技能和职业路径等字段。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、React Router、Zustand、Tailwind CSS |
| 数据可视化 | ECharts、echarts-for-react |
| 后端 | Python、FastAPI、Pydantic、Uvicorn |
| AI 服务 | OpenAI Compatible API，可配置 DeepSeek 等兼容模型 |
| 数据与知识库 | JSON、Excel、Markdown |
| 本地持久化 | JSON 文件存储（演示模式） |
| 报告导出 | html2pdf.js、python-docx |
| 部署 | Docker、Render Blueprint |

## 系统架构

```text
┌──────────────────────────────────────────┐
│ React + TypeScript + Tailwind + ECharts │
│ 登录 / 画像 / 测评 / 匹配 / 图谱 / 报告 │
└───────────────────┬──────────────────────┘
                    │ REST API
┌───────────────────▼──────────────────────┐
│                 FastAPI                  │
│ 认证 · 简历解析 · 测评解释 · 匹配 · 报告 │
└──────────┬───────────────┬───────────────┘
           │               │
┌──────────▼─────────┐ ┌───▼────────────────┐
│ 规则匹配与离线模板 │ │ OpenAI 兼容 LLM API │
└──────────┬─────────┘ └────────────────────┘
           │
┌──────────▼───────────────────────────────┐
│ 岗位画像 / 路径图谱 / 职业知识库 / 档案 │
└──────────────────────────────────────────┘
```

## 项目结构

```text
ai-career-planning-agent/
├── app/
│   ├── backend/
│   │   ├── main.py             # FastAPI 应用、接口与报告生成
│   │   ├── matching.py         # 人岗匹配规则与评分逻辑
│   │   ├── llm.py              # OpenAI 兼容模型封装与离线兜底
│   │   ├── store.py            # 演示环境数据存储
│   │   └── requirements.txt    # Python 依赖
│   ├── frontend/
│   │   ├── public/             # 静态资源
│   │   └── src/
│   │       ├── components/     # 通用组件
│   │       ├── data/           # 测评题目与前端字典
│   │       ├── pages/          # 登录、画像、测评、岗位、报告页面
│   │       ├── api.ts          # 后端 API 封装
│   │       └── store.ts        # Zustand 状态管理
│   ├── data/                   # 岗位画像、图谱与本地知识库
│   └── scripts/                # 数据清洗、生成与采集脚本
├── Dockerfile                  # 前端构建 + FastAPI 运行镜像
├── render.yaml                 # Render Blueprint 配置
└── README.md
```

## 本地运行

### 环境要求

- Python 3.10 或更高版本
- Node.js 18 或更高版本
- npm
- 可选：OpenAI 兼容服务的 API Key

### 1. 克隆仓库

```bash
git clone https://github.com/kangjun010401-prog/ai-career-planning-agent.git
cd ai-career-planning-agent
```

### 2. 安装并启动后端

```bash
python -m venv .venv
```

Windows PowerShell：

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r app\backend\requirements.txt
uvicorn app.backend.main:app --reload --port 8000
```

macOS / Linux：

```bash
source .venv/bin/activate
pip install -r app/backend/requirements.txt
uvicorn app.backend.main:app --reload --port 8000
```

后端默认运行在 `http://localhost:8000`，接口文档位于 `http://localhost:8000/docs`。

### 3. 配置 AI 服务（可选）

未配置 API Key 时，系统自动启用离线演示模式。若需要使用真实大模型，可设置：

```env
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=你的_API_Key
LLM_MODEL=deepseek-chat
```

请通过本地环境变量或部署平台的 Secret 管理功能配置密钥，不要将真实密钥提交到 GitHub。

### 4. 安装并启动前端

打开另一个终端：

```bash
cd app/frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`。开发服务器会将 `/api` 请求代理到 `http://localhost:8000`。

## Docker 运行

```bash
docker build -t ai-career-planning-agent .
docker run --rm -p 10000:10000 -e PORT=10000 ai-career-planning-agent
```

浏览器访问 `http://localhost:10000`。

Dockerfile 使用多阶段构建：第一阶段生成 React 静态资源，第二阶段安装 Python 依赖并通过 FastAPI 同源提供页面和 API。

## 部署到 Render

仓库根目录已经提供 `render.yaml`，可以直接通过 Blueprint 部署：

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fkangjun010401-prog%2Fai-career-planning-agent)

部署时选择 `Free` 实例即可完成作品演示。免费实例闲置后会休眠，首次重新访问可能需要等待一段时间。

> 当前用户档案使用 JSON 文件保存。Render 免费实例的本地文件系统不保证持久化，服务重启或重新部署后，用户数据可能丢失。正式生产环境建议迁移至 PostgreSQL / Supabase，并补充完整的用户权限和隐私保护机制。

## 常用命令

| 目录 | 命令 | 说明 |
| --- | --- | --- |
| `app/frontend` | `npm run dev` | 启动前端开发服务器 |
| `app/frontend` | `npm run build` | 生成生产环境前端资源 |
| `app/frontend` | `npm run preview` | 预览生产构建 |
| 仓库根目录 | `uvicorn app.backend.main:app --reload --port 8000` | 启动后端开发服务器 |
| 仓库根目录 | `docker build -t ai-career-planning-agent .` | 构建生产镜像 |

## 配置与数据安全

- `.env`、API Key、用户数据、依赖目录、虚拟环境和构建产物均通过 `.gitignore` / `.dockerignore` 排除。
- 请勿上传真实学生的简历、手机号、身份证号、邮箱、测评结果或其他个人敏感信息。
- 公开演示时建议使用虚构资料，并定期清理测试账户和报告。
- 当前认证与 JSON 存储适用于演示，不建议未经安全加固直接用于正式高校或招聘业务。
- 生产环境应使用专业密码哈希、数据库、访问控制、日志审计、备份和隐私政策。

## 当前状态

项目已完成主要演示闭环，包括学生画像、自我认知测评、岗位探索、人岗匹配、职业路径图谱和发展报告。后续计划包括：

- 将 JSON 存储迁移至 PostgreSQL / Supabase
- 引入持久化会话与更完整的用户权限体系
- 增加向量检索和语义技能匹配
- 完善准确率测试集与人工评测流程
- 增加高校管理端和学生成长追踪
- 接入稳定的正式域名与持续部署流程

欢迎通过 Issue 提交问题、功能建议或改进意见。

## License

本项目暂未添加开源许可证。未经作者明确授权，不代表允许复制、修改或用于商业用途。
