const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const LOOKUP_URL = 'https://users.roblox.com/v1/usernames/users';
const THUMBNAIL_URL = 'https://thumbnails.roblox.com/v1/users/avatar-headshot';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_LOOKUP = 20;

const profileCache = new Map();

function maskUsername(username) {
  const clean = String(username || '').trim();
  if (!clean) return 'Customer';
  if (clean.length <= 2) return clean[0] + '*';

  const start = clean.length <= 4 ? 1 : 2;
  const end = clean.length <= 5 ? 1 : 2;
  const middle = Math.max(2, Math.min(5, clean.length - start - end));
  return clean.slice(0, start) + '*'.repeat(middle) + clean.slice(-end);
}

function fallbackProfile(username) {
  return {
    username: maskUsername(username),
    maskedUsername: maskUsername(username),
    avatarUrl: '',
    profileUrl: '',
    robloxUserId: null,
    found: false,
  };
}

function getFetchSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

function normalizeUsernames(usernames) {
  const seen = new Set();
  return usernames
    .map(username => String(username || '').trim())
    .filter(username => USERNAME_PATTERN.test(username))
    .filter(username => {
      const key = username.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_LOOKUP);
}

function fromCache(username) {
  const key = String(username || '').toLowerCase();
  const cached = profileCache.get(key);
  if (!cached || Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
  return cached.profile;
}

function saveCache(username, profile) {
  profileCache.set(String(username || '').toLowerCase(), {
    cachedAt: Date.now(),
    profile,
  });
}

async function lookupRobloxProfiles(usernames) {
  const validUsernames = normalizeUsernames(usernames);
  const profiles = new Map();
  const misses = [];

  validUsernames.forEach(username => {
    const cached = fromCache(username);
    if (cached) {
      profiles.set(username.toLowerCase(), cached);
    } else {
      misses.push(username);
    }
  });

  if (!misses.length) return profiles;

  try {
    const lookupRes = await fetch(LOOKUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: misses, excludeBannedUsers: true }),
      signal: getFetchSignal(3500),
    });

    if (!lookupRes.ok) throw new Error('Roblox lookup failed: ' + lookupRes.status);
    const lookupJson = await lookupRes.json();
    const users = Array.isArray(lookupJson.data) ? lookupJson.data : [];
    const thumbnails = await lookupThumbnails(users);
    const foundKeys = new Set();

    users.forEach(user => {
      const requested = String(user.requestedUsername || user.name || '').trim();
      if (!requested) return;

      const profile = {
        username: maskUsername(user.name || requested),
        maskedUsername: maskUsername(user.name || requested),
        avatarUrl: thumbnails.get(Number(user.id)) || '',
        profileUrl: user.id ? 'https://www.roblox.com/users/' + user.id + '/profile' : '',
        robloxUserId: user.id || null,
        found: true,
      };
      foundKeys.add(requested.toLowerCase());
      profiles.set(requested.toLowerCase(), profile);
      saveCache(requested, profile);
    });

    misses.forEach(username => {
      if (foundKeys.has(username.toLowerCase())) return;
      const profile = fallbackProfile(username);
      profiles.set(username.toLowerCase(), profile);
      saveCache(username, profile);
    });
  } catch (err) {
    misses.forEach(username => {
      const profile = fallbackProfile(username);
      profiles.set(username.toLowerCase(), profile);
      saveCache(username, profile);
    });
  }

  return profiles;
}

async function lookupThumbnails(users) {
  const thumbnails = new Map();
  const ids = users
    .map(user => Number(user.id))
    .filter(Boolean)
    .slice(0, MAX_LOOKUP);

  if (!ids.length) return thumbnails;

  try {
    const url = THUMBNAIL_URL +
      '?userIds=' + encodeURIComponent(ids.join(',')) +
      '&size=100x100&format=Png&isCircular=true';
    const res = await fetch(url, { signal: getFetchSignal(3500) });
    if (!res.ok) throw new Error('Roblox thumbnail failed: ' + res.status);
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    data.forEach(item => {
      if (item && item.targetId && item.imageUrl) {
        thumbnails.set(Number(item.targetId), item.imageUrl);
      }
    });
  } catch (err) {
    return thumbnails;
  }

  return thumbnails;
}

function profileForUsername(username, profiles) {
  const key = String(username || '').trim().toLowerCase();
  return profiles.get(key) || fallbackProfile(username);
}

module.exports = {
  fallbackProfile,
  lookupRobloxProfiles,
  maskUsername,
  profileForUsername,
};
