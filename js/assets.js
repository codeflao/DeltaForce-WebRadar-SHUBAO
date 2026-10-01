window.RADAR_ASSETS = {
  base: "./assets",
  mapsConfig: null,
  sampleItems: [],
  sampleContainers: [],
  images: new Map(),
  ready: false,

  icon(path) {
    return `${this.base}/${path.replace(/^assets\//, "")}`;
  },

  normalize(src) {
    if (!src) return "";
    if (/^(?:\.\/|https?:|data:|file:)/i.test(src)) return src;
    return `./${String(src).replace(/^\//, "")}`;
  },

  loadImage(src) {
    const key = this.normalize(src);
    if (!key) return Promise.resolve(null);
    if (this.images.has(key)) return this.images.get(key);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        p._img = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = key;
    });
    this.images.set(key, p);
    return p;
  },

  async preload(list) {
    await Promise.all((list || []).map((src) => this.loadImage(src)));
  },

  async init() {
    // file:// 友好：只读页面里已挂载的 JS 全局，绝不 fetch
    if (!window.MAPS_CONFIG) {
      throw new Error("缺少 maps-config.js，请确认与 index.html 同目录结构完整");
    }
    this.mapsConfig = window.MAPS_CONFIG;
    this.sampleItems = window.SAMPLE_ITEMS || [];
    this.sampleContainers = window.SAMPLE_CONTAINERS || [];

    const core = [
      `${this.base}/Icon/Armor.png`,
      `${this.base}/Icon/Helmet.png`,
      `${this.base}/Icon/Bag.png`,
      `${this.base}/Icon/ChestRig.png`,
      `${this.base}/Icon/Exit.png`,
      `${this.base}/Icon/Indicator.png`,
      `${this.base}/Icon/IndicatorNotMe.png`,
      `${this.base}/Icon/PlayerExit.png`,
      `${this.base}/media/e98fc6fe0f6e09903bf1.png`,
      `${this.base}/HeroAvatar/0.png`,
      `${this.base}/media/72e51eed10011e46fc34.png`,
      `${this.base}/media/9dd4ff832df2eb53a5c3.png`,
      `${this.base}/media/321ada54f0bbc26e7294.png`,
      `${this.base}/media/92e2fbe203b590370bfc.png`,
      `${this.base}/media/9b1a289bb4d8ced42cd2.png`,
      `${this.base}/media/02cb9d5b42985656ed9c.png`
    ];
    await this.preload(core);
    this.ready = true;
    return this.mapsConfig;
  },

  async ensureMap(mapId) {
    const cfg = this.mapsConfig?.[mapId];
    if (!cfg) return null;
    const files = [
      ...(cfg.tiles || []).map((t) => t.file),
      ...Object.values(cfg.floors || {}).flat().map((t) => t.file)
    ];
    await this.preload(files);
    return cfg;
  },

  async get(src) {
    return this.loadImage(src);
  },

  levelIcon(level) {
    const map = {
      1: `${this.base}/media/72e51eed10011e46fc34.png`,
      2: `${this.base}/media/9dd4ff832df2eb53a5c3.png`,
      3: `${this.base}/media/321ada54f0bbc26e7294.png`,
      4: `${this.base}/media/92e2fbe203b590370bfc.png`,
      5: `${this.base}/media/9b1a289bb4d8ced42cd2.png`,
      6: `${this.base}/media/02cb9d5b42985656ed9c.png`
    };
    return map[level] || map[1];
  }
};
