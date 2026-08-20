---
name: arace
description: >-
  AgentRace (arace) integration skill. Use to run multi-agent benchmarks, compare coding results
  across multiple local AI models (DSH, Claude, Codex, Aider, Gemini) in isolated Git worktrees,
  perform objective serial verification (build/lint/test), view Web Fact Dashboards, and AI-blend winning solutions.
---

# AgentRace (arace) Plugin & Skill Guide

`arace` 是面向私有代码库的本地多 Agent 隔离竞速、客观验真与 AI 融合进化工具。在隔离的 Git 工作树 中并发运行多个 Agent，利用项目自身测试套件串行独占验真，通过 Web 可视化大屏实时监控赛况并一键 AI 融合所有优点，数据完全不出本地。

## 适用场景

1. **多模型方案竞速**：对比 DSH、Claude Code、Codex、Aider 在私有代码库中的实际表现。
2. **客观门禁验真**：通过真实的 `build_cmd`、`lint_cmd` 与 `test_cmd` 获取客观通过率。
3. **AST 级防作弊**：检测模型是否恶意篡改或跳过测试用例。
4. **AI 智能融合（`arace blend`）**：合并 A 的架构 + B 的边界测试，去除缺陷，生成 100% 验证通过的终版代码。
5. **Web 可视化大屏（`arace ui`）**：实时赛况、并排 Diff 对比、一键合并工作台。

## 常用命令

```bash
# 启动 Web 可视化看板
node ./bin/arace.js ui

# 启动多 Agent 竞速
node ./bin/arace.js run "任务描述" --with dsh,claude,codex

# 🤖 AI 智能融合所有优点
node ./bin/arace.js blend --judge dsh

# 文件级精准挑选
node ./bin/arace.js pick src/service.ts:claude test/service.test.ts:dsh

# 合并选定 Agent 的代码并自动清理临时 Worktree
node ./bin/arace.js keep ensemble

# 放弃全部比拼分支并清理环境
node ./bin/arace.js discard
```
