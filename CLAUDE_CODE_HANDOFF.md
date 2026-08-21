# Claude Code 交接说明

## 1. 项目是什么

这是一个基于 `React + TypeScript + Vite` 的考研英语一真题练习网站，目标是把真题阅读训练、生词积累、词组积累、翻译/作文作答记录整合到一个页面里。

核心使用场景：

- 首页选择年份真题
- 进入真题后按版块练习：完形、阅读、新题型、翻译、作文
- 点击英文单词查看红宝书释义
- 右键把单词加入生词本
- 左键拖选多个单词后右键，把词组加入词组本
- 生词本和词组本支持回看原句、编辑注释、导出

当前项目根目录：`E:\claudeprj\ENG`

## 2. 当前已经实现的功能

### 2.1 真题练习

- 已接入 `2010-2026` 英语一真题
- 页面支持 5 个版块：
  - 完形
  - 阅读
  - 新题型
  - 翻译
  - 作文
- 做题页支持右侧答题面板
- 选择题支持 `A/B/C/D` 或新题型对应选项
- 翻译、作文支持文本输入并持久化保存

### 2.2 单词查询与生词本

- 点击英文单词显示词义弹层
- 支持正文、阅读题干、选项、新题型候选项里的英文点击查义
- 右键单词可直接加入生词本
- 如果词义缺失，会写入占位文案：`红宝书词库里暂时没有收录这条释义。`
- 生词本支持：
  - 查看原句 `Example Review`
  - 回到原文
  - 双击编辑释义
  - 导出 TXT

### 2.3 词组收藏与词组本

- 左键拖过多个单词形成词组选择
- 右键把词组加入单独的词组本
- 词组本支持手动新增词组和注释
- 支持编辑词组和注释
- 如果词组与固定搭配库至少重合 `2` 个有效单词，会自动匹配注释

### 2.4 文本清洗与真题修复

- 已做过较多真题清洗：
  - 乱码字符清理
  - 页眉页脚清理
  - 阅读段落恢复
  - 完形题号格式统一
  - 新题型题干恢复
  - 翻译目标句段下划线修正
- `2025` 目前做了额外人工补源，质量明显高于原始本地 PDF 解析结果

## 3. 技术栈与主要依赖

### 3.1 前端

- `react`
- `react-dom`
- `react-router-dom`
- `typescript`
- `vite`
- `tailwindcss`
- `lucide-react`
- `zustand`

### 3.2 数据生成

- `@gmr-fms/word-extractor`
  - 用于提取 `.doc`
- `pdf-parse`
  - 用于提取 `.pdf`
- `PowerShell + zip xml` 方式
  - 用于提取 `.docx`

### 3.3 测试与构建

- `vitest`
- `eslint`
- `tsc -b`

常用命令：

```bash
npm run dev
npm run generate:data
npm run build
npm run test
npm run lint
```

## 4. 关键目录说明

### 4.1 页面

- `src/pages/Home.tsx`
  - 首页，展示真题年份卡片
- `src/pages/ExamPage.tsx`
  - 做题主页面，负责版块切换、查词、收藏、答题、翻译/作文输入
- `src/pages/VocabularyPage.tsx`
  - 生词本/词组本页面

### 4.2 组件

- `src/components/PassageReader.tsx`
  - 英文正文渲染核心组件
  - 支持点击单词、右键收藏、词组拖选、翻译下划线
- `src/components/InlineInteractiveText.tsx`
  - 题干/选项内联英文交互
- `src/components/QuestionPanel.tsx`
  - 右侧选择题答题区
- `src/components/TextResponsePanel.tsx`
  - 翻译/作文输入区
- `src/components/WordPopover.tsx`
  - 单词释义弹层
- `src/components/AppShell.tsx`
  - 外层布局与顶部导航

### 4.3 数据

- `src/data/examPapers.ts`
  - 最终生成后的真题数据
- `src/data/redbookDictionary.ts`
  - 红宝书词典数据
- `src/data/dictionary.ts`
  - 当前查询词典入口

### 4.4 状态管理

- `src/store/useStudyStore.ts`
  - 用 `Zustand` 管理：
    - 生词本
    - 词组本
    - 答题记录
    - 翻译/作文输入记录

### 4.5 类型定义

- `src/types/study.ts`
  - 核心数据模型定义：
    - `ExamPaper`
    - `ExamSection`
    - `SavedWord`
    - `SavedPhrase`
    - `WordSelection`
    - `PhraseSelection`

### 4.6 工具函数

- `src/utils/text.ts`
  - 文本清洗、分词、句子提取、翻译段落切分
- `src/utils/cloze.ts`
  - 完形占位符与段落分割
- `src/utils/study.ts`
  - 生词本/词组本的增删改工具
- `src/utils/collocations.ts`
  - 固定搭配词组匹配逻辑

### 4.7 数据生成脚本

- `scripts/generate-data.mjs`
  - 真题提取、清洗、结构化生成的核心脚本

## 5. 路由说明

路由定义在 `src/App.tsx`：

- `/`
  - 首页
- `/exam/:paperId`
  - 真题做题页
- `/vocabulary`
  - 生词本 / 词组本

## 6. 数据来源

### 6.1 真题原始文件

目录：`ZhenTi/`

来源形式：

