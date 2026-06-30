#!/bin/bash
# VerityLens 浏览器插件三平台打包脚本
# 输出：dist/verity-lens-{chrome,edge,firefox}-v0.6.0.zip

set -e
cd "$(dirname "$0")"

VERSION="0.7.1"
BUILD_DIR="build"
DIST_DIR="dist"

rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo "=== 1. Chrome / Edge 打包（共用 MV3） ==="
mkdir -p "$BUILD_DIR/chrome"
cp -r common content popup background options welcome icons "$BUILD_DIR/chrome/"

cat > "$BUILD_DIR/chrome/manifest.json" << 'EOF'
{
  "manifest_version": 3,
  "name": "VerityLens",
  "version": "0.6.0",
  "description": "信息可信度标注助手 · 来源大数据AI · 帮你识别广告、SEO农场和可信内容 · 支持6大搜索引擎",
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    "default_title": "VerityLens · 真实透镜"
  },
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://www.baidu.com/s*",
        "*://www.baidu.com/baidu*",
        "*://www.so.com/s*",
        "*://www.sogou.com/web*",
        "*://www.google.com/search*",
        "*://duckduckgo.com/*",
        "*://www.bing.com/search*"
      ],
      "js": [
        "common/i18n/i18n-core.js",
        "common/modules/ocr.js",
        "common/modules/asr.js",
        "common/modules/cross-modal.js",
        "common/verity-core.js",
        "content/verity-injector.js"
      ],
      "css": [
        "content/verity-styles.css"
      ],
      "run_at": "document_idle",
      "all_frames": false
    },
    {
      "matches": ["<all_urls>"],
      "js": [
        "common/modules/translator.js",
        "common/verity-core.js",
        "content/verity-translator.js"
      ],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "options_page": "options/options.html",
  "permissions": [
    "storage",
    "activeTab",

    "contextMenus"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "common/verity-core.js",
        "common/modules/*.js",
        "icons/*.png"
      ],
      "matches": ["<all_urls>"]
    }
  ],
  "minimum_chrome_version": "120"
}
EOF

cd "$BUILD_DIR/chrome"
zip -rq "../../$DIST_DIR/verity-lens-chrome-v$VERSION.zip" .
cd ../..

echo "=== 2. Edge 打包（MV3 + Edge metadata） ==="
mkdir -p "$BUILD_DIR/edge"
cp -r "$BUILD_DIR/chrome/"* "$BUILD_DIR/edge/"

cat > "$BUILD_DIR/edge/manifest.edge.json" << 'EOF'
{
  "packageName": "VerityLens",
  "name": "VerityLens · 真实透镜",
  "version": "0.7.0",
  "developer": {
    "name": "hannanlsa",
    "websiteUrl": "https://github.com/hannanlsa/VerityLens"
  }
}
EOF

cd "$BUILD_DIR/edge"
zip -rq "../../$DIST_DIR/verity-lens-edge-v$VERSION.zip" .
cd ../..

echo "=== 3. Firefox 打包（MV2 + browser_specific_settings） ==="
mkdir -p "$BUILD_DIR/firefox"
cp -r common content popup background options welcome icons "$BUILD_DIR/firefox/"

cat > "$BUILD_DIR/firefox/manifest.json" << 'EOF'
{
  "manifest_version": 2,
  "name": "VerityLens",
  "version": "0.7.0",
  "description": "信息可信度标注助手 · AI驱动识别广告与SEO农场 · 跨模态自校验 · 支持主流搜索引擎",
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
        "*://www.baidu.com/s*",
        "*://www.baidu.com/baidu*",
        "*://www.so.com/s*",
        "*://www.sogou.com/web*",
        "*://www.google.com/search*",
        "*://duckduckgo.com/*",
        "*://www.bing.com/search*"
      ],
      "js": [
        "common/i18n/i18n-core.js",
        "common/modules/ocr.js",
        "common/modules/asr.js",
        "common/modules/cross-modal.js",
        "common/verity-core.js",
        "content/verity-injector.js"
      ],
      "css": [
        "content/verity-styles.css"
      ],
      "run_at": "document_idle",
      "all_frames": false
    },
    {
      "matches": ["<all_urls>"],
      "js": [
        "common/modules/translator.js",
        "common/verity-core.js",
        "content/verity-translator.js"
      ],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },
  "permissions": [
    "storage",
    "activeTab",
    "contextMenus",
    "<all_urls>"
  ],
  "browser_specific_settings": {
    "gecko": {
      "id": "veritylens@hannanlsa.dev",
      "strict_min_version": "120.0"
    }
  },
  "web_accessible_resources": [
    "common/verity-core.js",
    "common/modules/*.js",
    "icons/*.png"
  ]
}
EOF

cp background/background.js "$BUILD_DIR/firefox/background/background.js" 2>/dev/null || \
  echo "// Firefox background" > "$BUILD_DIR/firefox/background/background.js"

cd "$BUILD_DIR/firefox"
zip -rq "../../$DIST_DIR/verity-lens-firefox-v$VERSION.zip" .
cd ../..

echo ""
echo "=== 打包完成 ==="
ls -la "$DIST_DIR"/
du -sh "$DIST_DIR"/*.zip
