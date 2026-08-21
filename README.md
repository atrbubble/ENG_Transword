# Transword Archive · 考研英语一真题学习站

一个用于练习 **2010–2026 年考研英语(一)真题** 的在线阅读学习工具,支持**查词翻译、生词本、词组本、答题记录**与 **Markdown 导出**,纯前端运行,无需后端,数据保存在浏览器本地。

在线地址: **<https://atrbubble.github.io/ENG_Transword/>**

---

## ✨ 功能特性

- **真题练习**:收录 2010–2026 年英语一真题(阅读理解 / 完形填空 / 翻译等),按年份分套练习
- **即点即译**:点击文章中的任意单词,弹出翻译、音标与释义小窗;点弹层外部即可关闭
- **生词本 / 词组本**:一键收藏生词与词组,自动保存到浏览器本地
- **答题记录**:作答内容自动留存,随时回看
- **Markdown 导出**:将生词/词组列表导出为 Markdown 文件,例句中的目标词带荧光笔高亮
- **数据备份**:支持将全部生词、词组、答题记录导出为 JSON 备份,并在任意设备上导入恢复

## 🛠 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | React 18 + TypeScript + Vite |
| 路由 | react-router-dom v7 |
| 样式 | Tailwind CSS 3 |
| 状态管理 | zustand 5(persist 持久化到 localStorage) |
| 测试 | Vitest |

## 🚀 本地开发

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器
```

启动后在浏览器打开:

> **http://localhost:5173/ENG_Transword/**

## ✅ 检查与测试

```bash
npm run check      # TypeScript 类型检查
npm run lint       # ESLint 代码检查
npm run test       # 运行单元测试
```

## 📦 生产构建

```bash
npm run build      # 构建产物输出到 dist/
npm run preview    # 本地预览构建产物
```

## 🌐 部署(GitHub Pages)

本仓库已配置 GitHub Actions 自动部署:

1. 推送代码到 `main` 分支,自动触发 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 构建并发布
2. 发布到: **https://atrbubble.github.io/ENG_Transword/**
3. 仓库 `Settings → Pages` 中需将 **Source** 设为 **GitHub Actions**

> 本地与线上数据互不互通。迁移数据:在本地页面「数据备份 → 导出备份」得到 JSON 文件,再到线上页面「导入备份」选择该文件即可。

## 📁 项目结构

```
├── src/
│   ├── pages/           # 页面(首页 / 真题练习 / 生词本)
│   ├── components/      # 组件(阅读器 / 查词弹窗 / 答题面板等)
│   ├── data/            # 真题与词典数据
│   ├── store/           # zustand 状态(生词 / 词组 / 答题记录)
│   ├── utils/           # 工具函数(分词 / 搭配 / 文本处理)
│   └── types/           # TypeScript 类型定义
├── scripts/             # 真题数据生成脚本
├── public/              # 静态资源(favicon 等)
└── .github/workflows/   # GitHub Actions 部署配置
```

## 📝 说明

- 所有学习数据(生词、词组、答题记录)保存在浏览器 **localStorage** 中,换设备或清除浏览器数据前请先「导出备份」
- 项目由 **Claude Code** 协助开发与维护
