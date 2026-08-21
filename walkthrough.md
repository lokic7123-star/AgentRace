# AgentRace (arace) 2.0 完整演进与交付文档

本文档汇总 AgentRace 2.0 在安全防御、架构重构、适配器去 Shell 化、桌面端封装与脱网发布全流程的物理验证记录。

---

## 🌟 核心成果与批次执行清单

### 第一部分：P1 安全与稳定性批次
1. **[P1-1] Git Ref 防命令注入** (`src/git.js`)：
   - 导出 `assertSafeGitRef()` 正则白名单校验（`/^[\w][\w./-]*$/`），在 `createWorktree`、`removeWorktree`、`getWorktreeDiff`、`mergeBranchToCurrent` 全链路拦截注入字符。
   - `mergeBranchToCurrent` 改为 `spawnSync('git', ['log', '-n', '1', branchName])` 参数数组形式。
2. **[P1-2] 本机回环绑定** (`src/commands/ui.js`)：
   - `server.listen` 默认绑定 `127.0.0.1`，消除局域网暴露风险，新增 `--host` 参数支持。
3. **[P1-3] Pick 三重别名匹配** (`src/commands/pick.js`)：
   - 补齐与 `keep.js` 完全一致的 `name` / `id` / `role` 匹配，编排模式下支持 `:subtask-1` 或 `:algorithm_architect`。
4. **[P1-4] RunId 加熵** (`src/utils.js`)：
   - 升级至 8 字节安全熵（16 字符 hex），彻底消除工作树目录与 SQLite 主键并发碰撞风险。
5. **[P1-5] Commit 去 Shell 拼接** (`src/git.js`)：
   - `commitWorktreeChanges` 改为 `spawnSync('git', ['commit', '-m', message])`，杜绝引号及特殊字符破坏。

### 第二部分：P2 架构重构与优化
1. **[P2-1] 20+ 适配器去 Shell 化** (`src/adapters/index.js`):
   - `BaseAdapter.run` 引入条件 shell 机制：仅在 Windows 且目标命令为 `.cmd`/`.bat`/`.ps1` 或自定义模板时启用，且使用 `""` 规范转义。
   - 全部 20+ 内置适配器 `buildCommand` 移除手工引号拼接，返回裸参数数组，彻底消除 `DEP0190` 警告。
   - 新增 `tests/adapters.test.js` 专项测试。
2. **[P2-2] 共享依赖重命名与风险声明** (`src/cow.js`, `src/engine.js`, `README.md`)：
   - 重构为 `sharedDepsLinked`，准确反映 NTFS Junction / Symlink 共享依赖语义；README 补充说明及并发风险规避建议。
3. **[P2-3] YAML 引号感知状态机** (`src/config.js`, `tests/config.test.js`)：
   - 实现 `stripYamlComment` 逐字符状态机，精准保护双引号/单引号内部的 `#` 字符。

### 第三部分：P3 细节调优
1. **[P3-1] Stats since 下界保护** (`src/server/api.js`)：
   - `Math.min(3650, Math.max(1, parseInt(since) || 30))`。
2. **[P3-2] Discard 如实报错与失败统计** (`src/commands/discard.js`)：
   - 统计未成功清理的工作树路径，遇残留输出黄色警告并返回错误码。
3. **[P3-3] Dashboard CJK 宽字符对齐** (`src/dashboard.js`)：
   - `getVisibleWidth()` 针对 CJK 双倍宽字符精确计算，消除中文错位。
4. **[P3-4] API Origin 校验** (`src/server/api.js`)：
   - 非 GET 状态变更请求校验 Origin 头，防范 DNS rebinding 与跨站恶意调用。

### 第四部分：桌面端 Electron 封装与发布
1. **[D1] 安装包极致瘦身** (`electron-builder.yml`)：
   - 启用 `compression: maximum`，语言包精简至 `zh-CN` 与 `en-US`，禁用差分冗余包。
2. **[D2] 系统托盘与常驻生命周期** (`desktop/main.js`)：
   - 托盘常驻，关闭窗口最小化到托盘，退出走托盘菜单。
   - 窗口 bounds 大小与位置记忆持久化 (`window-state.json`)。
3. **[离线化] Tailwind 离线脱网支持** (`src/server/public/vendor/tailwind.js`, `index.html`)：
   - 静态化 407 KB Tailwind 引擎，离线/内网 100% 正常渲染。
4. **[入口修复] 打包入口覆盖** (`electron-builder.yml`)：
   - 注入 `extraMetadata.main: desktop/main.js`，保证 NSIS 安装后正常启动窗口。

### 第五部分：命令安全加固
1. **[Doctor 防破坏] 运行态工作树保护** (`src/commands/doctor.js`)：
   - `arace doctor --fix` 清理前检测正在进行的任务状态，活跃任务期间安全跳过，防止误删工作树。

---

## 🧪 自动化测试验证 (40/40 100% PASS)

```text
✔ analyzeTestDiffSecurity (3 tests)
✔ DSH / market agent adapters (2 tests)
✔ detectInstalledAgents includes comprehensive list (1 test)
✔ CLI commands (help, detect, doctor, stats, run mock, pick aliases) (6 tests)
✔ config.js (YAML parser, # in quotes state machine, loadProjectConfig) (3 tests)
✔ database persistence & stats aggregation (1 test)
✔ diff_parser (numstat splitting & badge formatting) (2 tests)
✔ supervisor (DAG decomposition, multi-tier fullstack, QA spec prompt, assertion density, cascading worktrees, circuit breaker) (6 tests)
✔ Web API server (/api/status, /api/stats, /api/history) (1 test)
✔ utils (duration parsing, 16-char runId entropy, assertSafeGitRef injection defense, duration formatting, task categorization, glob/test matcher) (6 tests)
✔ verifier (Jest, Vitest, Pytest, Cargo, Node test output parsing) (6 tests)
✔ adapters.test.js (bare arguments, token substitution, complex characters injection defense) (3 tests)

ℹ tests 40 | pass 40 | fail 0 | skipped 0 (100% PASS)
```
