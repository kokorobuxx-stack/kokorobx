const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const LOOKUP_URL = 'https://users.roblox.com/v1/usernames/users';
const HEADSHOT_URL = 'https://thumbnails.roblox.com/v1/users/avatar-headshot';
const AVATAR_URL = 'https://thumbnails.roblox.com/v1/users/avatar';

function getFetchSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error('Roblox API gagal: ' + response.status);
  }
  return response.json();
}

async function getRobloxAvatar(userId) {
  const id = Number(userId);
  if (!id) {
    const err = new Error('User ID Roblox tidak valid.');
    err.statusCode = 400;
    throw err;
  }

  const [headshot, avatar] = await Promise.allSettled([
    fetchJson(HEADSHOT_URL + '?userIds=' + encodeURIComponent(String(id)) + '&size=150x150&format=Png&isCircular=true', { signal: getFetchSignal(3500) }),
    fetchJson(AVATAR_URL + '?userIds=' + encodeURIComponent(String(id)) + '&size=420x420&format=Png&isCircular=false', { signal: getFetchSignal(3500) }),
  ]);

  const headshotData = headshot.status === 'fulfilled' && Array.isArray(headshot.value.data)
    ? headshot.value.data[0]
    : null;
  const avatarData = avatar.status === 'fulfilled' && Array.isArray(avatar.value.data)
    ? avatar.value.data[0]
    : null;

  return {
    userId: id,
    headshotUrl: headshotData && headshotData.imageUrl ? headshotData.imageUrl : '',
    avatarUrl: avatarData && avatarData.imageUrl ? avatarData.imageUrl : '',
    profileUrl: 'https://www.roblox.com/users/' + id + '/profile',
  };
}

async function lookupRobloxUser(username) {
  const clean = String(username || '').trim();
  if (!USERNAME_PATTERN.test(clean)) {
    const err = new Error('Username Roblox tidak valid.');
    err.statusCode = 400;
    throw err;
  }

  const data = await fetchJson(LOOKUP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [clean], excludeBannedUsers: true }),
    signal: getFetchSignal(4500),
  });

  const user = Array.isArray(data.data) ? data.data[0] : null;
  if (!user || !user.id) {
    const err = new Error('Username Roblox tidak ditemukan.');
    err.statusCode = 404;
    throw err;
  }

  const thumbs = await getRobloxAvatar(user.id);
  return {
    found: true,
    userId: Number(user.id),
    username: user.name || clean,
    displayName: user.displayName || user.name || clean,
    headshotUrl: thumbs.headshotUrl || thumbs.avatarUrl || '',
    avatarUrl: thumbs.avatarUrl || thumbs.headshotUrl || '',
    profileUrl: 'https://www.roblox.com/users/' + user.id + '/profile',
    status: 'Username Terhubung',
    verified: false,
    verificationLabel: 'Belum Terverifikasi',
  };
}

module.exports = {
  getRobloxAvatar,
  lookupRobloxUser,
};
