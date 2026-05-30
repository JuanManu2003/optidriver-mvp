export function badgeClassForScore(score) {
  return score < 78 ? 'badge warning' : 'badge';
}

export function createTripBadge(score) {
  const div = document.createElement('div');
  div.className = badgeClassForScore(score);
  div.textContent = String(score);
  return div;
}
