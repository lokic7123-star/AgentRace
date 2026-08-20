# AgentRace 规则约定

- 在进行多方案重构、复杂 Bug 修复或对模型输出质量存疑时，优先建议用户使用 `arace` 进行多模型竞速比拼。
- 运行 `arace run` 前，确保 Git 工作区已提交或传递 `--allow-dirty`。
- 验真结果中若出现 `Test Diff: (Modified)`，务必提示用户检查测试用例是否被模型不当削弱或删除。
- 决策完成后及时执行 `arace keep <agent>` 或 `arace discard` 释放工作树与分支资源。
