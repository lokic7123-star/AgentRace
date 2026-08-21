# AgentRace (arace) 2.0 交付与演进走查文档 (Walkthrough)

## 📌 概述
本文档记录 AgentRace 2.0 架构升级、安全加固、去 Shell 化重构、桌面端（Electron / NSIS）交付与 **Anthropic 暖纸浅色主题（Warm Paper Theme）** 全面重构。

---

## 🎨 前端界面重构 · Anthropic 暖纸浅色主题

### 1. 核心设计 Token
- **暖纸基底色（Paper）**：主背景 `#FAF9F5`、面板白色 `#FFFFFF`、沉降底色 `#F0EEE6`。
- **墨水字色（Ink）**：主墨色 `#1F1E1D`、次级灰 `#6B6560`、微弱灰 `#98928A`。
- **陶红主色（Crail）**：主强调色 `#D97757`、悬浮 `#C4633F`、柔和底 `#F5E6DE`。
- **功能色**：成功绿 `ok (#5A7247)`、失败红 `bad (#BF4D43)`、信息蓝 `info (#5B7A99)`。
- **终端质感签名对比**：代码与实时日志区保留 `#1F1E1D` 暗底与 `#E8E4DA` 等宽浅字。

### 2. 组件级改造
- **导航 Tab**：药丸底色改为经典下划线式（激活态 `border-b-2 border-crail text-ink font-semibold`）。
- **按钮与卡片**：单层白底实线（1px `border-line`）、无重度投影（`shadow-none`）、陶红主按钮。
- **客观门禁三格**：Build/Lint/Test 统一采用等宽方括号标签 `[PASS]` / `[FAIL]`。
- **流式遥测行**：Token 消耗、费用预估与工具调用合并为单行 Mono 紧凑数据行。
- **去 AI 化清理**：UI 装饰 Emoji 全量收敛（≤10 处），状态点去闪烁，后端状态描述同步去 emoji。

---

## 🛡️ 安全与核心能力演进

1. **Git 命令注入防御（P1-1 & P1-5）**：
   - 引入 `assertSafeGitRef` 白名单校验（`/^[\w][\w./-]*$/`）。
   - 全部 `git` 相关操作由裸字符串拼接升级为 `spawnSync` 数组传参。
2. **20+ 个适配器去 Shell 化重构（P2-1）**：
   - 重构 22 个市场 Agent 适配器 `buildCommand`，移除手工嵌套引号，消除 Node.js `DEP0190` 警告。
3. **YAML 字符状态机解析器（P2-3）**：
   - 实现引号感知注释剥离 `stripYamlComment`，完美支持引号内包含 `#`。
4. **CJK 宽字符终端对齐与 Origin 本地回环守卫（P3-3 & P3-4）**：
   - 终端看板中英文混合排版按宽字符准确对齐；Web API 非 GET 请求严格回环校验。

---

## 🖥️ 桌面端与打包分发

1. **极速轻量安装包**：
   - 配置 `electron-builder.yml` 启用最高压缩比 `compression: maximum` 与中英双语，NSIS 单文件安装包从 104 MB 极限压缩至 **82.39 MB**（低于 92 MB 指标）。
2. **系统托盘与常驻机制**：
   - 接入原生多分辨率 [`desktop/icon.ico`](file:///d:/Antigravity-project/desktop/icon.ico)，点 X 平滑隐藏至右下角托盘，右键托盘安全退出。
3. **脱网离线支持**：
   - Tailwind CSS 框架完全离线本地化（`/vendor/tailwind.js`）。

---

## 🧪 自动化测试验证

运行命令：`npm test`
- **全量 40 项单元与集成测试 100% PASS**（覆盖适配器参数、AST 安全防作弊、Circuit Breaker、DAG 级联工作树、SQLite 持久化、YAML 状态机等）。
