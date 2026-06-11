export interface WorkspaceFile {
  id: string; // complete relative path or unique ID
  name: string;
  type: 'file';
  content: string; // for text files
  mimeType?: string; // for binary assets (images, etc)
  dataUrl?: string; // for binary assets (base64 data url)
  handle?: FileSystemFileHandle; // Native handle if native workspace
  tauriPath?: string; // Absolute path on OS for Tauri desktop
  parentId: string;
}

export interface WorkspaceFolder {
  id: string; // complete relative path or unique ID
  name: string;
  type: 'directory';
  children: string[]; // list of item IDs (files or folders)
  handle?: FileSystemDirectoryHandle; // Native handle if native workspace
  tauriPath?: string; // Absolute path on OS for Tauri desktop
  parentId: string;
}

export type WorkspaceItem = WorkspaceFile | WorkspaceFolder;

export interface WorkspaceState {
  items: Record<string, WorkspaceItem>;
  rootId: string;
  type: 'native' | 'virtual';
  nativeHandle: FileSystemDirectoryHandle | null;
  name: string;
}

export interface OpenedTab {
  id: string; // file ID
  name: string;
}

export type EditorMode = 'split' | 'wysiwyg' | 'source'; // Vditor-style modes
export type UserMode = 'read' | 'write'; // App main toggle

export const DEFAULT_INITIAL_DATA: Record<string, WorkspaceItem> = {
  'root': {
    id: 'root',
    name: '我的工作空间',
    type: 'directory',
    children: ['root/readme.md', 'root/images', 'root/markdown-tutorial.md'],
    parentId: '',
  },
  'root/readme.md': {
    id: 'root/readme.md',
    name: 'README.md',
    type: 'file',
    content: `# 欢迎使用 Markdown 关联阅读器 👋

这是一个专为 Markdown 工作空间设计的**双模式阅读与编辑器**，完美结合了桌面级客户端美学与 Vditor 便捷操作。

## 🌟 核心特性

1. **双模式原地编辑 (In-place Editing)**
   - **阅读模式 (Read)**: 极致排版，双击任意段落、标题或列表直接进入原地编辑，保存后无缝恢复优雅阅读。
   - **编辑模式 (Write)**: Vditor 经典卡片。支持 **双栏预览 (Split)**、**源码编辑 (Source)** 与 **极简即时渲染 (WYSIWYG)**。

2. **多源工作空间系统 (Workspace)**
   - **本地文件夹关联**: 使用浏览器原生 File System Access API 一键关联你真实的本地目录！编辑、新建与删除将直接同步到你的硬盘。
   - **沙盒工作空间 (Virtual)**: 拒绝丢失。提供即开即用的虚拟文件系统，断网或非兼容环境下自动落降，安全存放。

3. **静态资源内共享 (Asset Linking)**
   - 支持插入本地图片！在工作空间内上传、放置任意图片，通过标准的 \`![图片描述](images/placeholder-banner.png)\` 或同级格式直接在阅读器完美内联展示。
   - 静态资源支持在工作空间内直接相对路径访问。

---

## 📸 体验静态资源共享

下面是一张工作空间内的本地静景图 (双击此段可在下方查看其相对路径引用)：

![工作空间内的漂亮风景](root/images/nature.png)

> **小贴士**：展开左侧的 \`images\` 目录即可看到此图片，你也可以直接拖拽本地电脑的图片或 Markdown 到左侧目录来关联新文件哦！
`,
    parentId: 'root',
  },
  'root/images': {
    id: 'root/images',
    name: 'images',
    type: 'directory',
    children: ['root/images/nature.png'],
    parentId: 'root',
  },
  'root/images/nature.png': {
    id: 'root/images/nature.png',
    name: 'nature.png',
    type: 'file', // Assets stored as file with dataUrl
    content: '',
    mimeType: 'image/png',
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%"><rect width="800" height="450" fill="%232e3440"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="%2388c0d0">🌅 静态资源共享示例 (点击左侧 images 查看)</text><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="%23d8dee9">你可以把任何本地图片拖拽上传至工作空间中</text></svg>',
    parentId: 'root/images',
  },
  'root/markdown-tutorial.md': {
    id: 'root/markdown-tutorial.md',
    name: 'markdown-tutorial.md',
    type: 'file',
    content: `# Markdown 交互式排版教程

在左上方切换 **阅读 (Read)** 与 **编辑 (Write)** 模式来感受两种优雅。

## 文本样式与排版

您可以轻松键入常见的 Markdown 写法：
* **加粗** 或者是 *斜体* 样式。
* ~~删除线~~ 与 \`行内代码\` 提示。
* 超链接访问：[Google AI Studio](https://ai.studio/build)

## 任务清单示例

- [x] 在阅读模式下双击此行进行原地拼写修改
- [x] 成功建立或切换至本地工作空间文件夹
- [ ] 试着在 images 文件夹上右键新增一张配图
- [ ] 编写你的精美随笔

## 代码高亮

下面是一个高级 D3 数据可视化或 React 组件的代码样例：

\`\`\`typescript
import React, { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      已点击：{count} 次
    </button>
  );
}
\`\`\`

## 简洁表格

| 特性名 | 沙盒虚拟存储 | 本地真实文件夹 |
| :--- | :---: | :---: |
| 跨设备可访 | ✅ 支持 (IndexedDB) | ❌ 仅限本地单机 |
| 实时物理同步 | ❌ 需要导出 | ✅ 读写实时落地 |
| 共享静态资源 | ✅ 支持相对引用 | ✅ 支持物理同名读取 |

## 精美引用

> "所有的创造都是在阅读和编辑之间，写下关于世界的第一行注脚。"  
> —— 设计师语录
`,
    parentId: 'root',
  }
};
