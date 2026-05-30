export function updateScoreGauge(score) {
  const ring = document.querySelector('.score-ring');
  if (!ring) return;

  const deg = Math.round((score / 100) * 305);
  const track = getComputedStyle(document.documentElement).getPropertyValue('--track').trim() || '#EAECF0';
  ring.style.background = `conic-gradient(var(--accent) 0deg, var(--accent-2) ${deg}deg, ${track} ${deg}deg 360deg)`;
}
