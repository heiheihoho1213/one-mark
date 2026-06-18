# OneMark

一款面向写作者的桌面级 Markdown 阅读与编辑器，基于 Tauri 2 + React 19 构建。提供双模式编辑、多工作空间管理与跨平台原生体验。

> 开发环境：
- macOS Ventura 14.7.2，Intel Mac mini 2023
- Node.js v24.14.0
> 打包环境：macOS Ventura 14.7.2，Apple Silicon Mac mini 2023
> 适配平台：Windows 11、macOS Ventura 14.7.2、Apple Silicon Mac mini 2023

---

## 功能特性

### 编辑器
- **三种编辑模式**：双栏预览（Split）、所见即所得（WYSIWYG）、纯源码（Source）
- **原地编辑**：阅读模式下双击任意段落/标题直接进入编辑，保存后无缝恢复阅读
- **Undo / Redo**：独立 history 栈，最多 50 步撤销
- **工具栏**：Bold / Italic / Strikethrough / H1 / H2 / 引用 / 列表 / 代码块 / 链接 / 图片 / 表格，实时检测光标样式高亮

### 工作空间
- **本地目录模式**：通过系统文件选择器关联磁盘真实目录，编辑内容直接同步写回硬盘
- **沙盒虚拟模式**：无需选择目录，即开即用，数据存储于 localStorage，断网/非兼容环境下自动降级
- **静态资源内联**：工作空间内图片支持相对路径引用，在预览中完美渲染

### 界面
- **自定义标题栏**：无系统装饰边框，macOS 红绿灯 + Windows 风格控制按钮，支持拖拽移动、双击缩放、全屏切换
- **5 套主题皮肤**：经典杏白、曜石双眸、松针凉意、极地冰川、幻影赛博
- **透明窗口 + 原生阴影**：系统层渲染，视觉融入桌面环境

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri 2 |
| 前端框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS 4 |
| 动画 | Motion (Framer) |
| Markdown 渲染 | marked 18 |
| 图标 | lucide-react |
| 构建 | Vite 6 |

---

## 开发环境要求

