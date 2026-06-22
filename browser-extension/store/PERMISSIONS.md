# VerityLens Permission Justification / 权限说明

## Permissions / 权限

### `storage`
**Purpose**: Save user preferences (verification mode, API provider, API key, confidence threshold, language).

**用途**: 保存用户偏好设置（验证模式、AI提供商、API密钥、置信度阈值、语言）。

**Data stored**: Channel mode, provider selection, API key, threshold value, locale. All stored locally on the user's device only.

**存储数据**: 通道模式、提供商选择、API密钥、阈值、语言偏好。所有数据仅存储在用户本地设备。

---

### `activeTab`
**Purpose**: Access the current tab's URL to detect which search engine the user is visiting, so the extension can apply the correct annotation logic.

**用途**: 获取当前标签页的URL，检测用户正在访问的搜索引擎，以便应用正确的标注逻辑。

**Data accessed**: Only the tab URL (to detect search engine). No page content is read through this permission.

**访问数据**: 仅标签页URL（用于检测搜索引擎）。不通过此权限读取页面内容。

---

### `scripting`
**Purpose**: Inject the content script (annotation logic) into search engine result pages when the user navigates to them.

**用途**: 当用户导航到搜索引擎结果页时，注入内容脚本（标注逻辑）。

**Data accessed**: None directly. This permission enables the content script to run on search result pages.

**访问数据**: 无直接数据访问。此权限使内容脚本能在搜索结果页运行。

---

### `contextMenus`
**Purpose**: Add a right-click menu item "VerityLens · Verify Authenticity" so users can quickly verify selected text or links.

**用途**: 添加右键菜单项"VerityLens · 真实性验证"，让用户可以快速验证选中的文本或链接。

**Data accessed**: Selected text or link URL (only when the user explicitly clicks the menu item).

**访问数据**: 选中的文本或链接URL（仅在用户主动点击菜单项时）。

---

## Host Permissions / 主机权限

### Search Engine Domains / 搜索引擎域名

| Domain | Purpose |
|--------|---------|
| `www.baidu.com` | Annotate Baidu search results |
| `www.so.com` | Annotate 360 Search results |
| `www.sogou.com` | Annotate Sogou search results |
| `www.google.com` | Annotate Google search results |
| `duckduckgo.com` | Annotate DuckDuckGo search results |
| `www.bing.com` | Annotate Bing search results |

**Why needed**: The extension annotates search results on these pages with credibility indicators. Without these permissions, the content script cannot run on search result pages.

**为什么需要**: 扩展在这些页面上标注搜索结果的可信度。没有这些权限，内容脚本无法在搜索结果页运行。

---

### AI Provider Domains / AI提供商域名

| Domain | Provider | Purpose |
|--------|----------|---------|
| `api.deepseek.com` | DeepSeek | Cloud verification (optional, user-configured) |
| `open.bigmodel.cn` | Zhipu GLM | Cloud verification (optional, user-configured) |
| `dashscope.aliyuncs.com` | Tongyi Qianwen | Cloud verification (optional, user-configured) |
| `api.siliconflow.cn` | SiliconFlow | Cloud verification (optional, user-configured) |
| `api.groq.com` | Groq | Cloud verification (optional, user-configured) |
| `api.moonshot.cn` | Moonshot | Cloud verification (optional, user-configured) |
| `api.minimax.chat` | MiniMax | Cloud verification (optional, user-configured) |
| `api.lingyiwanwu.com` | Yi | Cloud verification (optional, user-configured) |
| `aip.baidubce.com` | Baidu Qianfan | Cloud verification (optional, user-configured) |

**Why needed**: When the user chooses cloud verification mode and configures an AI provider, the extension sends search result text to the selected provider's API for credibility assessment. These permissions are only used when the user explicitly configures cloud mode.

**为什么需要**: 当用户选择云端验证模式并配置AI提供商时，扩展会将搜索结果文本发送到所选提供商的API进行可信度评估。这些权限仅在用户主动配置云端模式时使用。

**Important**: The extension works fully in local-only mode without any of these API permissions. No network requests are made unless the user explicitly enables cloud verification.

**重要提示**: 扩展在纯本地模式下完全可用，不需要任何API权限。除非用户主动启用云端验证，否则不会发起任何网络请求。

---

## What We Don't Do / 我们不做的事

- ❌ We do NOT collect, store, or transmit personal data
- ❌ We do NOT track browsing history
- ❌ We do NOT use analytics or tracking cookies
- ❌ We do NOT sell or share user data
- ❌ We do NOT act as an intermediary for API calls
- ❌ 不收集、存储或传输个人数据
- ❌ 不追踪浏览历史
- ❌ 不使用分析或追踪Cookie
- ❌ 不出售或共享用户数据
- ❌ 不作为API调用的中间人