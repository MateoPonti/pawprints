// Administración del catálogo y pedidos (el back exige la sesión, el permiso de cada ruta y, en los POST, el token CSRF).
import { get, post, subir, urlDeApi } from './cliente.js';

// → {libro} (201)
export const crearLibro = (libro) => post('/api/admin/libros', libro);

// imagen: Blob JPG, PNG o WebP de hasta 1 MB → dirección completa de la portada guardada
export async function subirPortada(imagen) {
    const { portada } = await subir('/api/admin/portadas', imagen);
    return urlDeApi(portada.url);
}

// Autocompletar el alta con Open Library (permiso libros.crear). El back es el que habla con Open Library.
// texto: ISBN, o título y autor → {items: [{clave, titulo, autor, anio, portada}]}
export const buscarEnOpenLibrary = (texto) => get('/api/admin/openlibrary', { q: texto });
// clave: '/works/OL...W' → {libro: {titulo, autor, descripcion, autor_bio, portada}}
export const obraDeOpenLibrary = (clave) => get('/api/admin/openlibrary/obra', { clave });

// Listado de pedidos (permiso reservas.ver): {q, page} → {items, total, pagina, por_pagina, paginas}
export const listarReservas = (filtros) => get('/api/admin/reservas', filtros);
