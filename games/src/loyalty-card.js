function asScores(scores) {
  if (typeof scores === 'number') return { stamps: scores, points: 0 };
  return {
    stamps: Math.max(0, Number(scores?.stamps) || 0),
    points: Math.max(0, Number(scores?.points) || 0),
  };
}

export function loyaltyCardProgress(card, scores = {}) {
  const slots = Math.max(1, Math.min(12, Number(card?.stampsRequired) || 5));
  const fillMode = card?.fillMode === 'points' ? 'points' : 'stamp';
  const pointsPerSlot = Math.max(1, Math.min(999, Number(card?.pointsPerSlot) || 10));
  const { stamps, points } = asScores(scores);
  if (fillMode === 'points') {
    const filled = Math.min(slots, Math.floor(points / pointsPerSlot));
    const remaining = Math.max(0, slots * pointsPerSlot - points);
    return { slots, filled, remaining, fillMode, pointsPerSlot };
  }
  const filled = Math.min(slots, stamps);
  return { slots, filled, remaining: Math.max(0, slots - filled), fillMode, pointsPerSlot };
}

export function loyaltyCardCopy(card, scores = {}) {
  const progress = loyaltyCardProgress(card, scores);
  const reward = String(card?.rewardText || '').trim();
  return {
    ...progress,
    stamps: progress.filled,
    title: card?.name || '',
    bannerStrong: `🥂 ${progress.filled} ${reward}`.trim(),
    bannerHint: String(card?.barHint || '').trim(),
    footer: String(card?.footerTemplate || '').replace('{n}', String(progress.remaining)),
  };
}

export function loyaltyCardStyle(card) {
  const style = {};
  if (card?.cardBg) style['--lc-bg'] = card.cardBg;
  if (card?.cardAccent) style['--lc-accent'] = card.cardAccent;
  if (card?.cardAccentSoft) style['--lc-accent-soft'] = card.cardAccentSoft;
  if (card?.cardText) style['--lc-text'] = card.cardText;
  if (card?.cardBorder) style['--lc-border'] = card.cardBorder;
  return style;
}
