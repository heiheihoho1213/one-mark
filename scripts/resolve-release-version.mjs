/**
 * 解析发版版本号。
 * zsh 会把未加引号的 `0.0.2` 预处理成 `0.02`，因此需校验 CLI 参数格式。
 */
import { readFileSync } from 'node:fs';

const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

/** 从 tauri.conf.json 读取版本号 */
export function readConfigVersion() {
  return JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
}

/**
 * @param {string | undefined} arg npm 传入的版本参数（可能已被 shell 改写）
 * @returns {string}
 */
export function resolveReleaseVersion(arg) {
  const fromConfig = readConfigVersion();
  const cleaned = arg?.trim().replace(/^v/, '');

  if (!cleaned) {
    return fromConfig;
  }

  if (!SEMVER_RE.test(cleaned)) {
    console.warn(`⚠️  版本参数 "${cleaned}" 不是合法的 x.y.z 格式（zsh 可能把 0.0.2 变成了 0.02）`);
    console.warn(`   已改用 tauri.conf.json 中的版本: ${fromConfig}`);
    console.warn('   若需手动指定，请加引号：npm run release:retag -- "0.0.2"');
    return fromConfig;
  }

  if (cleaned !== fromConfig) {
    console.warn(`⚠️  参数版本 ${cleaned} 与 tauri.conf.json（${fromConfig}）不一致，以参数为准`);
  }

  return cleaned;
}
