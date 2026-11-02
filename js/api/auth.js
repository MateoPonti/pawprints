// Rutas de autenticación.
import { get, post } from './cliente.js';

// → {csrf, expira_en, usuario}. El id de la sesión queda en una cookie HttpOnly que pone el back.
export const login = (email, password) => post('/api/login', { email, password });

// → 204. Destruye la sesión en el back y borra la cookie (JavaScript no puede porque es HttpOnly).
export const logout = () => post('/api/logout');

// → {usuario} (201). No inicia sesión: después hay que hacer login.
export const registro = (datos) => post('/api/registro', datos);

// → {usuario, csrf} de la sesión actual
export const me = () => get('/api/me');
