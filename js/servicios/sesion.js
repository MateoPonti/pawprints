// La sesión vive en el back ($_SESSION) y el navegador guarda su id en una cookie HttpOnly que JavaScript
// no puede leer. Acá solo se guardan, en sessionStorage, los datos del usuario (para mostrar nombre y rol)
// y el token CSRF que el back pide en los POST con sesión.
// Si el navegador bloquea el almacenamiento, se usa la memoria de la pestaña.
const CLAVE_CSRF = 'pawprints.csrf';
const CLAVE_USUARIO = 'pawprints.usuario';
const memoria = {};

function leer(clave) {
    try {
        return window.sessionStorage.getItem(clave);
    } catch {
        return memoria[clave] ?? null;
    }
}

function escribir(clave, valor) {
    try {
        if (valor === null) window.sessionStorage.removeItem(clave);
        else window.sessionStorage.setItem(clave, valor);
    } catch {
        if (valor === null) delete memoria[clave];
        else memoria[clave] = valor;
    }
}

export const csrf = () => leer(CLAVE_CSRF);

export function usuario() {
    try {
        return JSON.parse(leer(CLAVE_USUARIO) || 'null');
    } catch {
        return null;
    }
}

export const hayUsuario = () => csrf() !== null && usuario() !== null;
export const esAdmin = () => usuario()?.rol === 'admin';

export function iniciar(csrfNuevo, datosUsuario) {
    escribir(CLAVE_CSRF, csrfNuevo);
    escribir(CLAVE_USUARIO, JSON.stringify(datosUsuario));
}

// Solo borra lo guardado en el navegador; la sesión y la cookie las borra el back con POST /api/logout.
export function cerrar() {
    escribir(CLAVE_CSRF, null);
    escribir(CLAVE_USUARIO, null);
}
