#!/bin/bash
# VerityLens 浏览器插件三平台打包脚本
# 决策：Chrome / Edge / Firefox 全部适配
# 输出：dist/verity-lens-{chrome,edge,firefox}-v0.2.0.zip

set -e
cd "$(dirname "$0")"

VERSION="0.2.0"
BUILD_DIR="build"
DIST_DIR="dist"

# 清理
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo "=== 1. Chrome / Edge 打包（共用 MV3） ==="
mkdir -p "$BUILD_DIR/chrome"
cp -r common content popup background options icons "$BUILD_DIR/chrome/"

# Chrome manifest
cat > "$BUILD_DIR/chrome/manifest.json" << 'EOF'
{
  "manifest_version": 3,
  "name": "VerityLens",
  "version": "0.2.0",
  "description": "🛡️ 跨模态自校验 × 反虚假信息助手",
  "author": "hannanlsa",
  "homepage_url": "https://github.com/hannanlsa/VerityLens",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "VerityLens · 真实透镜"
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://www.baidu.com/*",
        "*://www.so.com/*",
        "*://www.sogou.com/*",
        "*://www.google.com/*",
        "*://duckduckgo.com/*",
        "*://www.bing.com/*"
      ],
      "js": ["common/verity-core.js", "content/verity-injector.js"],
      "css": ["content/verity-styles.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": ["storage", "activeTab", "scripting", "contextMenus"],
  "host_permissions": [
    "*://www.baidu.com/*",
    "*://www.so.com/*",
    "*://www.sogou.com/*",
    "*://www.google.com/*",
    "*://duckduckgo.com/*",
    "*://www.bing.com/*"
  ]
}
EOF

cd "$BUILD_DIR/chrome"
zip -rq "../../$DIST_DIR/verity-lens-chrome-v$VERSION.zip" .
cd ../..

# Edge 单独 build（带 Edge Add-ons store metadata）
mkdir -p "$BUILD_DIR/edge"
cp -r "$BUILD_DIR/chrome/"* "$BUILD_DIR/edge/"

# Edge 特定：appx manifest
cat > "$BUILD_DIR/edge/manifest.edge.json" << 'EOF'
{
  "packageName": "VerityLens",
  "name": "VerityLens · 真实透镜",
  "version": "0.2.0",
  "developer": {
    "name": "hannanlsa",
    "websiteUrl": "https://github.com/hannanlsa/VerityLens"
  }
}
EOF

cd "$BUILD_DIR/edge"
zip -rq "../../$DIST_DIR/verity-lens-edge-v$VERSION.zip" .
cd ../..

echo "=== 2. Firefox 打包（MV2 + browser_specific_settings） ==="
mkdir -p "$BUILD_DIR/firefox"
cp -r common content popup background options icons "$BUILD_DIR/firefox/"

# Firefox manifest（MV2 + 浏览器特定设置）
cat > "$BUILD_DIR/firefox/manifest.json" << 'EOF'
{
  "manifest_version": 2,
  "name": "VerityLens",
  "version": "0.2.0",
  "description": "🛡️ 跨模态自校验 × 反虚假信息助手",
  "author": "hannanlsa",
  "homepage_url": "https://github.com/hannanlsa/VerityLens",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "browser_action": {
    "default_popup": "popup/popup.html",
    "default_title": "VerityLens · 真实透镜"
  },
  "background": {
    "scripts": ["background/background.js"],
    "persistent": false
  },
  "content_scripts": [
    {
      "matches": [
        "*://www.baidu.com/*",
        "*://www.so.com/*",
        "*://www.sogou.com/*",
        "*://www.google.com/*",
        "*://duckduckgo.com/*",
        "*://www.bing.com/*"
      ],
      "js": ["common/verity-core.js", "content/verity-injector.js"],
      "css": ["content/verity-styles.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": ["storage", "activeTab", "contextMenus", "<all_urls>"],
  "browser_specific_settings": {
    "gecko": {
      "id": "veritylens@hannanlsa.dev",
      "strict_min_version": "115.0"
    }
  }
}
EOF

# Firefox background 脚本（MV2 用 .js 而非 service worker）
cp background/background.js "$BUILD_DIR/firefox/background/background.js" 2>/dev/null || \
  echo "// Firefox background" > "$BUILD_DIR/firefox/background/background.js"

cd "$BUILD_DIR/firefox"
zip -rq "../../$DIST_DIR/verity-lens-firefox-v$VERSION.zip" .
cd ../..

# 输出统计
echo ""
echo "=== 打包完成 ==="
ls -la "$DIST_DIR"/

# 文件大小
du -sh "$DIST_DIR"/*.zip
