const VerityI18n = {
  _locale: 'zh-CN',
  _messages: {},
  _loaded: false,

  SUPPORTED_LOCALES: ['zh-CN', 'en'],

  async init() {
    const stored = await this._getStoredLocale();
    this._locale = stored || this._detectLocale();
    await this.loadLocale(this._locale);
    this._loaded = true;
  },

  _detectLocale() {
    const nav = (typeof navigator !== 'undefined') ? navigator : {};
    const lang = nav.language || nav.userLanguage || 'zh-CN';
    if (lang.startsWith('en')) return 'en';
    return 'zh-CN';
  },

  async _getStoredLocale() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get('locale', (data) => resolve(data.locale || null));
      });
    }
    return null;
  },

  async setLocale(locale) {
    if (!this.SUPPORTED_LOCALES.includes(locale)) return;
    this._locale = locale;
    await this.loadLocale(locale);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ locale }, resolve);
      });
    }
  },

  async loadLocale(locale) {
    try {
      let url;
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        url = chrome.runtime.getURL(`common/i18n/${locale}.json`);
      } else {
        url = `../common/i18n/${locale}.json`;
      }
      const resp = await fetch(url);
      this._messages = await resp.json();
    } catch {
      this._messages = {};
    }
  },

  t(key, params) {
    let msg = this._messages[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replace(`{${k}}`, v);
      }
    }
    return msg;
  },

  get locale() {
    return this._locale;
  }
};

if (typeof window !== 'undefined') {
  window.VerityI18n = VerityI18n;
}