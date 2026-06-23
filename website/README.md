# OneMark 产品官网

Vite + Tailwind CSS 4 静态站点，GitHub Actions 自动部署至 GitHub Pages。

## 本地开发

```bash
cd website
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

本地指定 GitHub 仓库（可选）：

```bash
VITE_GITHUB_REPO=your-name/one-mark npm run dev
```

## 构建

```bash
cd website
npm run build
npm run preview   # 预览 dist/
```

模拟 GitHub Pages 子路径：

```bash
VITE_BASE_PATH=/one-mark/ VITE_GITHUB_REPO=your-name/one-mark npm run build
```

## 自动部署

推送 `main` 且 `website/` 有变更时，[deploy-pages.yml](../.github/workflows/deploy-pages.yml) 自动构建并部署。

**首次启用：** Settings → Pages → Source 选 **GitHub Actions**

访问地址：`https://<用户名>.github.io/<仓库名>/`
