// Inicio: carrusel de novedades, textos fijos y tres libros del catálogo traídos de la API.
import { montar } from '../servicios/layout.js';
import { Carrusel } from '../componentes/carrusel.js';
import { el, $, reemplazar } from '../servicios/dom.js';
import { portada } from '../servicios/formato.js';
import { objeto, oferta, autor } from '../servicios/microdata.js';
import * as libros from '../api/libros.js';
import * as sesion from '../servicios/sesion.js';

montar();

new Carrusel($('#novedades'));

const zona = $('#destacados-lista');

// Zona "Tu cuenta": sin sesión quedan los enlaces a Crear cuenta e Ingresar (están en el HTML);
// con sesión se reemplazan por un saludo. Salir está en el menú.
if (sesion.hayUsuario()) {
    reemplazar($('#cuenta-zona'),
        el('p', {}, `Hola, ${sesion.usuario().nombre}. Ya ingresaste a tu cuenta.`),
        el('div', { class: 'acciones' },
            el('a', { class: 'btn', href: 'reserva.html' }, 'Reservar un libro'),
            sesion.puede('libros.crear') ? el('a', { class: 'btn secundario', href: 'admin-libro.html' }, 'Cargar un libro') : null));
}

async function cargar() {
    reemplazar(zona, el('p', { text: 'Cargando libros...' }));
    try {
        const { items } = await libros.listar({ per_page: 3 });
        reemplazar(zona, el('ul', { class: 'catalogo-lista' }, items.map((libro) => el('li', {},
            el('article', { 'aria-labelledby': `destacado-${libro.id}`, ...objeto('Book') },
                el('img', { src: portada(libro), alt: `Portada de ${libro.titulo}`, width: 120, height: 180, loading: 'lazy', itemprop: 'image' }),
                el('h3', { id: `destacado-${libro.id}` },
                    el('a', { href: `libro.html?id=${encodeURIComponent(libro.id)}`, itemprop: 'url' },
                        el('span', { itemprop: 'name' }, libro.titulo))),
                el('p', {}, 'Autor: ', autor(libro.autor)),
                el('p', {}, 'Precio: ', oferta(libro.precio)))))));
    } catch (error) {
        reemplazar(zona, el('p', { role: 'alert' }, `No pudimos cargar los libros. ${error.message} `,
            el('button', { type: 'button', class: 'boton-secundario', onclick: cargar }, 'Reintentar')));
    }
}

cargar();
