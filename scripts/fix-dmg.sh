#!/bin/bash
# 修复 Tauri 打包的 DMG 中 VolumeIcon.icns 在 Finder 窗口里显示的问题。
# SetFile -a C 有时不生效，此脚本通过重新封装 DMG 来彻底解决。
#
# 用法：bash scripts/fix-dmg.sh <dmg路径>
# 示例：bash scripts/fix-dmg.sh src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/OneMark_1.0.0_aarch64.dmg

set -e

DMG_PATH="${1}"

if [ -z "$DMG_PATH" ]; then
  # 自动查找最新的 dmg 文件
  DMG_PATH=$(find src-tauri/target -name "*.dmg" | sort | tail -1)
  if [ -z "$DMG_PATH" ]; then
    echo "错误：未找到 .dmg 文件，请先执行 npm run tauri:build"
    exit 1
  fi
fi

echo "处理 DMG：$DMG_PATH"

MOUNT_DIR=$(mktemp -d)
WRITABLE_DMG="${DMG_PATH%.dmg}_writable.dmg"

# 转换为可写的 DMG 副本
hdiutil convert "$DMG_PATH" -format UDRW -o "$WRITABLE_DMG" -quiet

# 挂载可写副本
hdiutil attach "$WRITABLE_DMG" -nobrowse -mountpoint "$MOUNT_DIR" -quiet

# 确保 .VolumeIcon.icns 存在且标记为不可见
if [ -f "$MOUNT_DIR/.VolumeIcon.icns" ]; then
  # 设置 Finder 不可见属性
  SetFile -a C "$MOUNT_DIR" 2>/dev/null || true
  # 用 xattr 双重保险
  xattr -wx com.apple.FinderInfo \
    "0000000000000000040000000000000000000000000000000000000000000000" \
    "$MOUNT_DIR/.VolumeIcon.icns" 2>/dev/null || true
  echo "已设置 .VolumeIcon.icns 不可见属性"
fi

# 同步文件系统
sync

# 卸载
hdiutil detach "$MOUNT_DIR" -quiet

# 转换回压缩格式覆盖原文件
hdiutil convert "$WRITABLE_DMG" -format UDZO -o "$DMG_PATH" -quiet -ov

# 清理临时文件
rm -f "$WRITABLE_DMG"
rmdir "$MOUNT_DIR" 2>/dev/null || true

echo "完成：$DMG_PATH"
