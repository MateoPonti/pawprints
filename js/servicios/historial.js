// Últimas búsquedas del catálogo, guardadas en localStorage (quedan aunque se cierre el navegador).
// Se guardan como mucho MAXIMO: al agregar una más, se borra la más antigua.
// Si el navegador bloquea el almacenamiento, el historial simplemente queda vacío.
const CLAVE = 'pawprints.busquedas';
const MAXIMO = 5;

export function listar() {
    try {
        const datos = JSON.parse(window.localStorage.getItem(CLAVE) || '[]');
        return Array.isArray(datos) ? datos.slice(0, MAXIMO) : [];
    } catch {
        return [];
    }
}

function escribir(lista) {
    try {
        window.localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
        // Almacenamiento lleno o bloqueado: no se recuerda, pero la búsqueda funciona igual
    }
}

// busqueda: objeto con los filtros. Si ya estaba, sube al primer lugar en vez de repetirse.
export function guardar(busqueda) {
    const clave = JSON.stringify(busqueda);
    const lista = listar().filter((b) => JSON.stringify(b) !== clave);
    lista.unshift(busqueda);
    // Más de MAXIMO: se elimina la más antigua (la última de la lista)
    while (lista.length > MAXIMO) lista.pop();
    escribir(lista);
    return lista;
}

export function borrar() {
    try {
        window.localStorage.removeItem(CLAVE);
    } catch {
        // Nada que borrar
    }
}
