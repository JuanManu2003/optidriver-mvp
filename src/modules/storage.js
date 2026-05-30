import { mockUser } from '../data/mockUser.js';
import { mockVehicle } from '../data/mockVehicle.js';

const STORAGE_KEY = 'optidriver_app_state';

const defaultState = () => ({
  user: {
    ...mockUser,
    isRegistered: false,
    onboardingComplete: false,
    passwordMvp: '',
  },
  vehicle: { ...mockVehicle },
});

let memoryState = defaultState();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      user: { ...mockUser, ...parsed.user },
      vehicle: { ...mockVehicle, ...parsed.vehicle },
    };
  } catch {
    return defaultState();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch {
    /* ignore quota errors in MVP */
  }
}

export function initStorage() {
  memoryState = loadFromStorage();
}

export function getState() {
  return memoryState;
}

export function getUser() {
  return memoryState.user;
}

export function getVehicle() {
  return memoryState.vehicle;
}

export function updateUser(partial) {
  memoryState.user = { ...memoryState.user, ...partial };
  persist();
}

export function updateVehicle(partial) {
  memoryState.vehicle = { ...memoryState.vehicle, ...partial };
  persist();
}

export function resetSession() {
  memoryState = defaultState();
  persist();
  document.dispatchEvent(new CustomEvent('sessionreset'));
}
