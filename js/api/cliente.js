// Cliente HTTP: arma la URL, manda la cookie de sesión y el token CSRF, y convierte las respuestas.
// Todos los fetch del front pasan por acá; auth.js, libros.js, reservas.js y admin.js solo dicen qué ruta llamar.
import { API_URL } from './config.js';
import * as sesion from '../servicios/sesion.js';

// Error con la forma de la API: {"error": "codigo", "mensaje": "...", "errores": {campo: mensaje}}.
// status 0 = no se pudo conectar.
export class ErrorApi extends Error {
    constructor(status, codigo, mensaje, errores = {}) {
        super(mensaje);
        this.status = status;
        this.codigo = codigo;
        this.errores = errores;
    }
}

function armarUrl(ruta, consulta) {
    // El segundo argumento hace válida una ruta relativa (/api/...) cuando API_URL está vacío
    const url = new URL(API_URL + ruta, window.location.origin);
    Object.entries(consulta || {}).forEach(([clave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
    });
    return url;
}

// cuerpo se manda como JSON; archivo (un Blob o File) se manda tal cual, con su tipo como Content-Type.
export async function pedir(metodo, ruta, { consulta, cuerpo, archivo } = {}) {
    const cabeceras = { Accept: 'application/json' };
    // La cookie de sesión la manda el navegador solo; lo que cambia datos lleva además el token CSRF
    const csrf = sesion.csrf();
    if (csrf && metodo !== 'GET') cabeceras['X-CSRF-Token'] = csrf;
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (archivo) cabeceras['Content-Type'] = archivo.type;

    let respuesta;
    try {
        respuesta = await fetch(armarUrl(ruta, consulta), {
            method: metodo,
            headers: cabeceras,
            // include: manda la cookie y guarda la que llega, también en local, donde la API está en otro puerto
            credentials: 'include',
            body: archivo || (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
        });
    } catch {
        throw new ErrorApi(0, 'sin_conexion',
            'No se pudo conectar con el servidor. Probá de nuevo en un minuto.');
    }

    if (respuesta.status === 204) return null;

    let datos = null;
    try {
        datos = await respuesta.json();
    } catch {
        // Respuesta sin JSON (por ejemplo un error del proxy): se informa con el mensaje genérico de abajo.
    }

    if (!respuesta.ok) {
        // Sesión vencida o usuario borrado: los datos guardados de la sesión ya no sirven.
        if (respuesta.status === 401 && sesion.hayUsuario()) sesion.cerrar();
        throw new ErrorApi(
            respuesta.status,
            datos?.error || 'error',
            datos?.mensaje || 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.',
            datos?.errores || {},
        );
    }
    return datos;
}

export const get = (ruta, consulta) => pedir('GET', ruta, { consulta });
export const post = (ruta, cuerpo) => pedir('POST', ruta, { cuerpo });
export const subir = (ruta, archivo) => pedir('POST', ruta, { archivo });

// Las rutas que devuelve la API (por ejemplo /api/portadas/3) pasan a ser direcciones completas
export const urlDeApi = (ruta) => API_URL + ruta;
