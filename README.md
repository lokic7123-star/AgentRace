# AgentRace (arace)

> **面向私有代码库的本地多 Agent 并行比拼与客观验真工具**
> 在隔离的 Git 工作树（Git Worktree）中并发运行多个 Agent，利用项目自身测试套件串行独占验真，一键合并最佳改动，数据 100% 留在本地。

---

## 🌟 核心特性与解决的痛点

- **公网 Benchmark 失真**：私有业务代码库结构复杂，公开排行榜无法反映 Agent 真实表现。`arace` 直接在本地实际工程上真实比拼。
- **并发写冲突消除**：基于 Git Worktree 为每个参与比拼的 Agent 创建完全隔离的独立工作目录（`.arace/worktrees/<run_id>/<agent>`），互不干扰。
- **改动客观分流 (Source Diff vs Test Diff)**：自动将代码增删拆分为“业务代码改动”与“测试文件改动”，一旦模型修改或削弱测试用例断言，事实看板直接标记 `(Modified)`，杜绝模型作弊。
- **串行独占验真 (Gate 状态)**：在隔离树中独占串行执行 `build_cmd`、`lint_cmd`、`test_cmd`，避免本地端口占用与数据库锁竞争。
- **数据 100% 本地化**：零遥测、零数据上云，基于本地 SQLite 记录历史比拼与模型画像统计（`arace stats`）。
- **Antigravity 深度集成**：内置 Antigravity Skill、Rule 与 Plugin 清单，支持在 Antigravity 智能体中无缝调用。

---

## 🚀 快速开始

### 1. 安装与配置

本项目为纯 Node.js ESM 架构，内置支持原生 SQLite（Node.js >= 22.5.0）：

```bash
# 全局链接或本地运行
npm link
# 或直接通过 node 调用
node ./bin/arace.js --help
```

### 2. 核心比拼工作流

```bash
# 1. 环境自检
arace doctor

# 2. 探测本机已安装的 Agent CLI (Claude Code, OpenAI Codex, Aider, Gemini 等)
arace detect

# 3. 启动比拼 (自动执行五阶段流水线)
arace "优化连接池超时重试机制" --with claude,codex

# 4. 查看改动 Diff
arace diff claude

# 5. 合并胜出方案并自动清理临时 Worktree 环境
arace keep claude

# 或丢弃所有比拼改动
arace discard

# 6. 查看历史画像统计
arace stats --since 30d
```

---

## 📊 终端事实看板输出规范

```text
RACE RESULTS (Run ID: 8f2a)
Base Commit: a1b2c3d (main)
Task: "Fix concurrency lock timeout in connection pool"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent    Duration   Build   Lint   Tests        Source Diff   Test Diff
claude   18.4s      ✓       ✓      14/14 pass   +42 / -10     0 / 0
codex    14.2s      ✓       ✗      11/14 pass   +18 / -4      -5 / +2 (Modified)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
  → arace diff          Show full diff
  → arace keep claude   Merge changes to current branch & cleanup
  → arace discard       Discard all worktrees
```

---

## ⚙️ 配置文件规范

### 项目级配置 (`.arace.yaml`)

```yaml
version: 1

# 环境隔离与依赖配置
workspace:
  prepare_cmd: "pnpm install --frozen-lockfile" # 依赖初始化或准备命令
  test_paths:                                   # 判定为测试文件的匹配规则
    - "test/**"
    - "tests/**"
    - "src/**/*.spec.ts"
    - "src/**/*.test.ts"

# 验真流水线 (在各自 Git 工作树独占串行执行)
verify:
  build_cmd: "pnpm run build"
  lint_cmd: "pnpm run lint"
  test_cmd: "pnpm test"
  timeout_per_step: 180s

# 默认运行参数
defaults:
  agents:
    - claude
    - codex
  timeout: 600s
```

---

## 🧩 Antigravity Plugin 集成

本项目已内置 Antigravity Customization 标准目录：

- [`.agents/skills/arace/SKILL.md`](file:///d:/Antigravity-project/.agents/skills/arace/SKILL.md)：Agent 技能描述与调用指南
- [`.agents/rules/arace.md`](file:///d:/Antigravity-project/.agents/rules/arace.md)：竞速与门禁规则
- [`plugins/arace/plugin.json`](file:///d:/Antigravity-project/plugins/arace/plugin.json)：插件元数据

在 Antigravity 中遇到复杂代码重构或模型对比任务时，智能体会自动发现并调用 `arace` 执行多 Agent 隔离竞速与客观验真。

---

## 🧪 自动化测试

```bash
npm test
```
包含 19 个单元与端到端集成测试用例，覆盖配置解析、Git Worktree 隔离、Diff 分流、SQLite 持久化以及 CLI 完整生命周期。
