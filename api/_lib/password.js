function legacyHashPass(pw) {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = ((hash << 5) - hash) + pw.charCodeAt(i);
    hash |= 0;
  }
  return 'h' + Math.abs(hash).toString(36) + pw.length;
}

module.exports = {
  legacyHashPass,
};
