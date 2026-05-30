export function bindAction(selector, handler) {
  document.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      handler(el, e);
    });
  });
}
