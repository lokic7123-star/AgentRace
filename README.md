# AgentRace (arace)

> **面向私有代码库的本地多 Agent 隔离竞速、客观验真与 AI 融合进化引擎**
> 在隔离的 Git 工作树（Git Worktree）中并发运行多个 Agent（支持 DSH、Claude、Codex、Aider、Gemini 等），利用项目自身测试套件串行独占验真，通过 Web 可视化大屏实时监控赛况并一键 AI 融合所有优点，数据 100% 留在本地。

---

## 🌟 核心特性

- **多 Agent 物理隔离竞速**：基于 Git Worktree 为各 Agent（DSH、Claude Code、Codex、Aider 等）创建独立沙盒目录（`.arace/worktrees/<run_id>/<agent>`），彻底消除并发代码覆写与脏状态。
- **内置原生 DSH 支持**：支持调度 DeepSeek Harness (DSH) 及其子代理参与比拼，或作为终极裁判执行方案融合。
- **独占串行门禁验真 (Gate 状态)**：在隔离工作树中独占串行执行 `build_cmd`、`lint_cmd`、`test_cmd`，避免本地端口与数据库锁冲突。
- **改动客观分流与 AST 防作弊**：精准区分业务代码改动（Source Diff）与测试文件改动（Test Diff），深度探测并告警模型删除断言或注入 `test.skip` 的作弊行为。
- **AI 裁判与交叉融合 (`arace blend` & `arace pick`)**：提取胜出者的优雅架构 + 对手发现的边界测试用例，生成 100% 验证通过的终版代码，告别单选遗憾。
- **现代交互式 Web 看板 (`arace ui`)**：实时赛况大屏、并排 Diff 对比查看器、融合工作台与战绩画像分析。
- **100% 本地化与零数据上云**：本地 SQLite 记录历史比拼与模型画像，安全无泄漏。

---

## 🚀 快速开始

### 1. 核心命令一览

```bash
# 启动 Web 可视化竞技场与融合工作台
arace ui

# 探测本地可用 Agent (自动识别 DSH, Claude, Codex, Aider...)
arace detect

# 启动多 Agent 隔离竞速
arace "优化 Redis 连接池并发超时重试机制" --with dsh,claude,codex

# 查看并排改动 Diff
arace diff

# 🤖 AI 智能融合所有方案的优点 (生成 ensemble 终版)
arace blend --judge dsh

# 文件级精准挑选
arace pick src/pool.ts:claude tests/pool.test.ts:dsh

# 一键合并终版方案并清理临时环境
arace keep ensemble

# 查看历史战绩画像
arace stats --since 30d
```

---

## 📊 终端事实看板

```text
RACE RESULTS (Run ID: 8f2a)
Base Commit: a1b2c3d (main)
Task: "Fix concurrency lock timeout in connection pool"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent    Duration   Build   Lint   Tests        Source Diff   Test Diff
dsh      16.2s      ✓       ✓      14/14 pass   +38 / -8      +12 / 0
claude   18.4s      ✓       ✓      14/14 pass   +42 / -10     0 / 0
codex    14.2s      ✓       ✗      11/14 pass   +18 / -4      -5 / +2 (Modified)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
  → arace diff          Show full diff
  → arace blend         AI synthesize best traits into an ensemble branch
  → arace keep dsh      Merge changes to current branch & cleanup
  → arace discard       Discard all worktrees
```

---

## ⚙️ 项目级配置 (`.arace.yaml`)

```yaml
version: 1

# 环境隔离与依赖配置
workspace:
  prepare_cmd: "pnpm install --frozen-lockfile"
  test_paths:
    - "test/**"
    - "tests/**"
    - "src/**/*.spec.ts"
    - "src/**/*.test.ts"

# 独占验真流水线
verify:
  build_cmd: "pnpm run build"
  lint_cmd: "pnpm run lint"
  test_cmd: "pnpm test"
  timeout_per_step: 180s

# 默认运行参数
defaults:
  agents:
    - dsh
    - claude
    - codex
  timeout: 600s
```

---

## 🧪 自动化测试

```bash
npm test
```
包含 24 个单元与集成测试用例，覆盖 DSH 适配、AI 融合、AST 静态防作弊、Web API 路由与完整竞速生命周期。
