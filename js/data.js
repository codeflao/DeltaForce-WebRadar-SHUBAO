window.RADAR_DEMO = {
  DEMO_PWD: "1111",
  MAPS: [
    { id: "Dam_Iris", name: "零号大坝", floors: ["AUTO", "B1", "1F", "2F"] },
    { id: "Forrest", name: "长弓溪谷", floors: ["AUTO", "1F", "2F"] },
    { id: "Brakkesh", name: "巴克什", floors: ["AUTO", "B1", "1F", "2F"] },
    { id: "Spacecenter", name: "航天基地", floors: ["AUTO"] },
    { id: "Tide", name: "潮汐监狱", floors: ["AUTO", "1F", "2F", "3F", "4F"] },
    { id: "AZ-5", name: "AZ-5", floors: ["AUTO"] }
  ],
  HEROES: [
    { id: 0, gameId: 0, name: "未知", avatar: "assets/HeroAvatar/0.png", color: "#888" },
    { id: 1, gameId: 88000000025, name: "威龙", avatar: "assets/HeroAvatar/88000000025.png", color: "#26bbff" },
    { id: 2, gameId: 88000000027, name: "蜂医", avatar: "assets/HeroAvatar/88000000027.png", color: "#63c79a" },
    { id: 3, gameId: 88000000028, name: "露娜", avatar: "assets/HeroAvatar/88000000028.png", color: "#9775d9" },
    { id: 4, gameId: 88000000026, name: "骇爪", avatar: "assets/HeroAvatar/88000000026.png", color: "#c58557" },
    { id: 5, gameId: 88000000030, name: "红狼", avatar: "assets/HeroAvatar/88000000030.png", color: "#ff6b6b" },
    { id: 6, gameId: 88000000035, name: "乌鲁鲁", avatar: "assets/HeroAvatar/88000000035.png", color: "#ffd166" },
    { id: 7, gameId: 88000000029, name: "牧羊人", avatar: "assets/HeroAvatar/88000000029.png", color: "#06d6a0" },
    { id: 8, gameId: 88000000036, name: "蛊", avatar: "assets/HeroAvatar/88000000036.png", color: "#4cc9f0" },
    { id: 9, gameId: 88000000037, name: "深蓝", avatar: "assets/HeroAvatar/88000000037.png", color: "#f72585" },
    { id: 10, gameId: 88000000038, name: "无名", avatar: "assets/HeroAvatar/88000000038.png", color: "#b5179e" },
    { id: 11, gameId: 88000000039, name: "疾风", avatar: "assets/HeroAvatar/88000000039.png", color: "#7209b7" },
    { id: 12, gameId: 88000000040, name: "银翼", avatar: "assets/HeroAvatar/88000000040.png", color: "#560bad" },
    { id: 13, gameId: 88000000041, name: "比特", avatar: "assets/HeroAvatar/88000000041.png", color: "#480ca8" },
    { id: 14, gameId: 88000000045, name: "蝶", avatar: "assets/HeroAvatar/88000000045.png", color: "#3a0ca3" },
    { id: 15, gameId: 88000000046, name: "回响", avatar: "assets/HeroAvatar/88000000046.png", color: "#4361ee" },
    { id: 16, gameId: 88000000047, name: "液氮", avatar: "assets/HeroAvatar/88000000047.png", color: "#4895ef" }
  ],
  ICONS: {
    armor: "assets/Icon/Armor.png",
    helmet: "assets/Icon/Helmet.png",
    bag: "assets/Icon/Bag.png",
    chest: "assets/Icon/ChestRig.png",
    exit: "assets/Icon/Exit.png",
    indicator: "assets/Icon/Indicator.png",
    indicatorOther: "assets/Icon/IndicatorNotMe.png",
    playerExit: "assets/Icon/PlayerExit.png",
    check: "assets/media/e98fc6fe0f6e09903bf1.png"
  },
  DEFAULT_SETTINGS: {
    Camera: "自由視角",
    mapId: "Dam_Iris",
    floor: "AUTO",
    PlayerFollow: true,
    showPlayers: true,
    colorBg: true,
    showPlayerWeapon: true,
    showPlayerWeaponName: false,
    makePlayerName: true,
    showPlayerHeroName: true,
    showAssistLine: true,
    showPlayerInfo: true,
    showPlayerName: true,
    showPlayerHelmet: true,
    showPlayerChestRigBag: true,
    showPlayerList: true,
    PlayerSize: 14,
    hideTeamDetails: false,
    hideTeammates: false,
    teammateSameColor: false,
    PlayerAimLine: false,
    PlayerAimLineLength: 10,
    PlayerHeight: true,
    PlayerDistance: true,
    PlayerRenderMode: "auto",
    PlayerCompactThreshold: 80,
    PlayerDeadBox: true,
    BotVisible: true,
    BotInfo: true,
    BotDeadBox: true,
    BotSize: 14,
    BotOpacity: 70,
    BotHeight: true,
    BotColorBg: true,
    BossVisible: true,
    BossInfo: true,
    BossSize: 16,
    BossOpacity: 100,
    BossHeight: true,
    BossColorBg: true,
    ItemsVisible: true,
    ItemNameVisible: true,
    ItemMoneyVisible: true,
    ItemHeightVisible: true,
    ItemFloorVisible: true,
    ItemDistanceVisible: true,
    ItemHighValueVisible: true,
    ItemHighValueInfoVisible: true,
    ItemUndefinedVisible: false,
    showItemList: true,
    ItemListSize: 12,
    ItemSize: 12,
    ItemMoneyFilter: 0,
    ItemLevelFilter: 4,
    DeadBoxVisible: true,
    DeadBoxHeight: true,
    DeadBoxFloorVisible: true,
    DeadBoxOpacity: 100,
    DeadBoxSize: 12,
    HideOpendBox: true,
    ContainersVisible: true,
    ContainersNameVisible: true,
    ContainersPwdVisible: true,
    ContainersHeightVisible: true,
    ContainersFloorVisible: true,
    ContainersSize: 12,
    PasswordRoomVisible: true,
    PasswordRoomHeight: true,
    PasswordRoomFloorVisible: true,
    PasswordRoomOpacity: 100,
    PasswordRoomSize: 12,
    KeyRoomVisible: true,
    KeyRoomHeight: true,
    KeyRoomFloorVisible: true,
    KeyRoomOpacity: 100,
    KeyRoomSize: 12,
    ExitPointVisible: true,
    ExitPointOpacity: 100,
    ExitPointSize: 12,
    ExitSwitchVisible: true,
    ExitSwitchOpacity: 100,
    ExitSwitchSize: 12,
    MapAreaNameVisible: true,
    MapAreaNameOpacity: 80,
    MapAreaNameSize: 40,
    MapAreaNameColor: "#cdcdcd",
    checkedItems: [],
    checkedContainers: []
  },
  get CONTAINERS() {
    return window.SAMPLE_CONTAINERS || [];
  }
};

