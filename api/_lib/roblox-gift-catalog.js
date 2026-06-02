const { setCors } = require('./http');

const ROBLOX_TIMEOUT_MS = 4500;

const GAME_CONFIG = [
  { id: 'blox-fruits', name: 'Blox Fruits', query: 'Blox Fruits', universeId: 994732206 },
  { id: 'grow-a-garden', name: 'Grow a Garden', query: 'Grow a Garden', universeId: 7436755782 },
  { id: 'blue-lock-rivals', name: 'Blue Lock: Rivals', query: 'Blue Lock Rivals', universeId: 6325068386 },
  { id: 'fisch', name: 'Fisch', query: 'Fisch', universeId: 5750914919 },
  { id: 'blade-ball', name: 'Blade Ball', query: 'Blade Ball', universeId: 4777817887 },
  { id: 'pet-simulator-99', name: 'Pet Simulator 99', query: 'Pet Simulator 99', universeId: 3317771874 },
  { id: 'sols-rng', name: "Sol's RNG", query: "Sol's RNG", universeId: 5361032378 },
  { id: 'drag-drive-simulator', name: 'Drag Drive Simulator', query: 'Drag Drive Simulator', universeId: 7089588429 },
  { id: 'car-driving-indonesia', name: 'Car Driving Indonesia', query: 'Car Driving Indonesia', universeId: 2640407187 },
  { id: 'volleyball-legends', name: 'Volleyball Legends', query: 'Volleyball Legends', universeId: 6931042565 },
  { id: 'basketball-zero', name: 'Basketball Zero', query: 'Basketball Zero', universeId: 7028566528 },
  { id: 'dress-to-impress', name: 'Dress To Impress', query: 'Dress To Impress', universeId: 5203828273 },
  { id: 'anime-vanguards', name: 'Anime Vanguards', query: 'Anime Vanguards', universeId: 5578556129 },
  { id: 'anime-defenders', name: 'Anime Defenders', query: 'Anime Defenders' },
  { id: 'brookhaven', name: 'Brookhaven', query: 'Brookhaven' },
  { id: 'adopt-me', name: 'Adopt Me', query: 'Adopt Me' },
  { id: 'murder-mystery-2', name: 'Murder Mystery 2', query: 'Murder Mystery 2' },
  { id: 'king-legacy', name: 'King Legacy', query: 'King Legacy', universeId: 1451439645 },
  { id: 'jujutsu-infinite', name: 'Jujutsu Infinite', query: 'Jujutsu Infinite', universeId: 3808223175 },
  { id: 'the-strongest-battlegrounds', name: 'The Strongest Battlegrounds', query: 'The Strongest Battlegrounds', universeId: 3808081382 },
  { id: 'toilet-tower-defense', name: 'Toilet Tower Defense', query: 'Toilet Tower Defense' },
  { id: 'jailbreak', name: 'Jailbreak', query: 'Jailbreak' },
  { id: 'bedwars', name: 'BedWars', query: 'BedWars' },
  { id: 'doors', name: 'DOORS', query: 'DOORS' },
];

function robloxSignal() {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ROBLOX_TIMEOUT_MS);
  }
  return undefined;
}

