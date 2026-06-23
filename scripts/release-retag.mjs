#!/usr/bin/env node
/**
 * 将已有版本标签移动到当前提交并强制推送，用于修复 CI 后重发 GitHub Release。
 *
 * 用法：
 *   npm run release:retag              # 使用 tauri.conf.json 中的 version（推荐）
 *   npm run release:retag -- "0.0.2"   # 指定版本号（必须加引号）
 *
 * 注意：请先 commit 并 push 代码到 main，再执行本命令。
 */
import { execSync } from 'node:child_process';
import { resolveReleaseVersion } from './resolve-release-version.mjs';

const version = resolveReleaseVersion(process.argv[2]);
const tag = `v${version}`;

const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('❌ 工作区有未提交更改，请先 commit 再重发。');
  process.exit(1);
}

const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
let oldTagCommit = null;
try {
  oldTagCommit = execSync(`git rev-parse --short ${tag}`, { encoding: 'utf8' }).trim();
} catch {
  // 本地尚无该标签
}

console.log(`📦 重发版本: ${version}`);
console.log(`🏷️  标签: ${tag}`);
console.log(`📍 当前提交: ${head}`);
if (oldTagCommit) {
  if (oldTagCommit === head) {
    console.log(`ℹ️  标签已指向当前提交，将直接强制推送以触发 CI`);
  } else {
    console.log(`↪️  标签将从 ${oldTagCommit} 移动到 ${head}`);
  }
}

// 删除本地旧标签（若存在）并在当前 HEAD 重建
try {
  execSync(`git tag -d ${tag}`, { stdio: 'ignore' });
} catch {
  // 本地无此标签，忽略
}
execSync(`git tag ${tag}`, { stdio: 'inherit' });

console.log(`🚀 强制推送标签到 origin（触发 Release CI）...`);
execSync(`git push origin ${tag} --force`, { stdio: 'inherit' });

console.log(`\n✅ 已重发 ${tag}，请到 GitHub Actions 查看 Release 构建进度。`);
