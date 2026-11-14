export function mergePlaylist(playlist, currentId, liveIds) {
  const live = [...new Set((liveIds || []).filter(Boolean))];
  if (!live.length) return [];
  const liveSet = new Set(live);
  const kept = (playlist || []).filter((id) => liveSet.has(id));
  const known = new Set(kept);
  const newcomers = live.filter((id) => !known.has(id));
  if (!kept.length) return live;
  if (!newcomers.length) return kept;
  const currentIndex = kept.indexOf(currentId);
  const insertAt = currentIndex >= 0 ? currentIndex + 1 : kept.length;
  return [...kept.slice(0, insertAt), ...newcomers, ...kept.slice(insertAt)];
}

export function nextId(playlist, currentId) {
  if (!playlist?.length) return '';
  const i = playlist.indexOf(currentId);
  if (i < 0) return playlist[0];
  return playlist[(i + 1) % playlist.length];
}