async function fetchJson(url, options) {
  const res = await fetch(url, Object.assign({
    headers: { 'User-Agent': 'KokoRBX/1.0 (+https://koko-rbx.vercel.app)' },
    signal: robloxSignal(),
  }, options || {}));
  if (!res.ok) throw new Error('Roblox API ' + res.status);
  return res.json();
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function pickBestGame(results, wantedName) {
  const target = normalize(wantedName);
  const games = [];
  (results.searchResults || []).forEach(group => {
    if (group.contentGroupType !== 'Game') return;
    (group.contents || []).forEach(game => games.push(game));
  });
  if (!games.length) return null;

  return games
    .map(game => {
      const name = normalize(game.name);
      let score = Number(game.playerCount || 0);
      if (name === target) score += 100000000;
      else if (name.includes(target) || target.includes(name)) score += 50000000;
      if (game.emphasis) score += 5000000;
      return { game, score };
    })
    .sort((a, b) => b.score - a.score)[0].game;
}

async function searchGame(config) {
  if (config.universeId) {
    const data = await fetchJson('https://games.roblox.com/v1/games?universeIds=' + encodeURIComponent(config.universeId));
    const game = data && data.data && data.data[0];
    if (game) {
      return {
        universeId: game.id,
        rootPlaceId: game.rootPlaceId,
        name: game.name,
        description: game.description,
        playerCount: game.playing,
        creatorName: game.creator && game.creator.name,
        canonicalUrlPath: game.canonicalUrlPath,
        emphasis: true,
      };
    }
  }

  const params = new URLSearchParams({
    searchQuery: config.query || config.name,
    pageToken: '',
    sessionId: '00000000-0000-0000-0000-000000000000',
    pageType: 'All',
  });
  const data = await fetchJson('https://apis.roblox.com/search-api/omni-search?' + params.toString());
  return pickBestGame(data, config.name);
}

async function loadGameImages(universeIds) {
  const ids = universeIds.filter(Boolean);
  if (!ids.length) return { icons: new Map(), covers: new Map() };

  const [iconsResult, coversResult] = await Promise.allSettled([
    fetchJson('https://thumbnails.roblox.com/v1/games/icons?universeIds=' + ids.join(',') + '&size=512x512&format=Png&isCircular=false'),
    fetchJson('https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=' + ids.join(',') + '&countPerUniverse=1&defaults=true&size=768x432&format=Png'),
  ]);

  const icons = new Map();
  const covers = new Map();
  if (iconsResult.status === 'fulfilled') {
    (iconsResult.value.data || []).forEach(item => {
      if (item.targetId && item.imageUrl) icons.set(Number(item.targetId), item.imageUrl);
    });
  }
  if (coversResult.status === 'fulfilled') {
    (coversResult.value.data || []).forEach(item => {
      const thumb = item.thumbnails && item.thumbnails[0];
      if (item.universeId && thumb && thumb.imageUrl) covers.set(Number(item.universeId), thumb.imageUrl);
    });
  }
  return { icons, covers };
}

async function loadGames(configs) {
  const searched = await Promise.all(configs.map(async config => {
    try {
      const game = await searchGame(config);
      if (!game) throw new Error('not found');
      return {
        id: config.id,
        requestedName: config.name,
        name: game.name || config.name,
        universeId: Number(game.universeId || 0),
        rootPlaceId: Number(game.rootPlaceId || 0),
        creatorName: game.creatorName || '',
        playerCount: Number(game.playerCount || 0),
        canonicalUrlPath: game.canonicalUrlPath || '',
        robloxUrl: game.canonicalUrlPath ? 'https://www.roblox.com' + game.canonicalUrlPath : '',
        source: 'roblox',
      };
    } catch (err) {
      return {
        id: config.id,
        requestedName: config.name,
        name: config.name,
        universeId: 0,
        rootPlaceId: 0,
        creatorName: '',
        playerCount: 0,
        canonicalUrlPath: '',
        robloxUrl: '',
        source: 'fallback',
      };
    }
  }));

  const images = await loadGameImages(searched.map(game => game.universeId));
  return searched.map(game => Object.assign({}, game, {
    iconUrl: images.icons.get(game.universeId) || '',
    imageUrl: images.covers.get(game.universeId) || images.icons.get(game.universeId) || '',
  }));
}

async function loadPassIcons(assetIds) {
  const ids = assetIds.filter(Boolean);
  if (!ids.length) return new Map();
  try {
    const data = await fetchJson('https://thumbnails.roblox.com/v1/assets?assetIds=' + ids.join(',') + '&size=150x150&format=Png&isCircular=false');
    const map = new Map();
    (data.data || []).forEach(item => {
      if (item.targetId && item.imageUrl) map.set(Number(item.targetId), item.imageUrl);
    });
    return map;
  } catch (err) {
    return new Map();
  }
}

async function loadGamePasses(universeId) {
  if (!universeId) return [];
  const data = await fetchJson('https://apis.roblox.com/game-passes/v1/universes/' + encodeURIComponent(universeId) + '/game-passes?limit=100&passView=Full');
  const passes = (data.gamePasses || []).filter(pass => pass && pass.isForSale !== false);
  const icons = await loadPassIcons(passes.map(pass => Number(pass.displayIconImageAssetId || pass.iconImageAssetId || 0)));
  return passes.map(pass => {
    const iconAssetId = Number(pass.displayIconImageAssetId || pass.iconImageAssetId || 0);
    const price = Number(pass.price || pass.userBasePriceInRobux || 0);
    return {
      id: 'live-' + pass.id,
      passId: Number(pass.id),
      productId: Number(pass.productId || 0),
      title: pass.displayName || pass.name || 'Gamepass Roblox',
      name: pass.name || pass.displayName || 'Gamepass Roblox',
      desc: pass.displayDescription || pass.description || 'Gamepass aktif dari Roblox.',
      robux: price,
      price,
      category: 'gamepass',
      badge: 'Live Roblox',
      imageUrl: icons.get(iconAssetId) || '',
      iconAssetId,
      source: 'roblox',
    };
  }).sort((a, b) => {
    if (!a.robux && b.robux) return 1;
    if (a.robux && !b.robux) return -1;
    return (a.robux || 0) - (b.robux || 0) || a.title.localeCompare(b.title);
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const requestedGame = String((req.query && req.query.game) || '').trim();
  const activeConfig = GAME_CONFIG.find(game => game.id === requestedGame);
  const configs = activeConfig ? [activeConfig] : GAME_CONFIG;

  try {
    const games = await loadGames(configs);
    const activeGame = activeConfig ? games[0] : null;
    let passes = [];
    if (activeGame && activeGame.universeId) {
      try {
        passes = await loadGamePasses(activeGame.universeId);
      } catch (err) {
        passes = [];
      }
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      ok: true,
      updatedAt: new Date().toISOString(),
      games,
      activeGame,
      passes,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: err.message,
      updatedAt: new Date().toISOString(),
      games: configs.map(config => ({ id: config.id, name: config.name, source: 'fallback' })),
      activeGame: activeConfig ? { id: activeConfig.id, name: activeConfig.name, source: 'fallback' } : null,
      passes: [],
    });
  }
};
