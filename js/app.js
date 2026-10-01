(() => {
  const STORE_KEY = "shubao_radar_settings_v1";
  const DEMO = window.RADAR_DEMO;
  const ASSETS = window.RADAR_ASSETS;
  let itemFilterSyncTimer = null;

  const state = {
    unlocked: false,
    assetsReady: false,
    settings: loadSettings(),
    world: null,
    cameraTarget: "god",
    view: { x: 0, y: 0, scale: 0.25 },
    dragging: false,
    followPausedUntil: 0,
    lastActiveFloor: null,
    lastPtr: null,
    showCameraLists: false,
    settingOpen: false,
    playerListOpen: true,
    itemSearch: "",
    itemCategory: "",
    containerSearch: "",
    fps: 60,
    frames: 0,
    lastFpsAt: performance.now(),
    imgCache: {}
  };

  const els = {
    bootScreen: document.getElementById("bootScreen"),
    bootText: document.getElementById("bootText"),
    pwdGate: document.getElementById("pwdGate"),
    pwdInput: document.getElementById("pwdInput"),
    pwdBoxes: document.getElementById("pwdBoxes"),
    pwdConfirm: document.getElementById("pwdConfirm"),
    pwdError: document.getElementById("pwdError"),
    pwdErrorOk: document.getElementById("pwdErrorOk"),
    app: document.getElementById("app"),
    canvas: document.getElementById("mapCanvas"),
    cameraBtn: document.getElementById("cameraBtn"),
    cameraLabel: document.getElementById("cameraLabel"),
    cameraIcon: document.getElementById("cameraIcon"),
    cameraLists: document.getElementById("cameraLists"),
    cameraHero: document.getElementById("cameraHero"),
    settingsBtn: document.getElementById("settingsBtn"),
    settingMark: document.getElementById("settingMark"),
    settingPanel: document.getElementById("settingPanel"),
    settingClose: document.getElementById("settingClose"),
    topMenus: document.getElementById("topMenus"),
    bottomTabs: document.getElementById("bottomTabs"),
    userCards: document.getElementById("userCards"),
    itemPanel: document.getElementById("itemPanel"),
    containerPanel: document.getElementById("containerPanel"),
    pointCards: document.getElementById("pointCards"),
    playerLists: document.getElementById("playerLists"),
    playerListContent: document.getElementById("playerListContent"),
    playerListCount: document.getElementById("playerListCount"),
    playerCountBadge: document.getElementById("playerCountBadge"),
    togglePlayerList: document.getElementById("togglePlayerList"),
    floorSelector: document.getElementById("floorSelector"),
    itemBoxContainer: document.getElementById("itemBoxContainer"),
    itemBox: document.getElementById("itemBox"),
    fpsLabel: document.getElementById("fpsLabel"),
    resetSettings: document.getElementById("resetSettings"),
    timeoutWarn: document.getElementById("timeoutWarn")
  };

  const ctx = els.canvas.getContext("2d");

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { ...DEMO.DEFAULT_SETTINGS };
      return { ...DEMO.DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEMO.DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.settings));
  }

  function getSetting(key) {
    return state.settings[key];
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
    onSettingsChanged(key, value);
  }

  function assetUrl(path) {
    if (!path) return "";
    if (path.startsWith("./") || path.startsWith("http")) return path;
    return "./" + path.replace(/^\//, "");
  }

  function getImgSync(path) {
    const src = assetUrl(path);
    if (!src) return null;
    if (state.imgCache[src]) return state.imgCache[src];
    // fall through from ASSETS promise cache if already resolved
    const p = ASSETS.images.get(src);
    if (p && typeof p.then !== "function" && p instanceof Image) {
      state.imgCache[src] = p;
      return p;
    }
    // ASSETS stores promises — if settled, pull value
    if (p && p._img) {
      state.imgCache[src] = p._img;
      return p._img;
    }
    return null;
  }

  async function warmImage(path) {
    const src = assetUrl(path);
    if (!src) return null;
    if (state.imgCache[src]) return state.imgCache[src];
    const img = await ASSETS.get(src);
    if (img) {
      state.imgCache[src] = img;
      const prom = ASSETS.images.get(src);
      if (prom) prom._img = img;
    }
    return img;
  }

  async function onSettingsChanged(key, value) {
    if (key === "mapId") {
      await rebuildWorld();
      centerView();
      renderFloors();
    }
    if (key === "showPlayerList") {
      syncPlayerListVisibility();
    }
    if (key === "Camera") {
      const cam = getSetting("Camera");
      if (cam === "自由視角") state.cameraTarget = "god";
      else {
        const hit = state.world?.players?.find((p) => p.name === cam);
        state.cameraTarget = hit ? hit.id : "me";
      }
      updateCameraLabel();
      updateCameraHero();
      followTarget(true);
      renderFloors();
    }
    if (key === "showItemList" || key === "ItemHighValueVisible" || key === "ItemHighValueInfoVisible" || key === "ItemListSize" || key === "ItemMoneyFilter" || key === "ItemLevelFilter" || key === "checkedItems") {
      if (key === "ItemHighValueVisible") state.settings.showItemList = !!value;
      if (key === "showItemList") state.settings.ItemHighValueVisible = !!value;
      // 对齐 OOXX：价值/品质筛选变更后 300ms 重写勾选列表
      if (key === "ItemMoneyFilter" || key === "ItemLevelFilter") {
        clearTimeout(itemFilterSyncTimer);
        itemFilterSyncTimer = setTimeout(() => {
          syncCheckedItemsFromFilters();
          const listEl = els.itemPanel?.querySelector(".item-list");
          if (listEl && state.settingsGroup === "item") {
            renderItemListCards(listEl, getItemCatalog());
          }
          renderItemBox();
        }, 300);
      } else {
        renderItemBox();
      }
    }
    if (key === "PlayerFollow") {
      followTarget(true);
    }
    renderPlayerList();
    renderCameraLists();
    if (key === "makePlayerName") {
      updateCameraLabel();
      renderCameraLists();
      renderPlayerList();
    }
  }

  async function rebuildWorld() {
    const mapId = getSetting("mapId");
    if (els.bootText) els.bootText.textContent = `加载地图 ${mapId}…`;
    await ASSETS.ensureMap(mapId);
    state.world = DEMO.buildWorld(mapId, ASSETS);
    if (!state.world.map.floors.includes(getSetting("floor"))) {
      state.settings.floor = state.world.map.floors.includes("AUTO")
        ? "AUTO"
        : (state.world.map.floors[0] || "AUTO");
      saveSettings();
    }
    state.lastActiveFloor = getActiveFloor();
    const cfg = ASSETS.mapsConfig?.[mapId];
    const mapFiles = cfg
      ? [
          ...cfg.tiles.map((t) => t.file),
          ...Object.values(cfg.floors || {}).flat().map((t) => t.file)
        ]
      : [];
    const warm = [
      ...mapFiles,
      DEMO.ICONS.indicator,
      DEMO.ICONS.indicatorOther,
      DEMO.ICONS.exit,
      DEMO.ICONS.playerExit,
      DEMO.ICONS.helmet,
      DEMO.ICONS.armor,
      DEMO.ICONS.bag,
      DEMO.ICONS.chest,
      ...DEMO.HEROES.map((h) => h.avatar),
      ...state.world.items.map((i) => i.icon)
    ];
    await Promise.all(warm.map((p) => warmImage(p)));
  }

  /* ---------------- Boot + Password ---------------- */
  async function bootAssets() {
    els.pwdGate.classList.add("hidden");
    els.bootScreen?.classList.remove("hidden");
    try {
      if (els.bootText) els.bootText.textContent = "正在加载本地资源…";
      await ASSETS.init();
      if (!ASSETS.mapsConfig) throw new Error("地图配置未加载");
      if (els.bootText) els.bootText.textContent = "加载地图瓦片…";
      await ASSETS.ensureMap(getSetting("mapId") || "Dam_Iris");
      state.assetsReady = true;
      if (els.bootText) els.bootText.textContent = "就绪";
      els.bootScreen?.classList.add("hidden");
      els.pwdGate.classList.remove("hidden");
      initPwd();
    } catch (err) {
      console.error(err);
      if (els.bootText) {
        els.bootText.textContent = "加载失败：" + (err && err.message ? err.message : String(err));
      }
    }
  }

  function initPwd() {
    els.pwdBoxes.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("div");
      b.className = "pwd-input-box";
      els.pwdBoxes.appendChild(b);
    }

    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("pwd");
    if (fromUrl) {
      els.pwdInput.value = fromUrl.slice(0, 8);
      syncPwdBoxes();
      if (fromUrl === DEMO.DEMO_PWD) {
        unlock();
        return;
      }
    }

    els.pwdGate.addEventListener("click", (e) => {
      if (e.target.closest(".pwd-error-overlay")) return;
      els.pwdInput.focus();
    });
    els.pwdInput.addEventListener("input", () => {
      els.pwdInput.value = els.pwdInput.value.replace(/\D/g, "").slice(0, 8);
      syncPwdBoxes();
    });
    els.pwdConfirm.addEventListener("click", tryUnlock);
    els.pwdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
    els.pwdErrorOk?.addEventListener("click", hidePwdError);
    els.pwdError?.addEventListener("click", (e) => {
      if (e.target === els.pwdError) hidePwdError();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.pwdError && !els.pwdError.classList.contains("hidden")) {
        hidePwdError();
      }
    });
    setTimeout(() => els.pwdInput.focus(), 30);
  }

  function syncPwdBoxes() {
    const v = els.pwdInput.value;
    [...els.pwdBoxes.children].forEach((box, i) => {
      box.textContent = v[i] || "";
      box.classList.toggle("filled", Boolean(v[i]));
    });
    els.pwdConfirm.classList.toggle("active", v.length >= 4);
  }

  function showPwdError() {
    [...els.pwdBoxes.children].forEach((b) => b.classList.add("invalid"));
    els.pwdError?.classList.remove("hidden");
    els.pwdError?.classList.add("show");
  }

  function hidePwdError() {
    els.pwdError?.classList.remove("show");
    els.pwdError?.classList.add("hidden");
    [...els.pwdBoxes.children].forEach((b) => b.classList.remove("invalid"));
    els.pwdInput.value = "";
    syncPwdBoxes();
    setTimeout(() => els.pwdInput.focus(), 20);
  }

  function tryUnlock() {
    const v = els.pwdInput.value;
    if (v.length < 4) return;
    if (v === DEMO.DEMO_PWD) {
      unlock();
      return;
    }
    showPwdError();
  }

  async function unlock() {
    if (state.unlocked) return;
    state.unlocked = true;
    els.pwdError?.classList.add("hidden");
    els.pwdError?.classList.remove("show");
    els.pwdGate.classList.add("hide");
    setTimeout(() => els.pwdGate.classList.add("hidden"), 280);
    els.app.classList.remove("hidden");
    if (els.timeoutWarn) els.timeoutWarn.hidden = true;
    await bootApp();
  }

  /* ---------------- Settings builders ---------------- */
  function switchRow(label, key) {
    const row = document.createElement("div");
    row.className = "setting-item";
    const on = !!getSetting(key);
    row.innerHTML = `
      <div class="setting-item-label">${label}</div>
      <div class="setting-item-value">
        <span class="MuiSwitch-root MuiSwitch-sizeSmall ${on ? "Mui-checked" : ""}">
          <span class="MuiSwitch-switchBase ${on ? "Mui-checked" : ""}">
            <input class="MuiSwitch-input" type="checkbox" data-key="${key}" ${on ? "checked" : ""} />
            <span class="MuiSwitch-thumb"></span>
          </span>
          <span class="MuiSwitch-track"></span>
        </span>
      </div>`;
    return row;
  }

  function formatSliderDesc(key, val) {
    const n = Number(val);
    if (key === "ItemMoneyFilter") return n > 0 ? formatMoney(n) : "全部";
    if (key === "ItemSize" || key === "ItemListSize" || key === "ContainersSize") {
      return `${(n / 12).toFixed(2)} x`;
    }
    if (key === "MapAreaNameSize") return `${(n / 40).toFixed(2)} x`;
    if (key === "MapAreaNameOpacity") return String(val);
    if (key === "ItemLevelFilter") {
      return `<div class="item-level-tag"><img src="${assetUrl(ASSETS.levelIcon(n))}" alt="level-${n}" />Lv.${n}</div>`;
    }
    return String(val);
  }

  function sliderRow(label, key, min, max, step = 1) {
    const row = document.createElement("div");
    row.className = "setting-item col";
    const val = getSetting(key);
    const pct = ((Number(val) - min) / (max - min)) * 100;
    const desc = formatSliderDesc(key, val);
    row.innerHTML = `
      <div class="setting-item-label">${label}<span class="setting-item-label-desc" data-desc-for="${key}">${desc}</span></div>
      <div class="setting-item-value">
        <span class="MuiSlider-root MuiSlider-colorPrimary MuiSlider-sizeSmall">
          <span class="MuiSlider-rail"></span>
          <span class="MuiSlider-track" style="width:${pct}%"></span>
          <span class="MuiSlider-thumb MuiSlider-thumbSizeSmall" style="left:${pct}%"></span>
          <input type="range" class="MuiSlider-input" min="${min}" max="${max}" step="${step}" value="${val}" data-key="${key}" />
        </span>
      </div>`;
    return row;
  }

  function selectRow(label, key, options) {
    const row = document.createElement("div");
    row.className = "setting-item";
    const opts = options.map((o) => {
      const value = typeof o === "string" ? o : o.value;
      const text = typeof o === "string" ? o : o.label;
      return `<option value="${value}" ${getSetting(key) === value ? "selected" : ""}>${text}</option>`;
    }).join("");
    row.innerHTML = `
      <div class="setting-item-label">${label}</div>
      <div class="setting-item-value">
        <select class="setting-select" data-key="${key}">${opts}</select>
      </div>`;
    return row;
  }

  function card(title, nodes) {
    const c = document.createElement("div");
    c.className = "setting-card";
    const header = document.createElement("div");
    header.className = "setting-card-header";
    header.textContent = title;
    const body = document.createElement("div");
    body.className = "setting-card-content";
    nodes.forEach((n, i) => {
      body.appendChild(n);
      if (i < nodes.length - 1) {
        const line = document.createElement("div");
        line.className = "setting-item-line";
        body.appendChild(line);
      }
    });
    c.append(header, body);
    return c;
  }

  function masonryCols() {
    const w = els.settingPanel?.clientWidth || window.innerWidth;
    if (w <= 500) return 1;
    if (w <= 780) return 2;
    return 3;
  }

  function fillMasonry(container, cards) {
    container.innerHTML = "";
    container.className = "my-masonry-grid";
    const n = masonryCols();
    const cols = Array.from({ length: n }, () => {
      const col = document.createElement("div");
      col.className = "my-masonry-grid_column";
      container.appendChild(col);
      return col;
    });
    cards.forEach((cardEl, i) => cols[i % n].appendChild(cardEl));
  }

  function renderUserCards() {
    const cards = [
      card("干员 / Player", [
        switchRow("是否显示", "showPlayers"),
        switchRow("隐藏队伍详细", "hideTeamDetails"),
        switchRow("隐藏队友", "hideTeammates"),
        switchRow("队友同色", "teammateSameColor"),
        switchRow("視角跟随", "PlayerFollow"),
        switchRow("玩家信息", "showPlayerInfo"),
        switchRow("彩色背景", "colorBg"),
        switchRow("玩家昵称", "showPlayerName"),
        switchRow("玩家英雄", "showPlayerHeroName"),
        switchRow("显示武器", "showPlayerWeapon"),
        switchRow("显示武器名称", "showPlayerWeaponName"),
        switchRow("打码昵称", "makePlayerName"),
        switchRow("玩家头甲", "showPlayerHelmet"),
        switchRow("玩家胸挂背包", "showPlayerChestRigBag"),
        switchRow("显示高度", "PlayerHeight"),
        switchRow("显示距离", "PlayerDistance"),
        switchRow("使用线朝向", "PlayerAimLine"),
        switchRow("辅助射线", "showAssistLine"),
        sliderRow("线朝向长度", "PlayerAimLineLength", 4, 30),
        sliderRow("玩家大小", "PlayerSize", 8, 48)
      ]),
      card("人机 / AI", [
        switchRow("是否显示", "BotVisible"),
        switchRow("显示信息", "BotInfo"),
        switchRow("彩色背景", "BotColorBg"),
        switchRow("显示高度", "BotHeight"),
        sliderRow("人机大小", "BotSize", 8, 40),
        sliderRow("人机透明度", "BotOpacity", 10, 100)
      ]),
      card("BOSS", [
        switchRow("是否显示", "BossVisible"),
        switchRow("显示信息", "BossInfo"),
        switchRow("彩色背景", "BossColorBg"),
        switchRow("显示高度", "BossHeight"),
        sliderRow("BOSS大小", "BossSize", 8, 56),
        sliderRow("BOSS透明度", "BossOpacity", 10, 100)
      ])
    ];
    fillMasonry(els.userCards, cards);
    bindSettingControls(els.userCards);
  }

  function getItemCatalog() {
    return state.world?.itemsCatalog || DEMO.ITEMS || window.SAMPLE_ITEMS || [];
  }

  function filterCatalogBySettings(catalog) {
    const moneyMin = Number(getSetting("ItemMoneyFilter") || 0);
    const levelMin = Number(getSetting("ItemLevelFilter") || 4);
    return (catalog || []).filter((x) => Number(x.money) >= moneyMin && Number(x.level) >= levelMin);
  }

  function syncCheckedItemsFromFilters() {
    const ids = filterCatalogBySettings(getItemCatalog()).map((x) => x.id);
    state.settings.checkedItems = ids;
    saveSettings();
  }

  function getCheckedItemSet(catalog) {
    const saved = getSetting("checkedItems");
    if (Array.isArray(saved) && saved.length) return new Set(saved);
    // 对齐 OOXX：默认勾选 money>=筛选 且 level>=筛选（默认品质 4）
    return new Set(filterCatalogBySettings(catalog).map((x) => x.id));
  }

  function normalizeItemId(id) {
    return String(id || "").replace(/^A/, "");
  }

  function renderItemListCards(listEl, catalog) {
    const checked = getCheckedItemSet(catalog);
    const q = (state.itemSearch || "").trim();
    let list = catalog.slice();
    if (state.itemCategory) {
      list = list.filter((it) => it.category === state.itemCategory);
    }
    if (q) {
      list = list.filter((it) => (it.name || "").includes(q));
    }
    list = list
      .filter((it) => it.icon || it.name)
      .sort((a, b) => Number(b.money) - Number(a.money))
      .sort((a, b) => Number(b.level) - Number(a.level));

    listEl.innerHTML = "";
    list.forEach((item) => {
      const on = checked.has(item.id) || checked.has(normalizeItemId(item.id));
      const levelIcon = ASSETS.levelIcon(item.level);
      const wrap = document.createElement("div");
      wrap.className = "item-card-container";
      wrap.innerHTML = `
        <div class="item-card-bg ${on ? "checked" : ""} level-${item.level}"></div>
        <div class="item-card level-${item.level} ${on ? "checked" : ""}" data-item="${item.id}">
          <div class="item-card-header">
            <img class="item-card-level-icon" src="${assetUrl(levelIcon)}" alt="lv" />
            <span class="item-card-level">Lv.${item.level}</span>
            <span class="item-card-money">${formatMoney(item.money)}</span>
          </div>
          <img class="item-card-image" src="${assetUrl(item.icon)}" alt="${item.name}" loading="lazy" />
          <div class="item-card-content">
            <div class="item-card-name">${item.name}</div>
            <div class="item-card-checked ${on ? "checked" : ""}"></div>
          </div>
        </div>`;
      wrap.querySelector(".item-card").addEventListener("click", () => {
        const set = getCheckedItemSet(catalog);
        if (set.has(item.id)) set.delete(item.id);
        else set.add(item.id);
        setSetting("checkedItems", [...set]);
        renderItemListCards(listEl, catalog);
        renderItemBox();
      });
      listEl.appendChild(wrap);
    });
  }

  function appendSettingRows(body, rows) {
    rows.forEach((row, i) => {
      if (row === "line") {
        const line = document.createElement("div");
        line.className = "setting-item-line";
        body.appendChild(line);
        return;
      }
      body.appendChild(row);
    });
  }

  function renderItemPanel() {
    const catalog = getItemCatalog();
    const categories = window.ITEM_CATEGORIES || [{ name: "全部", value: "" }];

    const cfg = document.createElement("div");
    cfg.className = "item-config";
    const infoCard = document.createElement("div");
    infoCard.className = "setting-card";
    infoCard.innerHTML = `<div class="setting-card-header">物资信息 / Items</div>`;
    const infoBody = document.createElement("div");
    infoBody.className = "setting-card-content";
    appendSettingRows(infoBody, [
      switchRow("是否显示", "ItemsVisible"),
      "line",
      switchRow("显示物资列表", "ItemHighValueVisible"),
      switchRow("物资列表名称/距离", "ItemHighValueInfoVisible"),
      "line",
      sliderRow("物资列表大小", "ItemListSize", 8, 30),
      "line",
      switchRow("显示未知物资", "ItemUndefinedVisible"),
      "line",
      switchRow("显示物资名称", "ItemNameVisible"),
      switchRow("显示物资价值", "ItemMoneyVisible"),
      "line",
      switchRow("显示高度", "ItemHeightVisible"),
      switchRow("显示楼层", "ItemFloorVisible"),
      "line",
      sliderRow("价值筛选", "ItemMoneyFilter", 0, 5000000, 10000),
      "line",
      sliderRow("品质筛选", "ItemLevelFilter", 1, 6),
      "line",
      sliderRow("物资大小", "ItemSize", 8, 30)
    ]);
    infoCard.appendChild(infoBody);
    cfg.appendChild(infoCard);

    const listCard = document.createElement("div");
    listCard.className = "setting-card";
    listCard.innerHTML = `
      <div class="setting-card-header">
        物资列表
        <div class="setting-card-header-input">
          <input type="text" placeholder="搜索物资" value="${String(state.itemSearch || "").replace(/"/g, "&quot;")}" />
        </div>
      </div>`;
    const listBody = document.createElement("div");
    listBody.className = "setting-card-content no-padding";

    const typeBar = document.createElement("div");
    typeBar.className = "item-type";
    categories.forEach((cat) => {
      const tab = document.createElement("div");
      tab.className = `item-type-item${state.itemCategory === cat.value ? " active" : ""}`;
      tab.textContent = cat.name;
      tab.dataset.value = cat.value;
      tab.addEventListener("click", () => {
        state.itemCategory = cat.value;
        typeBar.querySelectorAll(".item-type-item").forEach((el) => {
          el.classList.toggle("active", el.dataset.value === state.itemCategory);
        });
        renderItemListCards(list, catalog);
      });
      typeBar.appendChild(tab);
    });

    const list = document.createElement("div");
    list.className = "item-list";
    renderItemListCards(list, catalog);

    listBody.append(typeBar, list);
    listCard.appendChild(listBody);

    const searchInput = listCard.querySelector(".setting-card-header-input > input");
    searchInput.addEventListener("input", () => {
      state.itemSearch = searchInput.value || "";
      renderItemListCards(list, catalog);
    });

    const listHeader = listCard.querySelector(".setting-card-header");
    listHeader.style.cursor = "pointer";
    listHeader.title = "点击回到顶部";
    listHeader.addEventListener("click", (e) => {
      if (e.target.closest(".setting-card-header-input")) return;
      listBody.scrollTo({ top: 0, behavior: "smooth" });
    });

    els.itemPanel.innerHTML = "";
    els.itemPanel.append(cfg, listCard);
    bindSettingControls(cfg);
  }

  function getContainerCatalog() {
    return state.world?.containersCatalog || DEMO.CONTAINERS || window.SAMPLE_CONTAINERS || [];
  }

  function renderContainerListCards(listEl, catalog) {
    const checked = new Set(getSetting("checkedContainers") || []);
    const q = (state.containerSearch || "").trim();
    let list = catalog.slice();
    if (q) list = list.filter((c) => (c.name || "").includes(q));

    listEl.innerHTML = "";
    list.forEach((c) => {
      const on = checked.has(c.id);
      const cardEl = document.createElement("div");
      cardEl.className = `item-card level-${c.level || 1}${on ? " checked" : ""}`;
      cardEl.innerHTML = `
        <div class="item-card-image"><img src="${assetUrl(c.icon)}" alt="${c.name}" loading="lazy" /></div>
        <div class="item-card-name">${c.name}</div>`;
      cardEl.querySelector(".item-card-image").addEventListener("click", () => {
        const set = new Set(getSetting("checkedContainers") || []);
        if (set.has(c.id)) set.delete(c.id);
        else set.add(c.id);
        setSetting("checkedContainers", [...set]);
        renderContainerListCards(listEl, catalog);
      });
      listEl.appendChild(cardEl);
    });
  }

  function renderContainerPanel() {
    const catalog = getContainerCatalog();

    const cfg = document.createElement("div");
    cfg.className = "item-config";
    const infoCard = document.createElement("div");
    infoCard.className = "setting-card";
    infoCard.innerHTML = `<div class="setting-card-header">容器信息 / Containers</div>`;
    const infoBody = document.createElement("div");
    infoBody.className = "setting-card-content";
    appendSettingRows(infoBody, [
      switchRow("是否顯示", "ContainersVisible"),
      "line",
      switchRow("显示名称", "ContainersNameVisible"),
      switchRow("显示密码", "ContainersPwdVisible"),
      switchRow("显示高度", "ContainersHeightVisible"),
      switchRow("显示楼层", "ContainersFloorVisible"),
      "line",
      sliderRow("容器大小", "ContainersSize", 8, 30)
    ]);
    infoCard.appendChild(infoBody);
    cfg.appendChild(infoCard);

    const listCard = document.createElement("div");
    listCard.className = "setting-card";
    listCard.innerHTML = `
      <div class="setting-card-header">
        容器列表
        <div class="setting-card-header-input">
          <input type="text" placeholder="搜索容器" value="${String(state.containerSearch || "").replace(/"/g, "&quot;")}" />
        </div>
      </div>`;
    const body = document.createElement("div");
    body.className = "setting-card-content no-padding";
    const list = document.createElement("div");
    list.className = "item-list";
    renderContainerListCards(list, catalog);
    body.appendChild(list);
    listCard.appendChild(body);

    const searchInput = listCard.querySelector(".setting-card-header-input > input");
    searchInput.addEventListener("input", () => {
      state.containerSearch = searchInput.value || "";
      renderContainerListCards(list, catalog);
    });

    els.containerPanel.innerHTML = "";
    els.containerPanel.append(cfg, listCard);
    bindSettingControls(cfg);
  }

  function renderPointCards() {
    fillMasonry(els.pointCards, [
      card("死亡盒子 / Dead Box", [
        switchRow("显示盒子", "DeadBoxVisible"),
        switchRow("玩家盒子", "PlayerDeadBox"),
        switchRow("人机盒子", "BotDeadBox"),
        switchRow("隐藏已打开盒子", "HideOpendBox"),
        switchRow("显示高度", "DeadBoxHeight"),
        switchRow("显示楼层", "DeadBoxFloorVisible"),
        sliderRow("盒子大小", "DeadBoxSize", 8, 32),
        sliderRow("盒子透明度", "DeadBoxOpacity", 10, 100)
      ]),
      card("钥匙房 / Key Room", [
        switchRow("显示钥匙房", "KeyRoomVisible"),
        switchRow("显示高度", "KeyRoomHeight"),
        switchRow("显示楼层", "KeyRoomFloorVisible"),
        sliderRow("钥匙房大小", "KeyRoomSize", 8, 36),
        sliderRow("钥匙房透明度", "KeyRoomOpacity", 10, 100)
      ]),
      card("密码房 / Password Room", [
        switchRow("显示密码房", "PasswordRoomVisible"),
        switchRow("显示高度", "PasswordRoomHeight"),
        switchRow("显示楼层", "PasswordRoomFloorVisible"),
        sliderRow("密码房大小", "PasswordRoomSize", 8, 36),
        sliderRow("密码房透明度", "PasswordRoomOpacity", 10, 100)
      ]),
      card("拉闸点 / Switch Point", [
        switchRow("显示拉闸点", "ExitSwitchVisible"),
        sliderRow("拉闸点大小", "ExitSwitchSize", 8, 36),
        sliderRow("拉闸点透明度", "ExitSwitchOpacity", 10, 100)
      ]),
      card("撤离点 / Exit Point", [
        switchRow("显示撤离点", "ExitPointVisible"),
        sliderRow("撤离点大小", "ExitPointSize", 8, 40),
        sliderRow("撤离点透明度", "ExitPointOpacity", 10, 100)
      ]),
      card("地图信息 / Map", [
        selectRow("当前地图", "mapId", DEMO.MAPS.map((m) => ({ value: m.id, label: m.name }))),
        switchRow("显示区域名称", "MapAreaNameVisible"),
        sliderRow("区域名称大小", "MapAreaNameSize", 20, 120),
        sliderRow("区域名称透明度", "MapAreaNameOpacity", 10, 100)
      ])
    ]);
    bindSettingControls(els.pointCards);
  }

  function syncMuiSwitch(el) {
    const root = el.closest(".MuiSwitch-root");
    const base = root?.querySelector(".MuiSwitch-switchBase");
    root?.classList.toggle("Mui-checked", el.checked);
    base?.classList.toggle("Mui-checked", el.checked);
  }

  function syncMuiSlider(el) {
    const root = el.closest(".MuiSlider-root");
    if (!root) return;
    const min = Number(el.min);
    const max = Number(el.max);
    const pct = ((Number(el.value) - min) / (max - min)) * 100;
    const track = root.querySelector(".MuiSlider-track");
    const thumb = root.querySelector(".MuiSlider-thumb");
    if (track) track.style.width = `${pct}%`;
    if (thumb) thumb.style.left = `${pct}%`;
    const key = el.dataset.key;
    const desc = el.closest(".setting-item")?.querySelector(`[data-desc-for="${key}"]`)
      || el.closest(".setting-item")?.querySelector(".setting-item-label-desc");
    if (desc) {
      const html = formatSliderDesc(key, el.value);
      if (html.includes("<")) desc.innerHTML = html;
      else desc.textContent = html;
    }
  }

  function bindSettingControls(root) {
    root.querySelectorAll("input[type=checkbox][data-key]").forEach((el) => {
      syncMuiSwitch(el);
      el.addEventListener("change", () => {
        syncMuiSwitch(el);
        setSetting(el.dataset.key, el.checked);
      });
    });
    root.querySelectorAll("input[type=range][data-key]").forEach((el) => {
      syncMuiSlider(el);
      el.addEventListener("input", () => {
        syncMuiSlider(el);
        setSetting(el.dataset.key, Number(el.value));
      });
    });
    root.querySelectorAll("select[data-key]").forEach((el) => {
      el.addEventListener("change", async () => {
        setSetting(el.dataset.key, el.value);
        if (el.dataset.key === "mapId") {
          await rebuildWorld();
          centerView();
          renderFloors();
          renderUserCards();
        }
        if (el.dataset.key === "floor") renderFloors();
      });
    });
  }

  function openSettings() {
    state.settingOpen = true;
    els.settingMark.classList.add("show");
    els.settingPanel.classList.add("show");
    requestAnimationFrame(() => {
      if (state.settingsGroup === "user" || !state.settingsGroup) {
        renderUserCards();
      } else if (state.settingsGroup === "points") {
        renderPointCards();
      }
    });
  }

  function closeSettings() {
    state.settingOpen = false;
    els.settingMark.classList.remove("show");
    els.settingPanel.classList.remove("show");
  }

  function showPanel(name) {
    state.settingsGroup = name;
    document.querySelectorAll(".setting-content").forEach((p) => {
      const on = p.dataset.panel === name;
      p.classList.toggle("show", on);
      p.classList.toggle("hide", !on);
    });
    [...els.topMenus.children].forEach((m) => m.classList.toggle("active", m.dataset.group === name));
    if (name === "user") renderUserCards();
    if (name === "item") renderItemPanel();
    if (name === "containers") renderContainerPanel();
    if (name === "points") renderPointCards();
  }

  /* ---------------- Lists ---------------- */
  function formatMoney(n) {
    const v = Number(n) || 0;
    if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(2)}K`;
    return String(v);
  }

  function renderItemBox() {
    if (!els.itemBox || !els.itemBoxContainer || !state.world) return;
    const show = (getSetting("ItemHighValueVisible") || getSetting("showItemList")) && getSetting("ItemsVisible");
    els.itemBoxContainer.hidden = !show;
    if (!show) {
      els.itemBox.innerHTML = "";
      return;
    }
    const showInfo = getSetting("ItemHighValueInfoVisible") !== false;
    const me = state.world.players.find((p) => p.isMe);
    const moneyMin = Number(getSetting("ItemMoneyFilter") || 0);
    const levelMin = Number(getSetting("ItemLevelFilter") || 1);
    const catalog = state.world.itemsCatalog || [];
    const checked = getCheckedItemSet(catalog);
    const prevActive = els.itemBox.querySelector(".item-box-item.active")?.dataset.key;

    const rows = state.world.items
      .map((it) => {
        const meta = catalog.find((c) => c.id === it.itemId || c.id === it.id) || it;
        const money = meta.money ?? it.money ?? 0;
        const level = meta.level ?? it.level ?? 1;
        const name = meta.name || it.name || "未知";
        const icon = meta.icon || it.icon;
        const id = it.itemId || meta.id || it.id;
        if (!checked.has(id) && !checked.has(normalizeItemId(id)) && !checked.has(`A${normalizeItemId(id)}`)) return null;
        if (money < moneyMin) return null;
        if (level < levelMin) return null;
        const dist = me ? Math.round(Math.hypot(it.x - me.x, it.y - me.y) / 20) : 0;
        return { key: it.uid || `${id}_${it.x}_${it.y}`, id, name, money, level, icon, dist, x: it.x, y: it.y };
      })
      .filter(Boolean)
      .sort((a, b) => b.money - a.money)
      .slice(0, 10);

    const signature = rows.map((r) => `${r.key}:${r.dist}:${r.money}`).join("|") + `|${getSetting("ItemListSize")}|${showInfo}`;
    if (signature === state.itemBoxSignature && els.itemBox.children.length) {
      els.itemBox.style.scale = String(Number(getSetting("ItemListSize") || 12) / 12);
      return;
    }
    state.itemBoxSignature = signature;

    const scale = (Number(getSetting("ItemListSize") || 12) / 12);
    els.itemBox.style.scale = String(scale);
    els.itemBox.innerHTML = rows.map((r) => `
      <div class="item-box-item level-${r.level}${prevActive === r.key ? " active" : ""}" data-key="${r.key}" data-x="${r.x}" data-y="${r.y}">
        <div class="item-box-item-view">
          <img class="item-card-image" src="${assetUrl(r.icon)}" alt="${r.name}" />
          <img class="item-card-level-icon" src="${assetUrl(ASSETS.levelIcon(r.level))}" alt="lv" />
          <div class="item-box-item-info-money">${formatMoney(r.money)}</div>
        </div>
        ${showInfo ? `<div class="item-box-item-info">
          <div class="item-box-item-info-name">${r.name}</div>
          <div class="item-box-item-info-description">${r.dist}m</div>
        </div>` : ""}
      </div>`).join("");

    els.itemBox.querySelectorAll(".item-box-item").forEach((el) => {
      el.querySelector(".item-box-item-view")?.addEventListener("click", () => {
        const active = el.classList.contains("active");
        els.itemBox.querySelectorAll(".item-box-item").forEach((n) => n.classList.remove("active"));
        if (!active) {
          el.classList.add("active");
          const x = Number(el.dataset.x);
          const y = Number(el.dataset.y);
          const rect = els.canvas.getBoundingClientRect();
          state.view.x = rect.width / 2 - x * state.view.scale;
          state.view.y = rect.height / 2 - y * state.view.scale;
          setSetting("Camera", "自由視角");
        }
      });
    });
  }

  function teamColor(team) {
    return ["#26bbff", "#ff6b6b", "#ffd166", "#06d6a0", "#9775d9", "#f4a261"][(team - 1) % 6];
  }

  function hexToRgb(hex) {
    const h = String(hex || "").replace("#", "");
    if (h.length < 6) return { r: 38, g: 187, b: 255 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function playerTeamRgb(p) {
    const hex = p.isMe || (p.isTeammate && getSetting("teammateSameColor"))
      ? "#26bbff"
      : teamColor(p.team);
    return hexToRgb(hex);
  }

  function equipLevel(v) {
    if (v && typeof v === "object") return Number(v.level) || 0;
    return Number(v) || 0;
  }

  function equipDurability(v) {
    if (v && typeof v === "object") {
      const n = Number(v.durability);
      return Number.isFinite(n) ? Math.round(n) : "";
    }
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : "";
  }

  const EQUIP_LEVEL_COLORS = {
    0: "#ebe9e9",
    1: "#ebe9e9",
    2: "#2aca96",
    3: "#589fdc",
    4: "#9e78db",
    5: "#d0824e",
    6: "#da5758"
  };
  const EQUIP_LEVEL_FILTERS = {
    "#ebe9e9": "",
    "#2aca96": "invert(58%) sepia(83%) saturate(385%) hue-rotate(116deg) brightness(97%) contrast(91%)",
    "#589fdc": "invert(57%) sepia(14%) saturate(1788%) hue-rotate(176deg) brightness(94%) contrast(87%)",
    "#9e78db": "invert(50%) sepia(29%) saturate(1401%) hue-rotate(229deg) brightness(95%) contrast(91%)",
    "#d0824e": "invert(54%) sepia(75%) saturate(638%) hue-rotate(339deg) brightness(90%) contrast(84%)",
    "#da5758": "brightness(0) saturate(100%) invert(22%) sepia(78%) saturate(3852%) hue-rotate(343deg) brightness(107%) contrast(97%)"
  };

  function equipFilter(level) {
    const color = EQUIP_LEVEL_COLORS[Number(level) || 0] || EQUIP_LEVEL_COLORS[0];
    return EQUIP_LEVEL_FILTERS[color] || "";
  }

  function weaponName(id) {
    if (!id) return "";
    const key = String(id).replace(/^A/, "");
    return (window.SAMPLE_WEAPONS && window.SAMPLE_WEAPONS[key]) || "未知武器";
  }

  function isValidWeaponId(id) {
    if (id == null || id === "") return false;
    const key = String(id).replace(/^A/, "");
    if (!key || key === "0") return false;
    const blacklist = window.WEAPON_BLACKLIST || ["18100000002", "18110000000"];
    if (blacklist.includes(key)) return false;
    // 有图鉴名或本地武器图均视为有效
    if (window.SAMPLE_WEAPONS && window.SAMPLE_WEAPONS[key]) return true;
    return /^\d{8,}$/.test(key);
  }

  function playerWeapons(p) {
    if (!getSetting("showPlayerWeapon")) return [];
    const list = [
      { type: "primary", id: p.weaponId || p.weapon, name: weaponName(p.weaponId || p.weapon) },
      { type: "secondary", id: p.weapon2Id || p.weapon2, name: weaponName(p.weapon2Id || p.weapon2) }
    ];
    return list.filter((w) => isValidWeaponId(w.id));
  }

  function healthBarColor(p) {
    if (Number(p.status) === 1) return "#ff4444";
    if (Number(p.hp) >= 100) return "#888888";
    return "#ffffffd3";
  }

  function getPlayerListEntries() {
    const raw = (state.world?.players || []).filter((p) => {
      const isPlayer = p.playerType === 1 || p.type === "player" || (!p.type && !p.playerType);
      return isPlayer && String(p.name || "").trim();
    });
    const rawCount = raw.length;
    const seen = new Set();
    const list = [];
    raw.forEach((p) => {
      if (seen.has(p.name)) return;
      seen.add(p.name);
      list.push(p);
    });
    list.sort((a, b) => {
      if (!!a.isTeammate !== !!b.isTeammate) return a.isTeammate ? -1 : 1;
      const ta = Number(a.team) || 0;
      const tb = Number(b.team) || 0;
      if (ta !== tb) return ta - tb;
      const ca = playerTeamRgb(a);
      const cb = playerTeamRgb(b);
      return (ca.r + ca.g + ca.b) - (cb.r + cb.g + cb.b);
    });
    return { list, rawCount };
  }

  function renderEquipmentItem({ type, icon, label, level, durability, iconOnly = false }) {
    const lv = Number(level) || 0;
    if (!getSetting("showPlayerHelmet") || lv <= 0) return "";
    const dur = durability === "" || durability == null ? "" : durability;
    const filter = equipFilter(lv);
    return `<div class="equipment-item ${type}${iconOnly ? " icon-only" : ""}" title="${label}">
      <img src="${assetUrl(icon)}" alt="${label}" style="filter:${filter}" />
      ${!iconOnly && dur !== "" ? `<span>${dur}</span>` : ""}
    </div>`;
  }

  function distToMe(p) {
    const me = state.world.players.find((x) => x.isMe);
    if (!me) return 0;
    return Math.round(Math.hypot(p.x - me.x, p.y - me.y) / 20);
  }

  function syncPlayerListVisibility() {
    const show = !!getSetting("showPlayerList");
    const { list } = state.world ? getPlayerListEntries() : { list: [] };
    const visible = show && list.length > 0;
    els.playerLists?.classList.toggle("hidden", !visible);
  }

  function renderPlayerList() {
    if (!state.world) return;
    const { list: players, rawCount } = getPlayerListEntries();
    els.playerListCount.textContent = `${rawCount} 玩家`;
    els.playerCountBadge.textContent = String(rawCount);
    syncPlayerListVisibility();

    const nameMode = !!getSetting("showPlayerWeaponName");
    els.playerListContent.innerHTML = players.map((p) => {
      const hero = heroById(p.hero);
      const rgb = playerTeamRgb(p);
      const teamCss = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      const camOn = getSetting("Camera") === p.name;
      const weapons = playerWeapons(p);
      const hasWeapon = weapons.length > 0;
      const classes = [
        "player-item",
        camOn ? "current-camera" : "",
        p.isTeammate ? "teammate" : "",
        hasWeapon ? "has-weapon" : "",
        hasWeapon && nameMode ? "weapon-name-mode" : ""
      ].filter(Boolean).join(" ");

      const weaponHtml = hasWeapon
        ? `<div class="weapon-container">${weapons.map((w) => {
          const id = String(w.id).replace(/^A/, "");
          if (nameMode) {
            return `<span class="weapon-name ${w.type}">${w.name || "未知武器"}</span>`;
          }
          return `<div class="weapon"><img class="weapon-icon ${w.type}" src="${assetUrl(`assets/Weapon/${id}.png`)}" alt="${w.name || ""}" onerror="this.style.display='none'" /></div>`;
        }).join("")}</div>`
        : "";

      return `
        <div class="${classes}" data-id="${p.id}" data-name="${p.name}" data-type="${p.playerType || 1}"
          style="--team-color:${teamCss};background-color:rgba(${rgb.r},${rgb.g},${rgb.b},0.1)">
          <div class="player-avatar">
            <img class="hero-avatar" src="${assetUrl(hero.avatar)}" alt="${hero.name}" />
            <div class="team-id ${p.isTeammate ? "teammate-badge" : ""}">${p.isTeammate ? "队友" : (p.team ?? "")}</div>
          </div>
          <div class="player-info">
            <div class="player-name-row">
              ${getSetting("showPlayerHeroName") && hero.name ? `<span class="hero-name">${hero.name}</span>` : ""}
              <span class="player-name">${displayPlayerName(p)}</span>
            </div>
            <div class="player-equipment">
              ${renderEquipmentItem({ type: "helmet", icon: DEMO.ICONS.helmet, label: "头盔", level: equipLevel(p.helmet), durability: equipDurability(p.helmet) })}
              ${renderEquipmentItem({ type: "armor", icon: DEMO.ICONS.armor, label: "护甲", level: equipLevel(p.armor), durability: equipDurability(p.armor) })}
              ${renderEquipmentItem({ type: "chest-rig", icon: DEMO.ICONS.chest, label: "胸挂", level: equipLevel(p.chest ?? p.chestRig), iconOnly: true })}
              ${renderEquipmentItem({ type: "bag", icon: DEMO.ICONS.bag, label: "背包", level: equipLevel(p.bag), iconOnly: true })}
            </div>
          </div>
          ${weaponHtml}
          <div class="health-bar"><div class="health-fill" style="width:${Number(p.hp) || 0}%;background-color:${healthBarColor(p)}"></div></div>
        </div>`;
    }).join("") || `<div class="player-lists-empty">暂无玩家</div>`;

    els.playerListContent.querySelectorAll(".player-item").forEach((el) => {
      el.addEventListener("click", () => {
        const name = el.dataset.name;
        const next = getSetting("Camera") === name ? "自由視角" : name;
        state.cameraTarget = next === "自由視角" ? "god" : el.dataset.id;
        setSetting("Camera", next);
        closeCameraLists();
        followTarget(true);
        updateCameraHero();
        renderCameraLists();
        renderPlayerList();
      });
    });
    updateCameraHero();
  }

  function heroById(heroId) {
    return DEMO.HEROES.find((h) => h.id === Number(heroId)) || DEMO.HEROES[0];
  }

  function updateCameraLabel() {
    const cam = getSetting("Camera") || "自由視角";
    if (els.cameraLabel) {
      els.cameraLabel.textContent = cam === "自由視角" ? "自由視角" : maskName(cam);
    }
  }

  function updateCameraHero() {
    const cam = getSetting("Camera") || "自由視角";
    let heroId = 0;
    if (cam !== "自由視角" && state.world) {
      const p = state.world.players.find((x) => x.name === cam)
        || state.world.players.find((x) => x.id === state.cameraTarget);
      heroId = p?.hero ?? 0;
    }
    const hero = heroById(heroId);
    if (els.cameraHero) {
      els.cameraHero.innerHTML = `<img src="${assetUrl(hero.avatar)}" alt="hero" />`;
      els.cameraHero.style.background = "";
    }
    updateCameraLabel();
  }

  function getCameraListItems() {
    const players = state.world?.players || [];
    let list = players.filter((p) => p.isTeammate && String(p.name || "").trim());
    if (!list.length) {
      list = players.filter((p) => (p.type === "player" || !p.type) && String(p.name || "").trim());
    }
    const seen = new Set();
    const items = [];
    list.forEach((p) => {
      if (seen.has(p.name)) return;
      seen.add(p.name);
      items.push({ id: p.id, name: p.name, heroId: p.hero, cam: p.name });
    });
    items.push({ id: "god", name: "自由視角", heroId: 0, cam: "自由視角" });
    return items;
  }

  function closeCameraLists() {
    state.showCameraLists = false;
    els.cameraLists?.classList.remove("show");
    els.cameraIcon?.classList.remove("open");
    els.cameraBtn?.classList.remove("isOpen");
  }

  function openCameraLists() {
    state.showCameraLists = true;
    renderCameraLists();
    els.cameraLists?.classList.add("show");
    els.cameraIcon?.classList.add("open");
    els.cameraBtn?.classList.add("isOpen");
  }

  function renderCameraLists() {
    if (!els.cameraLists || !state.world) return;
    const items = getCameraListItems();
    const cam = getSetting("Camera");
    els.cameraLists.innerHTML = items.map((it) => {
      const hero = heroById(it.heroId);
      const label = it.cam === "自由視角" ? "自由視角" : maskName(it.name);
      return `
      <div class="list ${cam === it.cam ? "active" : ""}" data-id="${it.id}" data-cam="${it.cam}">
        <div class="hero"><img src="${assetUrl(hero.avatar)}" alt="hero" /></div>
        <div class="name">${label}</div>
      </div>`;
    }).join("");
    els.cameraLists.querySelectorAll(".list").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        state.cameraTarget = el.dataset.id;
        setSetting("Camera", el.dataset.cam);
        closeCameraLists();
        followTarget(true);
        updateCameraHero();
        renderCameraLists();
        renderPlayerList();
      });
    });
  }

  const AUTO_FLOOR_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 7.5L12 3l8 4.5v9L12 21l-8-4.5v-9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M12 12L4 7.5M12 12l8-4.5M12 12v9" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;

  function findCameraPlayer() {
    const cam = getSetting("Camera");
    if (!cam || cam === "自由視角" || !state.world) return null;
    return state.world.players.find((x) => x.name === cam)
      || state.world.players.find((x) => x.id === state.cameraTarget)
      || null;
  }

  function getActiveFloor() {
    const cur = getSetting("floor");
    if (cur && cur !== "AUTO" && cur !== "ALL") return cur;
    const followed = findCameraPlayer();
    if (followed?.floor) return followed.floor;
    const me = state.world?.players?.find((x) => x.isMe);
    return me?.floor || null;
  }

  function renderFloors() {
    if (!state.world) return;
    const floors = (state.world.map.floors || []).filter((f) => f !== "ALL");
    const requested = getSetting("floor");
    const isAuto = requested === "AUTO" || requested === "ALL" || !requested;
    const activeFloor = getActiveFloor();
    state.lastActiveFloor = activeFloor;
    const buttons = floors.map((f) => {
      if (f === "AUTO") {
        const on = isAuto && !activeFloor;
        return `<button class="floor-button ${on ? "active" : ""}" data-floor="AUTO" type="button" title="自动切换">${AUTO_FLOOR_SVG}</button>`;
      }
      const on = (!isAuto && requested === f) || (isAuto && activeFloor === f);
      const title = isAuto && activeFloor === f ? `自动：${f}` : f;
      return `<button class="floor-button ${on ? "active" : ""}" data-floor="${f}" type="button" title="${title}">${f}</button>`;
    }).join("");
    els.floorSelector.innerHTML = buttons;
    els.floorSelector.querySelectorAll(".floor-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        setSetting("floor", btn.dataset.floor);
        renderFloors();
      });
    });
  }

  function followTarget(force = false) {
    if (getSetting("Camera") === "自由視角" || !getSetting("PlayerFollow")) return;
    if (!force && (state.dragging || Date.now() < state.followPausedUntil)) return;
    const p = findCameraPlayer();
    if (!p) return;
    if (!(p.x || p.y)) return;
    const rect = els.canvas.getBoundingClientRect();
    state.view.x = rect.width / 2 - p.x * state.view.scale;
    state.view.y = rect.height / 2 - p.y * state.view.scale;
    // AUTO 模式：目标楼层变化时刷新楼层条高亮；手动模式跟随切层
    const cur = getSetting("floor");
    if (p.floor && cur !== "AUTO" && cur !== "ALL" && cur !== p.floor) {
      state.settings.floor = p.floor;
      saveSettings();
      state.lastActiveFloor = p.floor;
      renderFloors();
    } else if (cur === "AUTO" || cur === "ALL") {
      const af = getActiveFloor();
      if (af !== state.lastActiveFloor) {
        state.lastActiveFloor = af;
        renderFloors();
      }
    }
  }

  function centerView() {
    const map = state.world.map;
    const rect = els.canvas.getBoundingClientRect();
    // 默认放大：比铺满屏幕再大一些，进入后地图更清晰
    const scale = Math.min(rect.width / map.w, rect.height / map.h) * 1.45;
    state.view.scale = scale;
    state.view.x = (rect.width - map.w * scale) / 2;
    state.view.y = (rect.height - map.h * scale) / 2;
  }

  /* ---------------- Canvas ---------------- */
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = els.canvas.getBoundingClientRect();
    els.canvas.width = Math.floor(width * dpr);
    els.canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function worldToScreen(x, y) {
    return {
      x: state.view.x + x * state.view.scale,
      y: state.view.y + y * state.view.scale
    };
  }

  function floorOk(floor) {
    const cur = getSetting("floor");
    if (cur === "ALL") return true;
    const active = getActiveFloor();
    if (!active) return true;
    return !floor || floor === active;
  }

  function maskName(name) {
    const s = String(name || "");
    if (!getSetting("makePlayerName") || s.length <= 2) return s;
    // 对齐 OOXX：首 + * + 尾
    return s[0] + "*" + s[s.length - 1];
  }

  function displayPlayerName(p) {
    return maskName(p.name);
  }

  function isCompactPlayer() {
    const mode = getSetting("PlayerRenderMode") || "auto";
    if (mode === "compact") return true;
    if (mode === "full") return false;
    // 对齐 OOXX：人数 ≥ 阈值时压缩
    const n = state.world?.players?.length || 0;
    return n >= Number(getSetting("PlayerCompactThreshold") || 80);
  }

  function drawLabel(x, y, text, color = "#fff", opts = {}) {
    if (!text) return;
    ctx.save();
    const fontSize = opts.fontSize || 11;
    ctx.font = `700 ${fontSize}px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(text);
    const tw = metrics.width;
    const th = fontSize + 6;
    if (opts.colorBg) {
      const padX = 6;
      const bg = opts.bgColor || "rgba(38,187,255,.55)";
      ctx.fillStyle = bg;
      const rx = x - tw / 2 - padX;
      const ry = y - th / 2;
      const rw = tw + padX * 2;
      const rr = th / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rx, ry, rw, th, rr);
      else {
        ctx.rect(rx, ry, rw, th);
      }
      ctx.fill();
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,.75)";
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** OOXX：装备条在中心上方（design 单位经 0.11 * PlayerSize） */
  function drawEquipBar(cx, cy, items, unit) {
    if (!items.length) return;
    const s = unit * 0.11;
    const icon = 8.5 * s;
    const gap = 2.6 * s;
    const pad = 3.6 * s;
    const barH = 12.5 * s;
    const fontPx = Math.max(7, 7.2 * s);

    ctx.save();
    ctx.font = `700 ${fontPx}px Arial,sans-serif`;
    const widths = items.map((it) => {
      const tw = it.text != null && it.text !== "" ? ctx.measureText(String(it.text)).width : 0;
      return icon + (tw ? 1.4 * s + tw : 0);
    });
    const inner = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    const barW = inner + pad * 2;
    const x0 = cx - barW / 2;
    const y0 = cy - 25.5 * s;

    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, barW, barH, 6.25 * s);
    else ctx.rect(x0, y0, barW, barH);
    ctx.fill();
    ctx.globalAlpha = 1;

    let x = x0 + pad;
    items.forEach((it, i) => {
      const img = getImgSync(it.icon);
      if (img) ctx.drawImage(img, x, y0 + 2 * s, icon, icon);
      if (it.text != null && it.text !== "") {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 2;
        ctx.fillText(String(it.text), x + icon + 1.4 * s, y0 + 2 * s + icon / 2);
        ctx.shadowBlur = 0;
      }
      x += widths[i] + gap;
    });
    ctx.restore();
  }

  /** OOXX：铭牌在中心下方，头像嵌在左侧 */
  function drawNamePlate(cx, cy, text, opts = {}) {
    if (!text && !opts.avatar) return;
    const unit = opts.unit || 14;
    const s = unit * 0.11;
    const label = text || "";
    ctx.save();
    ctx.font = `700 ${7 * s}px Arial,sans-serif`;
    const tw = label ? ctx.measureText(label).width : 0;
    const plateW = Math.max(28 * s, tw + 23 * s);
    const plateH = 14 * s;
    // group offsetY=2, inner y=15 → 中心下方
    const y = cy + (15 - 2) * s;
    const x = cx - plateW / 2;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = opts.colorBg ? (opts.bgColor || "rgba(38,187,255,0.85)") : "rgba(0,0,0,1)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, plateW, plateH, 30 * s);
    else ctx.rect(x, y, plateW, plateH);
    ctx.fill();
    ctx.globalAlpha = 1;

    const avSize = 10 * s;
    if (opts.avatar) {
      const av = getImgSync(opts.avatar);
      if (av) {
        const ax = x + 5 * s;
        const ay = y + 2 * s;
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax + avSize / 2, ay + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(av, ax, ay, avSize, avSize);
        ctx.restore();
      }
    }
    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 2 * s;
      ctx.shadowOffsetY = 2 * s;
      ctx.fillText(label, x + 18 * s, y + 3.5 * s);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.restore();
  }

  function drawWeaponIcons(cx, cy, weapons, unit, nameMode) {
    if (!weapons.length) return;
    const w = 3.072 * unit;
    const h = 192 * 0.006 * unit;
    const gap = Math.max(h * 0.35, 1.45 * unit * 0.15);
    weapons.forEach((weapon, i) => {
      const id = String(weapon.id || "").replace(/^A/, "");
      const y = cy + i * (h + gap);
      if (nameMode) {
        drawLabel(cx, y + h / 2, weapon.name || "未知武器", "#ffffffeb", {
          fontSize: Math.max(9, unit * 0.4)
        });
        return;
      }
      const img = getImgSync(`assets/Weapon/${id}.png`);
      if (!img) return;
      ctx.globalAlpha = weapon.type === "secondary" ? 0.65 : 0.7;
      ctx.drawImage(img, cx - w / 2, y, w, h);
      ctx.globalAlpha = 1;
    });
  }

  function drawMapTiles() {
    const mapId = getSetting("mapId");
    const cfg = ASSETS.mapsConfig?.[mapId];
    const map = state.world.map;
    const tileSize = map.tileSize || 1024;
    const cols = map.cols || 4;

    if (!cfg) {
      const o = worldToScreen(0, 0);
      ctx.fillStyle = "#151a20";
      ctx.fillRect(o.x, o.y, map.w * state.view.scale, map.h * state.view.scale);
      return;
    }

    // base tiles 1..16 in row-major order
    cfg.tiles.forEach((t) => {
      const idx = t.index; // 1-based
      const col = (idx - 1) % cols;
      const row = Math.floor((idx - 1) / cols);
      const img = getImgSync(t.file);
      const dx = state.view.x + col * tileSize * state.view.scale;
      const dy = state.view.y + row * tileSize * state.view.scale;
      const dw = tileSize * state.view.scale;
      const dh = tileSize * state.view.scale;
      if (img) ctx.drawImage(img, dx, dy, dw, dh);
      else {
        ctx.fillStyle = "#1a222b";
        ctx.fillRect(dx, dy, dw, dh);
      }
    });

    // floor overlays（AUTO 跟当前活动楼层）
    const floor = getActiveFloor();
    if (floor && cfg.floors?.[floor]) {
      cfg.floors[floor].forEach((t) => {
        const idx = t.index;
        const col = (idx - 1) % cols;
        const row = Math.floor((idx - 1) / cols);
        const img = getImgSync(t.file);
        if (!img) return;
        const dx = state.view.x + col * tileSize * state.view.scale;
        const dy = state.view.y + row * tileSize * state.view.scale;
        // overlays may be 2048; stretch to tile cell
        ctx.drawImage(img, dx, dy, tileSize * state.view.scale, tileSize * state.view.scale);
      });
    }
  }

  function drawMap() {
    const { width, height } = els.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    drawMapTiles();

    if (getSetting("MapAreaNameVisible")) {
      ctx.save();
      ctx.globalAlpha = getSetting("MapAreaNameOpacity") / 100;
      ctx.fillStyle = getSetting("MapAreaNameColor") || "#cdcdcd";
      // OOXX：fontSize = MapAreaNameSize/3，随地图缩放
      const fs = Math.max(8, (Number(getSetting("MapAreaNameSize") || 40) / 3) * Math.max(0.35, state.view.scale) / 0.35);
      ctx.font = `700 ${fs}px ALI,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      state.world.areas.forEach((a) => {
        const p = worldToScreen(a.x, a.y);
        ctx.shadowColor = "rgb(0,0,0)";
        ctx.shadowBlur = Math.max(2, fs * 0.15);
        ctx.fillText(a.name, p.x, p.y);
      });
      ctx.restore();
    }

    drawPoints();
    drawContainers();
    drawItems();
    drawBoxes();
    drawActors();
  }

  function markerUnit(key, fallback = 12) {
    return Math.max(6, Number(getSetting(key) || fallback));
  }

  function drawRegularPoly(cx, cy, sides, radius, fill, rotationDeg = 0) {
    const rot = (rotationDeg * Math.PI) / 180;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot - Math.PI / 2 + (i * Math.PI * 2) / sides;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function formatMapMoney(n) {
    const v = parseInt(n, 10) || 0;
    if (v >= 10000) return `$${(v / 10000).toFixed(1)}W`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${v}`;
  }

  const GRADE_COLORS = {
    0: "#ebe9e9",
    1: "#ebe9e9",
    2: "#2aca96",
    3: "#589fdc",
    4: "#9e78db",
    5: "#d0824e",
    6: "#da5758"
  };

  /** OOXX Tag+Label：pointer down=在标记上方，up=在下方 */
  function drawMapTip(cx, cy, text, opts = {}) {
    if (!text) return;
    const U = opts.unit || 12;
    const fontSize = Math.max(8, 0.8 * U);
    const pad = Math.max(3, 0.4 * U);
    const pw = 0.6 * U;
    const ph = 0.3 * U;
    const pointer = opts.pointer || "down";
    const tipY = cy + (opts.y ?? (pointer === "down" ? -0.8 : 0.6)) * U;

    ctx.save();
    ctx.font = `700 ${fontSize}px Arial,sans-serif`;
    const tw = ctx.measureText(text).width;
    const boxW = tw + pad * 2;
    const boxH = fontSize + pad;
    const boxX = cx - boxW / 2;
    const boxY = pointer === "down" ? tipY - ph - boxH : tipY + ph;
    const rr = Math.max(2, 0.2 * U);
    const bg = opts.bg || "rgba(0,0,0,0.7)";

    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, rr);
    else ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();

    ctx.beginPath();
    if (pointer === "down") {
      ctx.moveTo(cx - pw / 2, tipY - ph);
      ctx.lineTo(cx, tipY);
      ctx.lineTo(cx + pw / 2, tipY - ph);
    } else {
      ctx.moveTo(cx - pw / 2, tipY + ph);
      ctx.lineTo(cx, tipY);
      ctx.lineTo(cx + pw / 2, tipY + ph);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = opts.color || "#fff";
    ctx.globalAlpha = opts.textOpacity ?? 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, boxY + boxH / 2);
    ctx.restore();
  }

  function drawPoints() {
    state.world.points.forEach((p) => {
      if (!floorOk(p.floor)) return;
      const s = worldToScreen(p.x, p.y);

      if (p.type === "exit" && getSetting("ExitPointVisible")) {
        const U = markerUnit("ExitPointSize");
        ctx.globalAlpha = getSetting("ExitPointOpacity") / 100;
        const img = getImgSync(DEMO.ICONS.playerExit) || getImgSync(DEMO.ICONS.exit);
        const size = 2 * U;
        if (img) ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
        else {
          ctx.fillStyle = "#0ff595";
          ctx.beginPath();
          ctx.arc(s.x, s.y, U * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (p.type === "switch" && getSetting("ExitSwitchVisible")) {
        const U = markerUnit("ExitSwitchSize");
        ctx.globalAlpha = getSetting("ExitSwitchOpacity") / 100;
        const img = getImgSync(DEMO.ICONS.exit);
        const size = 2 * U;
        if (img) ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
        else {
          ctx.fillStyle = "#ffb700";
          ctx.fillRect(s.x - U, s.y - U, size, size);
        }
      }

      if (p.type === "pwdroom" && getSetting("PasswordRoomVisible")) {
        const U = markerUnit("PasswordRoomSize");
        ctx.globalAlpha = getSetting("PasswordRoomOpacity") / 100;
        drawRegularPoly(s.x, s.y, 5, 0.5 * U, "rgba(0,0,0,0.5)");
        drawRegularPoly(s.x, s.y, 5, 0.3 * U, "rgba(255,255,255,0.8)");
        let label = `#${p.name || ""}`;
        if (getSetting("PasswordRoomFloorVisible") && p.floor) label += ` / ${p.floor}`;
        else if (getSetting("PasswordRoomHeight")) label += " ↑";
        drawMapTip(s.x, s.y, label, {
          unit: U,
          pointer: "up",
          y: 0.6,
          color: "rgba(255,255,255,0.8)",
          bg: "rgba(0,0,0,0.5)",
          textOpacity: 0.8
        });
      }

      if (p.type === "keyroom" && getSetting("KeyRoomVisible")) {
        const U = markerUnit("KeyRoomSize");
        const grade = Number(p.level) || Number(p.grade) || 4;
        const color = GRADE_COLORS[grade] || GRADE_COLORS[4];
        ctx.globalAlpha = getSetting("KeyRoomOpacity") / 100;
        drawRegularPoly(s.x, s.y, 5, 0.5 * U, "rgba(0,0,0,0.5)");
        drawRegularPoly(s.x, s.y, 5, 0.3 * U, color);
        let label = p.name || "钥匙房";
        if (getSetting("KeyRoomFloorVisible") && p.floor) label += ` / ${p.floor}`;
        else if (getSetting("KeyRoomHeight")) label += " ↑";
        drawMapTip(s.x, s.y, label, {
          unit: U,
          pointer: "up",
          y: 0.6,
          color: "rgba(255,255,255,0.8)",
          bg: "rgba(0,0,0,0.5)",
          textOpacity: 0.8
        });
      }

      ctx.globalAlpha = 1;
    });
  }

  function drawContainers() {
    if (!getSetting("ContainersVisible")) return;
    const checked = new Set(getSetting("checkedContainers") || []);
    const catalog = getContainerCatalog();
    state.world.containers.forEach((c) => {
      if (!floorOk(c.floor)) return;
      if (!checked.has(c.type)) return;
      const s = worldToScreen(c.x, c.y);
      const U = markerUnit("ContainersSize");
      const meta = catalog.find((x) => x.id === c.type);
      const icon = meta?.icon3d || meta?.icon || c.icon;
      const img = icon ? getImgSync(icon) : null;
      const size = U * 1.15;
      if (img) {
        ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
      } else {
        // 无图时回退 OOXX 菱形
        drawRegularPoly(s.x, s.y, 4, 0.5 * U, "rgba(0,0,0,0.5)");
        drawRegularPoly(s.x, s.y, 4, 0.3 * U, "rgba(255,255,255,0.8)");
      }
      const parts = [];
      if (getSetting("ContainersNameVisible") && c.name) parts.push(c.name);
      if (getSetting("ContainersPwdVisible") && c.pwd) parts.push(`#${c.pwd}`);
      if (getSetting("ContainersFloorVisible") && c.floor) parts.push(String(c.floor));
      else if (getSetting("ContainersHeightVisible")) parts.push("↑");
      if (parts.length) {
        drawMapTip(s.x, s.y, parts.join(" / "), {
          unit: U,
          pointer: "up",
          y: 0.75,
          color: "rgba(255,255,255,0.8)",
          bg: "rgba(0,0,0,0.5)",
          textOpacity: 0.8
        });
      }
    });
  }

  function drawItems() {
    if (!getSetting("ItemsVisible")) return;
    const catalog = state.world.itemsCatalog || [];
    const checked = getCheckedItemSet(catalog);
    const me = state.world.players.find((p) => p.isMe);

    state.world.items.forEach((it) => {
      if (!floorOk(it.floor)) return;
      if (it.money < getSetting("ItemMoneyFilter")) return;
      if (it.level < getSetting("ItemLevelFilter")) return;
      const meta = catalog.find((x) => x.id === it.itemId || x.id === normalizeItemId(it.itemId));
      if (!meta && !getSetting("ItemUndefinedVisible")) return;
      if (!checked.has(it.itemId) && !checked.has(normalizeItemId(it.itemId))) return;

      const s = worldToScreen(it.x, it.y);
      const U = markerUnit("ItemSize");
      const color = GRADE_COLORS[it.level] || GRADE_COLORS[1];
      const high = getSetting("ItemHighValueVisible") && it.level >= 5;
      const size = U * 1.25;
      const img = getImgSync(it.icon || meta?.icon);

      if (high) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = Math.max(8, U * 0.85);
      }

      if (img) {
        ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
      } else {
        // 无图时回退 OOXX 三角
        drawRegularPoly(s.x, s.y, 3, 0.6 * U, "rgba(0,0,0,0.5)");
        drawRegularPoly(s.x, s.y, 3, 0.3 * U, color);
      }

      if (high) {
        ctx.restore();
        // 高价值外圈提示
        ctx.save();
        ctx.strokeStyle = "#ff4d4f";
        ctx.lineWidth = Math.max(1, U * 0.06);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const parts = [];
      if (getSetting("ItemNameVisible")) parts.push(meta?.name || it.itemId);
      if (getSetting("ItemMoneyVisible")) parts.push(formatMapMoney(it.money));
      if (getSetting("ItemFloorVisible") && it.floor) parts.push(String(it.floor));
      else if (getSetting("ItemHeightVisible")) parts.push("↑");
      if (getSetting("ItemDistanceVisible") && me) {
        parts.push(`${Math.round(Math.hypot(it.x - me.x, it.y - me.y) / 20)}m`);
      }
      if (parts.length) {
        drawMapTip(s.x, s.y, parts.join(" / "), {
          unit: U,
          pointer: "down",
          y: -0.95,
          color: high ? "#ff7a7c" : color,
          bg: high ? "rgba(120,0,0,0.85)" : "rgba(0,0,0,0.7)"
        });
      }
    });
  }

  function hexToRgba(hex, a) {
    const h = String(hex || "#26bbff").replace("#", "");
    if (h.length !== 6) return `rgba(38,187,255,${a})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawBoxes() {
    if (!getSetting("DeadBoxVisible")) return;
    state.world.boxes.forEach((b) => {
      if (!floorOk(b.floor)) return;
      if (getSetting("HideOpendBox") && b.opened) return;
      if (b.owner === "player" && !getSetting("PlayerDeadBox")) return;
      if (b.owner === "bot" && !getSetting("BotDeadBox")) return;
      const s = worldToScreen(b.x, b.y);
      const U = markerUnit("DeadBoxSize");
      ctx.globalAlpha = getSetting("DeadBoxOpacity") / 100;
      const size = U * 1.1;
      const img = getImgSync(DEMO.ICONS.bag);
      if (img) {
        ctx.save();
        if (b.opened) ctx.filter = "grayscale(1) brightness(.7)";
        else ctx.filter = "hue-rotate(-30deg) saturate(1.4)";
        ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
        ctx.filter = "none";
        ctx.restore();
      } else {
        const fill = b.opened ? "rgba(120,120,120,0.8)" : "rgba(255,141,143,0.8)";
        drawRegularPoly(s.x, s.y, 4, 0.6 * U, "rgba(0,0,0,0.5)", -45);
        drawRegularPoly(s.x, s.y, 4, 0.3 * U, fill, -45);
      }
      let label = formatDeadBoxLabel(b);
      if (getSetting("DeadBoxFloorVisible") && b.floor) label += ` / ${b.floor}`;
      else if (getSetting("DeadBoxHeight")) label += " ↑";
      drawMapTip(s.x, s.y, label, {
        unit: U,
        pointer: "down",
        y: -0.9,
        color: "rgba(255,141,143,0.9)",
        bg: "rgba(0,0,0,0.6)"
      });
      ctx.globalAlpha = 1;
    });
  }

  function drawActor(p, opts) {
    const s = worldToScreen(p.x, p.y);
    // OOXX Group.scale ≈ PlayerSize/12（以 12 为 1x 基准）
    const U = Math.max(8, Number(opts.size) || 14);
    const g = U / 12;
    const alpha = (opts.opacity ?? 100) / 100;
    const dir = Number(p.dir) || 0;
    const compact = !!opts.compact;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 线：本地沿 -Y，再旋转 dir+90
    const lineAngle = (dir + 90) * Math.PI / 180;
    const drawRay = (lenLocal, offsetY, width, color) => {
      const len = lenLocal * g;
      const ox = Math.sin(lineAngle) * offsetY * g;
      const oy = -Math.cos(lineAngle) * offsetY * g;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, width * g);
      ctx.beginPath();
      ctx.moveTo(s.x + ox, s.y + oy);
      ctx.lineTo(
        s.x + ox + Math.sin(lineAngle) * len,
        s.y + oy - Math.cos(lineAngle) * len
      );
      ctx.stroke();
    };

    // OOXX：辅助线 / 朝向线 / 指示器 三选一
    if (compact) {
      drawRay(1.4, 0.1, 0.16, "rgba(255,255,255,0.78)");
    } else if (opts.assist) {
      drawRay(36, 1.3, 0.1, "rgba(255,255,255,0.8)");
    } else if (opts.aim) {
      const aimLen = 0.1 * Number(getSetting("PlayerAimLineLength") || 10) * 12;
      drawRay(aimLen, 0.7, 0.15, "rgba(255,255,255,0.8)");
    } else {
      const ind = opts.isMe ? getImgSync(DEMO.ICONS.indicator) : getImgSync(DEMO.ICONS.indicatorOther);
      if (ind) {
        const w = 16.5 * g;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(dir * Math.PI / 180);
        ctx.globalAlpha = alpha * (opts.isMe ? 1 : 0.8);
        ctx.drawImage(ind, -w / 2, -w / 2, w, w);
        ctx.restore();
        ctx.globalAlpha = alpha;
      }
    }

    // 中心色点 radius 0.8（同组坐标，放大到与指示器同视觉量级可读）
    const r = Math.max(4.5, 0.8 * g * 10);
    ctx.fillStyle = opts.color || "#26bbff";
    ctx.globalAlpha = alpha * (opts.isTeammate ? 0.8 : 1);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;

    const hp = Number(opts.hp);
    if (Number.isFinite(hp) && hp < 100) {
      const outer = r * (0.65 / 0.8);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, outer, Math.PI / 2, Math.PI / 2 + (hp / 100) * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = Number(opts.status) === 0 ? "rgba(0,0,0,0.45)" : "rgb(255,1,1)";
      ctx.globalAlpha = alpha * 0.9;
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = alpha;
    }

    if (opts.isTeammate) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(2, r * 0.375), 0, Math.PI * 2);
      ctx.fill();
    } else if (opts.teamId != null && opts.teamId !== "" && !compact) {
      ctx.save();
      ctx.font = `700 ${Math.max(8, 8.5 * g)}px Arial,sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 2;
      ctx.fillText(String(opts.teamId), s.x, s.y - 6 * g);
      ctx.restore();
    }

    if (!compact) {
      if (opts.equip?.length) drawEquipBar(s.x, s.y, opts.equip, U);
      if (opts.label || opts.avatar) {
        drawNamePlate(s.x, s.y, opts.label || "", {
          avatar: opts.avatar,
          colorBg: opts.colorBg,
          bgColor: opts.bgColor,
          unit: U
        });
      }
      if (opts.weapons?.length) {
        // 铭牌底部约 (15-2+14)*0.11*U，武器紧挨其下
        const plateBottom = (15 - 2 + 14) * (U * 0.11);
        drawWeaponIcons(s.x, s.y + plateBottom + 2, opts.weapons, U * 0.7, !!opts.weaponNameMode);
      }
    } else if (opts.label) {
      drawLabel(s.x, s.y + 10 * g, opts.label, "#fff", { fontSize: Math.max(9, 7 * g) });
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function displayBotName(name) {
    // 对齐 OOXX：铭牌固定「AI / 名称」，去掉名称里重复的 AI
    let n = String(name || "").trim();
    n = n.replace(/^AI[\s/]*/i, "").replace(/[\s]*AI$/i, "").trim();
    return n;
  }

  function formatBotLabel(bot) {
    const name = displayBotName(bot.name);
    return name ? `AI / ${name}` : "AI";
  }

  function formatDeadBoxLabel(box) {
    // 对齐 OOXX：按归属固定文案，不使用自定义 name 字段
    return box.owner === "bot" ? "人机盒子" : "玩家盒子";
  }

  function drawActors() {
    state.world.bots.forEach((b) => {
      if (!floorOk(b.floor)) return;
      if (b.type === "boss") {
        if (!getSetting("BossVisible")) return;
        let label = "";
        if (getSetting("BossInfo")) {
          label = b.name || "BOSS";
          if (getSetting("BossHeight")) label += " ↑";
        } else if (getSetting("BossHeight")) {
          label = "↑";
        }
        drawActor(b, {
          size: getSetting("BossSize"),
          opacity: getSetting("BossOpacity"),
          color: "#ff4545",
          label,
          colorBg: getSetting("BossColorBg"),
          bgColor: "rgba(255,69,69,.55)",
          hp: b.hp,
          status: b.status
        });
        return;
      }
      if (!getSetting("BotVisible")) return;
      let label = "";
      if (getSetting("BotInfo")) {
        label = formatBotLabel(b);
        if (getSetting("BotHeight") && b.floor) label += ` / ${b.floor}`;
        else if (getSetting("BotHeight")) label += " ↑";
      } else if (getSetting("BotHeight")) {
        label = "↑";
      }
      drawActor(b, {
        size: getSetting("BotSize"),
        opacity: getSetting("BotOpacity"),
        color: "#ffb700",
        label,
        colorBg: getSetting("BotColorBg"),
        bgColor: "rgba(255,183,0,.5)",
        hp: b.hp,
        status: b.status
      });
    });

    if (!getSetting("showPlayers")) return;
    state.world.players.forEach((p) => {
      if (!floorOk(p.floor)) return;
      if (getSetting("hideTeammates") && p.isTeammate && !p.isMe) return;
      const hero = DEMO.HEROES.find((h) => h.id === p.hero) || DEMO.HEROES[0];
      const color = p.isMe
        ? "#26bbff"
        : (p.isTeammate && getSetting("teammateSameColor") ? "#4bed69" : teamColor(p.team));

      const hideDetails = getSetting("hideTeamDetails") && p.isTeammate && !p.isMe;
      const compact = isCompactPlayer() || hideDetails;

      // 对齐 OOXX：英雄 / 昵称
      let label = "";
      const nick = getSetting("showPlayerName") ? displayPlayerName(p) : "";
      if (!compact && getSetting("showPlayerHeroName")) {
        label = nick ? `${hero.name} / ${nick}` : hero.name;
      } else {
        label = nick;
      }
      if (!compact && getSetting("PlayerDistance") && !p.isMe) {
        label = label ? `${label} ${distToMe(p)}m` : `${distToMe(p)}m`;
      }
      if (!compact && getSetting("PlayerHeight")) {
        label = label ? `${label} / ${p.floor}` : String(p.floor || "");
      }

      const equip = [];
      if (!compact && getSetting("showPlayerInfo")) {
        if (getSetting("showPlayerHelmet")) {
          const hLv = equipLevel(p.helmet);
          const aLv = equipLevel(p.armor);
          if (hLv > 0) equip.push({ icon: DEMO.ICONS.helmet, text: equipDurability(p.helmet) });
          if (aLv > 0) equip.push({ icon: DEMO.ICONS.armor, text: equipDurability(p.armor) });
        }
        if (getSetting("showPlayerChestRigBag")) {
          const cLv = equipLevel(p.chest ?? p.chestRig);
          const bLv = equipLevel(p.bag);
          if (cLv > 0) equip.push({ icon: DEMO.ICONS.chest, text: cLv });
          if (bLv > 0) equip.push({ icon: DEMO.ICONS.bag, text: bLv });
        }
      }

      const weapons = (!compact && !hideDetails && getSetting("showPlayerWeapon"))
        ? playerWeapons(p)
        : [];

      drawActor(p, {
        size: getSetting("PlayerSize"),
        color,
        isMe: p.isMe,
        isTeammate: p.isTeammate,
        teamId: p.team,
        avatar: hideDetails ? null : hero.avatar,
        assist: getSetting("showAssistLine") && (p.isMe || getSetting("Camera") === p.name),
        aim: getSetting("PlayerAimLine") && !p.isMe && !hideDetails,
        label,
        colorBg: getSetting("colorBg"),
        bgColor: hexToRgba(color, 0.85),
        equip,
        weapons,
        weaponNameMode: getSetting("showPlayerWeaponName"),
        compact,
        hp: p.hp,
        status: p.status
      });
    });
  }

  function loop(ts) {
    if (!state.world) {
      requestAnimationFrame(loop);
      return;
    }
    if (getSetting("Camera") !== "自由視角" && getSetting("PlayerFollow")) followTarget();
    state.world.players.forEach((p, i) => {
      if (p.isMe) return;
      p.dir = (p.dir + 0.04 * (i + 1)) % 360;
    });
    drawMap();
    if (ts - (state.lastItemBoxAt || 0) >= 500) {
      state.lastItemBoxAt = ts;
      renderItemBox();
    }
    state.frames++;
    if (ts - state.lastFpsAt >= 1000) {
      state.fps = state.frames;
      state.frames = 0;
      state.lastFpsAt = ts;
      els.fpsLabel.textContent = `${state.fps} FPS`;
    }
    requestAnimationFrame(loop);
  }

  function initPointer() {
    const c = els.canvas;
    c.addEventListener("pointerdown", (e) => {
      state.dragging = true;
      state.followPausedUntil = Number.POSITIVE_INFINITY;
      state.lastPtr = { x: e.clientX, y: e.clientY };
      c.classList.add("dragging");
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (!state.dragging || !state.lastPtr) return;
      state.view.x += e.clientX - state.lastPtr.x;
      state.view.y += e.clientY - state.lastPtr.y;
      state.lastPtr = { x: e.clientX, y: e.clientY };
    });
    const end = () => {
      if (!state.dragging) return;
      state.dragging = false;
      state.lastPtr = null;
      // 对齐 OOXX：松手后约 2s 恢复視角跟随
      state.followPausedUntil = Date.now() + 2000;
      c.classList.remove("dragging");
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      state.followPausedUntil = Date.now() + 2000;
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const before = {
        x: (mx - state.view.x) / state.view.scale,
        y: (my - state.view.y) / state.view.scale
      };
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      state.view.scale = Math.min(16, Math.max(0.08, state.view.scale * factor));
      state.view.x = mx - before.x * state.view.scale;
      state.view.y = my - before.y * state.view.scale;
    }, { passive: false });
  }

  async function bootApp() {
    await rebuildWorld();
    resizeCanvas();
    centerView();
    renderFloors();
    renderPlayerList();
    renderCameraLists();
    renderUserCards();
    renderItemPanel();
    renderContainerPanel();
    renderPointCards();
    renderItemBox();
    els.cameraLabel.textContent = getSetting("Camera");
    updateCameraHero();
    els.playerLists.classList.toggle("hidden", !getSetting("showPlayerList"));
    syncPlayerListVisibility();
    initPointer();
    // fake ping jitter for UI parity
    setInterval(() => {
      const ping = 24 + Math.floor(Math.random() * 18);
      const el = document.getElementById("pingBadge");
      if (!el) return;
      el.textContent = ping + "ms";
      el.className = "value " + (ping < 50 ? "ping-good" : ping < 80 ? "ping-warning" : "ping-danger");
    }, 1500);
    requestAnimationFrame(loop);
  }

  function bindChrome() {
    els.settingsBtn.addEventListener("click", openSettings);
    els.settingClose.addEventListener("click", closeSettings);
    els.settingMark.addEventListener("click", closeSettings);

    els.topMenus.addEventListener("click", (e) => {
      const item = e.target.closest(".setting-header-menu-item");
      if (!item) return;
      showPanel(item.dataset.group);
    });

    state.settingsGroup = "user";

    els.cameraBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.showCameraLists) closeCameraLists();
      else openCameraLists();
    });
    els.cameraLists?.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", (e) => {
      if (!state.showCameraLists) return;
      if (e.target.closest?.(".camera-button")) return;
      closeCameraLists();
    });

    els.togglePlayerList.addEventListener("click", () => {
      setSetting("showPlayerList", !getSetting("showPlayerList"));
    });

    els.resetSettings?.addEventListener("click", async () => {
      localStorage.removeItem(STORE_KEY);
      state.settings = { ...DEMO.DEFAULT_SETTINGS };
      await rebuildWorld();
      centerView();
      renderFloors();
      renderPlayerList();
      showPanel("about");
      alert("设置已重置");
    });

    window.addEventListener("resize", () => {
      resizeCanvas();
      if (!state.settingOpen) return;
      if (state.settingsGroup === "user") renderUserCards();
      if (state.settingsGroup === "points") renderPointCards();
    });
  }

  // start
  els.pwdGate.classList.add("hidden");
  bindChrome();
  bootAssets();
})();