- `2005-2016` 合集 `.doc`
- `2017-2019` 单年 `.doc`
- `2020-2022` 单年 `.docx`
- `2023-2024` 单年 `.doc`
- `2025` 单年 `.pdf`
- `2026` 单年 `.doc`

解析后中间文本输出到：

- `scripts/generated/`

### 6.2 红宝书词库

目录：

- `word book/words.json`

生成后写入：

- `src/data/redbookDictionary.ts`

### 6.3 固定搭配库

目录：

- `word book/fixed_collocations.json`

用途：

- 给词组本自动匹配注释

规则：

- 将词组和搭配库都做归一化
- 忽略 `sb.`、`sth.` 一类占位词
- 只要重合有效单词数 `>= 2`，就认为命中
- 取重合度最高、长度最接近的搭配作为最佳匹配

### 6.4 2025 特殊补源

目录：

- `scripts/manual/2025年考研英语一真题-burningvocabulary阅读提取.txt`
- `scripts/manual/2025年考研英语一真题-burningvocabulary补充提取.txt`

说明：

- `2025` 因本地 PDF 提取质量较差，所以额外使用站点来源做人工整理覆盖
- 当前 `阅读 / 新题型 / 翻译 / 作文` 都优先使用这两份补源

## 7. 核心实现方式

### 7.1 真题生成链路

整体流程：

1. 从 `ZhenTi/` 读取原始 `.doc / .docx / .pdf`
2. 提取为纯文本
3. 用 `scripts/generate-data.mjs` 做清洗
4. 解析为统一结构：
   - 完形
   - 阅读
   - 新题型
   - 翻译
   - 作文
5. 输出到 `src/data/examPapers.ts`

### 7.2 单词点击查义

在正文里英文是按 token 渲染成按钮的：

- 点击单词
- 用 `normalizeWord + buildLookupCandidates`
- 去字典里查
- 再通过 `WordPopover` 显示词义

### 7.3 右键收藏单词

流程：

- 右键单词
- 组装 `WordSelection`
- 存进 `useStudyStore`
- 保存来源信息：
  - paper
  - section
  - passage
  - sourceContext

### 7.4 词组拖选

项目没有用浏览器原生文字选择，而是自定义了 token 级拖选：

- 每个词是一个按钮
- `mousedown` 记录起点
- `mouseenter` 更新终点
- `mouseup` 固化选择范围
- `contextmenu` 把所选词组保存到词组本

对应文件：

- `src/pages/ExamPage.tsx`
- `src/components/PassageReader.tsx`
- `src/components/InlineInteractiveText.tsx`
- `src/components/QuestionPanel.tsx`

### 7.5 翻译题下划线

翻译题原文中的 `(46)-(50)` 是标记点。

当前做法：

- 数据生成阶段先把每道题的真实待译句段单独提出来，写入 `prompts`
- 前端渲染时再根据这些标记只给目标句段下划线

注意：

- 这块近期刚修过，之前出现过“下划线范围过长”的问题
- 现在逻辑主要在 `src/utils/text.ts`

## 8. 当前最重要的文件

如果 Claude Code 需要继续迭代，优先看下面这些文件：

- `src/pages/ExamPage.tsx`
- `src/pages/VocabularyPage.tsx`
- `src/components/PassageReader.tsx`
- `src/components/InlineInteractiveText.tsx`
- `src/components/QuestionPanel.tsx`
- `src/store/useStudyStore.ts`
- `src/utils/text.ts`
- `src/utils/collocations.ts`
- `src/utils/cloze.ts`
- `scripts/generate-data.mjs`
- `src/data/examPapers.ts`
- `src/types/study.ts`

## 9. 当前已知特点与注意事项

### 9.1 `examPapers.ts` 很大

- 这是编译产物型数据文件
- 不建议手工大量直接修改
- 优先改 `scripts/generate-data.mjs` 或 `scripts/manual/` 里的补源文件，再重新生成

### 9.2 某些年份仍可能有脏文本

- `2025/2026` 这类近年源文件格式最不稳定
- 如果某一年的题干异常，优先检查：
  - `scripts/generated/*.txt`
  - `scripts/manual/*.txt`
  - `generate-data.mjs`

### 9.3 新题型并不总是 `A-G`

- 部分年份是 `A-H`
- 这个兼容已经补过，不要再写死只支持 `A-G`

### 9.4 阅读与翻译不要共用完全相同的分段规则

- 阅读更强调恢复原文段落
- 翻译更强调识别目标句段 `(46)-(50)`
- 两者都在 `text.ts / generate-data.mjs` 里做过单独处理

### 9.5 生词本和词组本已经有历史数据兼容

- 老记录可能没有 `sourceContext`
- 页面上如果找不到原句，不应该强行显示 `Example Review`

## 10. 推荐后续迭代顺序

如果后续要继续开发，建议按这个顺序：

1. 继续清洗 `2026` 全卷文本
2. 把 `2025/2026` 也做类似人工补源机制
3. 优化首页和真题筛选
4. 增加做题进度统计与错题回顾
5. 优化大文件加载，考虑对 `examPapers.ts` 做拆分或懒加载

## 11. 一句话总结

这个项目本质上是一个“考研英语一真题训练 + 红宝书查词 + 生词本/词组本积累”工具，前端主体已经能用，后续迭代的重点不是从零搭架子，而是继续围绕：

- 真题文本质量
- 交互体验
- 数据结构稳定性
- 生词/词组学习链路

来做增强。
