---
name: arace
description: >-
  AgentRace (arace) integration skill. Use to run multi-agent benchmarks, compare coding results
  across multiple local AI models (Claude, Codex, Aider, Gemini) in isolated Git worktrees,
  perform objective serial verification (build/lint/test), view fact dashboards, and merge winning solutions.
---

# AgentRace (arace) Plugin & Skill Guide

`arace` 是面向私有代码库的本地多 Agent 并行比拼与客观验真工具。在隔离的 Git 工作树 中并发运行多个 Agent，利用项目自身测试套件串行独占验真，一键合并最佳改动，数据完全不出本地。

## 适用场景

1. **多模型方案竞速**：当需要对比不同 AI 模型（如 Claude vs Codex vs Aider）在当前私有代码库中的编码表现时。
2. **客观门禁验真**：不依赖主观打分，直接通过项目的 `build_cmd`、`lint_cmd` 与 `test_cmd` 获取客观的通过率与测试用例数。
3. **改动分流审查**：清晰区分业务代码改动（Source Diff）与测试用例改动（Test Diff），防止模型删改测试断言作弊。
4. **安全一键合并**：通过 `arace keep <agent>` 将胜出方案合并回主分支，或通过 `arace discard` 丢弃所有临时环境。

## 常用命令

### 1. 运行比拼
```bash
# 启动多 Agent 竞速（默认使用项目配置中的 agents）
node ./bin/arace.js run "任务描述"

# 指定参与竞速的 Agent 和超时时间
node ./bin/arace.js run "优化数据库连接池超时机制" --with claude,codex --timeout 300s

# 允许在有未提交改动的工作区运行
node ./bin/arace.js run "修复并发竞态问题" --allow-dirty
```

### 2. 差异查看与合并决策
```bash
# 查看所有参与 Agent 的改动 diff
node ./bin/arace.js diff

# 查看特定 Agent 的 diff 摘要
node ./bin/arace.js diff claude --stat

# 合并选定 Agent 的代码并自动清理临时 Worktree
node ./bin/arace.js keep claude

# 放弃全部比拼分支并清理环境
node ./bin/arace.js discard
```

### 3. 环境检测与历史画像
```bash
# 检测本机已安装可用的 Agent CLI
node ./bin/arace.js detect

# 检查环境完整性与孤儿 Worktree
node ./bin/arace.js doctor --fix

# 查看当前仓库的历史比拼表现画像
node ./bin/arace.js stats --since 30d
```

## 配置定制 (`.arace.yaml`)

可以在项目根目录的 `.arace.yaml` 中配置验真指令与文件匹配规则：

```yaml
version: 1

workspace:
  prepare_cmd: "npm install"
  test_paths:
    - "test/**"
    - "tests/**"
    - "src/**/*.spec.ts"
    - "src/**/*.test.ts"

verify:
  build_cmd: "npm run build"
  lint_cmd: "npm run lint"
  test_cmd: "npm test"
  timeout_per_step: 180s

defaults:
  agents:
    - claude
    - codex
  timeout: 600s
```