- **Node.js** ≥ 18
- **Rust** ≥ 1.77（通过 [rustup](https://rustup.rs) 安装）
- Tauri CLI 已包含在 devDependencies，无需全局安装

### macOS 额外依赖
```bash
xcode-select --install
```

### Windows 额外依赖
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（勾选 MSVC 工具链 + Windows SDK）
- WebView2 Runtime（Windows 11 已内置；Windows 10 可从微软官网下载）

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发模式（同时启动 Vite + Tauri 热重载）
npm run tauri:dev
```

> 首次启动会编译所有 Rust 依赖，耗时约 2–5 分钟，后续增量编译很快。

---

## 打包发布

### 通用命令

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`。

---

### 打包到 macOS

#### 前置条件

- 必须在 **macOS 系统**上执行（Tauri 不支持跨平台编译 macOS 包）
- 已安装 Xcode Command Line Tools
- 执行 `npm run tauri icon src-tauri/icons/icon2048.png` 生成各种类型图标

#### 执行构建

```bash
npm run tauri:build
```

#### 产物

| 格式 | 路径 | 说明 |
|---|---|---|
| `.app` | `bundle/macos/OneMark.app` | 可直接双击运行的应用包 |
| `.dmg` | `bundle/dmg/OneMark_1.0.0_x64.dmg` | 拖拽安装镜像，适合分发给用户 |

#### 打包指定架构

| 命令 | 适用机器 | 说明 |
|---|---|---|
| `npm run tauri:build` | 当前机器架构 | 默认，最省事 |
| `npm run tauri:build:mac-arm` | 仅 Apple Silicon（M 系列） | `aarch64-apple-darwin` |
| `npm run tauri:build:mac-intel` | 仅 Intel Mac | `x86_64-apple-darwin` |
| `npm run tauri:build:mac-universal` | Intel + Apple Silicon 通用 | 两个 Mac target 都需要，体积约 2 倍 |
| `npm run tauri:build:win` | Windows 64 位 | 需在 Windows 上执行，`x86_64-pc-windows-msvc` |

首次跨架构打包前，安装所需 Rust target：

```bash
npm run tauri:targets:install
```

#### Universal Binary（Intel + Apple Silicon 双架构合包）

`universal-apple-darwin` 会同时编译两个架构再合并，在 Intel Mac 和 Apple Silicon Mac 上都能原生运行，无需 Rosetta 2 转译。

```bash
npm run tauri:targets:install
npm run tauri:build:mac-universal
```

#### 代码签名（可选，正式分发需要）

需要 Apple Developer 账号，在 `src-tauri/tauri.conf.json` 的 `bundle` 中追加：

```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (XXXXXXXXXX)",
  "providerShortName": "XXXXXXXXXX"
}
```

未签名的应用在其他机器上首次打开时，需要在「系统设置 → 隐私与安全性」中手动允许运行。

---

### 打包到 Windows

#### 前置条件

- 必须在 **Windows 系统**上执行（或 Windows 虚拟机）
- 已安装 Microsoft C++ Build Tools
- 已安装 WebView2 Runtime

#### 执行构建

```bash
npm run tauri:build:win
```

#### 产物

| 格式 | 路径 | 说明 |
|---|---|---|
| `.exe` | `bundle/nsis/OneMark_1.0.0_x64-setup.exe` | NSIS 安装向导，推荐分发 |
| `.msi` | `bundle/msi/OneMark_1.0.0_x64_en-US.msi` | MSI 安装包，适合企业部署 |

#### 只打特定格式

```bash
# 只打 NSIS 安装包
npm run tauri:build -- --bundles nsis

# 只打 MSI
npm run tauri:build -- --bundles msi
```

#### 代码签名（可选）

在 `src-tauri/tauri.conf.json` 的 `bundle` 中追加：

```json
"windows": {
  "certificateThumbprint": "your-cert-thumbprint",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com"
}
```

---

### 跨平台 CI 构建

本地无法跨平台编译（macOS 包必须在 macOS 上构建，Windows 包必须在 Windows 上构建）。推荐用 GitHub Actions 矩阵构建同时产出两端安装包：

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run tauri:build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: OneMark-${{ matrix.os }}
          path: src-tauri/target/release/bundle/
```

---

## 项目结构

```
markdown-workspace-editor/
├── src/                        # 前端源码
│   ├── App.tsx                 # 主应用、工作空间状态、窗口控制
│   ├── components/
│   │   ├── Titlebar.tsx        # 自定义标题栏（拖拽/窗口控制/主题切换）
│   │   ├── Sidebar.tsx         # 文件树、新建/删除/重命名/导入
│   │   ├── Toolbar.tsx         # 编辑工具栏
│   │   ├── Editor.tsx          # 源码编辑器（含 Undo/Redo）
│   │   └── Preview.tsx         # Markdown 预览（含原地编辑）
│   ├── utils/
│   │   └── fileSystem.ts       # 文件读写（浏览器 FSA API + Tauri fs 插件）
│   └── types.ts                # 类型定义
├── src-tauri/                  # Rust / Tauri 配置
│   ├── src/main.rs             # Tauri 应用入口
│   ├── tauri.conf.json         # 窗口、打包、权限总配置
│   ├── capabilities/
│   │   └── default.json        # 前端可调用的 Tauri API 权限声明
│   └── Cargo.toml              # Rust 依赖
├── index.html
├── vite.config.ts
└── package.json
```

---

## 常用命令速查

| 命令 | 说明 |
|---|---|
| `npm run dev` | 仅启动 Vite 前端开发服务器 |
| `npm run tauri:dev` | 启动完整 Tauri 开发模式（含热重载） |
| `npm run tauri:build` | 构建当前平台的发布安装包 |
| `npm run lint` | TypeScript 类型检查 |
| `npm run clean` | 清理 dist 目录 |
| `npm run tauri:clean` | 清理 Rust 编译缓存（解决偶发编译错误时使用） |