window.RADAR_DEMO.buildWorld = function (mapId, assets) {
  const mapMeta = this.MAPS.find((m) => m.id === mapId) || this.MAPS[0];
  const cfg = assets?.mapsConfig?.[mapId] || { width: 4096, height: 4096, tileSize: 1024, cols: 4, rows: 4 };
  const W = cfg.width || 4096;
  const H = cfg.height || 4096;

  const areas = (window.MAP_AREAS && window.MAP_AREAS[mapId])
    ? window.MAP_AREAS[mapId].map((a) => ({ ...a }))
    : [
      { name: "行政辖区", x: W * 0.54, y: H * 0.27 },
      { name: "水泥厂", x: W * 0.54, y: H * 0.40 },
      { name: "游客中心", x: W * 0.48, y: H * 0.52 }
    ];

  const sample = assets?.sampleItems || [];
  const itemsCatalog = sample.length
    ? sample.map((it) => ({
      id: it.id,
      name: it.name,
      money: it.money,
      level: it.level,
      category: it.category || "其他",
      icon: it.icon.startsWith("assets/") || /^https?:/i.test(it.icon)
        ? it.icon
        : `assets/${it.icon.replace(/^\.\//, "")}`
    }))
    : [
      { id: "demo1", name: "演示物资", money: 100000, level: 6, category: "其他", icon: "assets/Icon/Bag.png" }
    ];

  this.ITEMS = itemsCatalog;

  const containersCatalog = (assets?.sampleContainers || window.SAMPLE_CONTAINERS || []).map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level || 1,
    icon: c.icon,
    icon3d: c.icon3d || c.icon
  }));
  this.CONTAINERS = containersCatalog;

  const players = [
    { id: "me", name: "演示员", hero: 1, team: 1, playerType: 1, x: W * 0.48, y: H * 0.52, dir: 40, hp: 92, status: 0, isMe: true, isTeammate: true, helmet: { level: 5, durability: 86 }, armor: { level: 5, durability: 74 }, chest: 4, bag: 4, weaponId: "18010000001", weapon2Id: "18070000010", floor: "1F", type: "player" },
    { id: "t1", name: "队友-阿凯", hero: 2, team: 1, playerType: 1, x: W * 0.44, y: H * 0.56, dir: 120, hp: 78, status: 0, isMe: false, isTeammate: true, helmet: { level: 4, durability: 62 }, armor: { level: 5, durability: 55 }, chest: 3, bag: 3, weaponId: "18010000006", weapon2Id: "18070000005", floor: "1F", type: "player" },
    { id: "e1", name: "Shadow", hero: 5, team: 2, playerType: 1, x: W * 0.70, y: H * 0.35, dir: 220, hp: 100, status: 0, isMe: false, isTeammate: false, helmet: { level: 6, durability: 91 }, armor: { level: 6, durability: 88 }, chest: 5, bag: 5, weaponId: "18060000011", weapon2Id: "18070000004", floor: "2F", type: "player" },
    { id: "e2", name: "Nova", hero: 3, team: 2, playerType: 1, x: W * 0.73, y: H * 0.40, dir: 200, hp: 64, status: 0, isMe: false, isTeammate: false, helmet: { level: 4, durability: 41 }, armor: { level: 4, durability: 38 }, chest: 3, bag: 3, weaponId: "18020000001", weapon2Id: "", floor: "2F", type: "player" },
    { id: "e3", name: "Kite", hero: 4, team: 3, playerType: 1, x: W * 0.28, y: H * 0.70, dir: 10, hp: 45, status: 1, isMe: false, isTeammate: false, helmet: { level: 3, durability: 22 }, armor: { level: 3, durability: 18 }, chest: 2, bag: 2, weaponId: "18020000003", weapon2Id: "18070000002", floor: "1F", type: "player" },
    { id: "e4", name: "Rex", hero: 6, team: 3, playerType: 1, x: W * 0.33, y: H * 0.24, dir: 80, hp: 88, status: 0, isMe: false, isTeammate: false, helmet: { level: 5, durability: 67 }, armor: { level: 4, durability: 50 }, chest: 4, bag: 4, weaponId: "18010000021", weapon2Id: "18070000033", floor: "B1", type: "player" }
  ];

  const bots = [
    { id: "b1", name: "巡逻", x: W * 0.30, y: H * 0.26, dir: 90, hp: 100, floor: "1F", type: "bot" },
    { id: "b2", name: "守卫", x: W * 0.60, y: H * 0.62, dir: 300, hp: 80, floor: "1F", type: "bot" },
    { id: "boss", name: "BOSS", x: W * 0.82, y: H * 0.22, dir: 180, hp: 100, floor: "2F", type: "boss" }
  ];

  const items = itemsCatalog.slice(0, 12).map((it, i) => ({
    id: `i${i}`,
    itemId: it.id,
    x: W * (0.15 + (i % 4) * 0.2),
    y: H * (0.18 + Math.floor(i / 4) * 0.22),
    floor: ["1F", "2F", "B1", "1F"][i % 4],
    money: it.money,
    level: it.level,
    icon: it.icon
  }));

  const boxes = [
    { id: "d1", name: "玩家盒子", x: W * 0.68, y: H * 0.46, floor: "1F", opened: false, owner: "player" },
    { id: "d2", name: "人机盒子", x: W * 0.34, y: H * 0.30, floor: "1F", opened: true, owner: "bot" }
  ];

  const containers = (containersCatalog.length
    ? [
      { type: "Safe Box", pwd: "4812", floor: "2F", x: 0.24, y: 0.24 },
      { type: "Weapon Box", pwd: "", floor: "1F", x: 0.62, y: 0.28 },
      { type: "Computer", pwd: "", floor: "1F", x: 0.45, y: 0.54 },
      { type: "Clothing", pwd: "", floor: "1F", x: 0.76, y: 0.70 },
      { type: "Server", pwd: "", floor: "2F", x: 0.38, y: 0.36 },
      { type: "Airdrop", pwd: "", floor: "1F", x: 0.55, y: 0.48 },
      { type: "Medical Kit", pwd: "", floor: "1F", x: 0.30, y: 0.58 },
      { type: "Garbage Bin", pwd: "", floor: "1F", x: 0.68, y: 0.62 }
    ]
    : []
  ).map((c, i) => {
    const meta = containersCatalog.find((x) => x.id === c.type) || { name: c.type, icon: "assets/Icon/Bag.png" };
    return {
      id: `c${i}`,
      type: c.type,
      name: meta.name,
      x: W * c.x,
      y: H * c.y,
      floor: c.floor,
      pwd: c.pwd,
      icon: meta.icon3d || meta.icon
    };
  });

  const points = [
    { id: "p1", type: "exit", name: "撤离点 A", x: W * 0.12, y: H * 0.14, floor: "1F" },
    { id: "p2", type: "exit", name: "撤离点 B", x: W * 0.88, y: H * 0.86, floor: "1F" },
    { id: "p3", type: "switch", name: "拉闸点", x: W * 0.56, y: H * 0.16, floor: "1F" },
    { id: "p4", type: "pwdroom", name: "密码房", x: W * 0.26, y: H * 0.22, floor: "2F" },
    { id: "p5", type: "keyroom", name: "钥匙房", x: W * 0.80, y: H * 0.26, floor: "2F" }
  ];

  return {
    map: { ...mapMeta, w: W, h: H, tileSize: cfg.tileSize || 1024, cols: cfg.cols || 4, rows: cfg.rows || 4 },
    areas, players, bots, items, boxes, containers, points, itemsCatalog, containersCatalog
  };
};
