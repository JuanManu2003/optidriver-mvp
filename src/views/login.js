import { goTo } from '../modules/navigation.js';
import { getUser } from '../modules/storage.js';
import { validateLogin, getPostLoginScreen, loginOnline } from '../modules/auth.js';
import { bindAction } from '../components/Button.js';
import {
  isValidEmail, isNonEmpty, setFieldError, clearFieldErrors, showFormErrors,
} from '../modules/validation.js';
import { showToast } from '../modules/telemetrySimulator.js';

const LOGIN_FIELDS = ['loginEmail', 'loginPassword'];

function validateForm() {
  clearFieldErrors(LOGIN_FIELDS);
  showFormErrors('loginErrors', []);

  const email    = document.getElementById('loginEmail')?.value?.trim() || '';
  const password = document.getElementById('loginPassword')?.value || '';
  const summary  = [];
  let valid = true;

  if (!isNonEmpty(email))     { setFieldError('loginEmail', 'Ingresa tu correo.'); summary.push('Correo requerido.'); valid = false; }
  else if (!isValidEmail(email)) { setFieldError('loginEmail', 'Formato de correo inválido.'); summary.push('Correo inválido.'); valid = false; }
  if (!isNonEmpty(password))  { setFieldError('loginPassword', 'Ingresa tu contraseña.'); summary.push('Contraseña requerida.'); valid = false; }

  if (!valid) { showFormErrors('loginErrors', summary); return null; }
  return { email, password };
}

export function initLogin() {
  const user = getUser();
  const emailInput = document.getElementById('loginEmail');
  if (emailInput && user.email) emailInput.value = user.email;

  bindAction('[data-action="login-submit"]', async () => {
    const fields = validateForm();
    if (!fields) return;

    const btn = document.querySelector('[data-action="login-submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

    // Intentar login en backend primero
    const online = await loginOnline(fields.email, fields.password);

    if (online.ok) {
      const name = online.user?.firstName || getUser().name?.split(' ')[0] || 'conductor';
      showToast('Bienvenido', `Hola ${name}, buen turno.`);
      goTo(getPostLoginScreen());
    } else {
      // Fallback a validación local
      const local = validateLogin(fields.email, fields.password);
      if (local.valid) {
        showToast('Bienvenido', `Hola ${getUser().name?.split(' ')[0] || ''}, buen turno.`);
        goTo(getPostLoginScreen());
      } else {
        setFieldError('loginPassword', local.message || online.error);
        showFormErrors('loginErrors', [local.message || online.error]);
      }
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Iniciar sesión'; }
  });
}
