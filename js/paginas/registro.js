// Registro: POST /api/registro y, si sale bien, POST /api/login para dejar la sesión iniciada.
import { montar } from '../servicios/layout.js';
import { $ } from '../servicios/dom.js';
import { activar, conectarMostrarClave } from '../servicios/formularios.js';
import * as sesion from '../servicios/sesion.js';
import * as auth from '../api/auth.js';

montar();

if (sesion.hayUsuario()) window.location.replace('index.html');

const form = $('#form-registro');
conectarMostrarClave(form);

// Regla entre dos campos: las contraseñas tienen que coincidir
const extra = () => (form.elements.password.value !== form.elements.password_confirm.value
    ? { 'password-confirm': 'Las contraseñas no coinciden.' }
    : {});

activar(form, async (f) => {
    const email = f.elements.email.value.trim().toLowerCase();
    const password = f.elements.password.value;
    await auth.registro({
        nombre: f.elements.nombre.value.trim(),
        email,
        password,
        password_confirm: f.elements.password_confirm.value,
    });
    const { csrf, usuario } = await auth.login(email, password);
    sesion.iniciar(csrf, usuario);
    window.location.href = 'index.html';
}, { extra });
