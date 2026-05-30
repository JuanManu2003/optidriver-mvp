export function createCard(className = 'card', innerHTML = '') {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = innerHTML;
  return el;
}
