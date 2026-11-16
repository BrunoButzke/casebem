export function sortRankingRows(rows) {
  return [...rows].sort((a, b) => {
    const points = (Number(b.points) || 0) - (Number(a.points) || 0);
    if (points) return points;
    const stamps = (Number(b.stamps) || 0) - (Number(a.stamps) || 0);
    if (stamps) return stamps;
    return String(a.guestName || '').localeCompare(String(b.guestName || ''), 'pt');
  });
}

export function mergeRankingRows(rows, you) {
  const list = (Array.isArray(rows) ? rows : []).map((row) => ({
    guestName: String(row?.guestName || '').trim(),
    points: Number(row?.points) || 0,
    stamps: Number(row?.stamps) || 0,
  }));
  const guestName = String(you?.guestName || '').trim();
  if (!guestName) return sortRankingRows(list.filter((row) => row.guestName));
  const key = guestName.toLowerCase();
  const rest = list.filter((row) => row.guestName.toLowerCase() !== key);
  rest.push({
    guestName,
    points: Number(you?.points) || 0,
    stamps: Number(you?.stamps) || 0,
  });
  return sortRankingRows(rest.filter((row) => row.guestName));
}
