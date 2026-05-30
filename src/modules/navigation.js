export const APP_SCREENS = ['dashboard', 'trips', 'insights', 'profile'];

const NAV_INDEX = {
  dashboard: 0,
  trips: 1,
  insights: 2,
  profile: 3,
};

let currentScreen = 'welcome';

export function getCurrentScreen() {
  return currentScreen;
}

export function goTo(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.remove('active');
  });

  const target = document.getElementById(screenId);
  if (!target) return;

  target.classList.add('active');
  currentScreen = screenId;

  const nav = document.getElementById('bottomNav');
  if (APP_SCREENS.includes(screenId)) {
    nav.classList.add('visible');
    setActiveNav(screenId);
  } else {
    nav.classList.remove('visible');
  }

  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('screenchange', { detail: { screenId } }));
}

export function navTo(screenId, button) {
  goTo(screenId);
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
  if (button) button.classList.add('active');
}

export function setActiveNav(screenId) {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach((btn) => btn.classList.remove('active'));

  const index = NAV_INDEX[screenId];
  if (index !== undefined && navButtons[index]) {
    navButtons[index].classList.add('active');
  }
}

export function initNavigation() {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const screenId = el.getAttribute('data-nav');
      if (!screenId) return;
      if (el.classList.contains('nav-btn')) {
        navTo(screenId, el);
      } else {
        goTo(screenId);
      }
      e.preventDefault();
    });
  });
}
