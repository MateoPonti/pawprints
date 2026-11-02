// Ingreso: POST /api/login. Con ?volver=pagina.html vuelve a esa página después de ingresar.
import { montar } from '../servicios/layout.js';
import { $ } from '../servicios/dom.js';
import { activar, conectarMostrarClave } from '../servicios/formularios.js';
import * as sesion from '../servicios/sesion.js';
import * as auth from '../api/auth.js';

montar();

if (sesion.hayUsuario()) window.location.replace('index.html');

const form = $('#form-login');
conectarMostrarClave(form);

// Solo se acepta volver a una página del propio sitio (nombre-de-archivo.html)
function destino() {
    const volver = new URLSearchParams(window.location.search).get('volver') || '';
    return /^[a-z0-9-]+\.html$/i.test(volver) ? volver : 'index.html';
}

activar(form, async (f) => {
    const { csrf, usuario } = await auth.login(f.elements.email.value.trim().toLowerCase(), f.elements.password.value);
    sesion.iniciar(csrf, usuario);
    window.location.href = destino();
});
