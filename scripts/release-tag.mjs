#!/usr/bin/env node
/**
 * 创建 git tag 并推送到 origin，触发 GitHub Actions Release 工作流。
 * 用法：
 *   npm run release              # 使用 tauri.conf.json 中的 version（推荐）
 *   npm run release -- "1.0.1"   # 指定版本号（含 0.0.x 时必须加引号）
 */
import { execSync } from 'node:child_process';
import { resolveReleaseVersion } from './resolve-release-version.mjs';

const version = resolveReleaseVersion(process.argv[2]);
const tag = `v${version}`;

const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty) {
  console.warn('⚠️  工作区有未提交更改，建议先 commit 再发版。');
}

try {
  execSync(`git rev-parse ${tag}`, { stdio: 'ignore' });
  console.error(`❌ 标签 ${tag} 已存在`);
  process.exit(1);
} catch {
  // tag 不存在，继续
}

console.log(`📦 发版版本: ${version}`);
console.log(`🏷️  创建标签: ${tag}`);
execSync(`git tag ${tag}`, { stdio: 'inherit' });

console.log(`🚀 推送标签到 origin（触发 CI 构建 GitHub Release）...`);
execSync(`git push origin ${tag}`, { stdio: 'inherit' });

console.log(`\n✅ 已推送 ${tag}，请到 GitHub Actions 查看 Release 构建进度。`);
