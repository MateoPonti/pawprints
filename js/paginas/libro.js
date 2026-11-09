// Detalle de un libro: /libro.html?id=rayuela
import { montar } from '../servicios/layout.js';
import { el, $, reemplazar } from '../servicios/dom.js';
import { genero, portada } from '../servicios/formato.js';
import { objeto, oferta, autor } from '../servicios/microdata.js';
import * as libros from '../api/libros.js';

montar();

const zona = $('#detalle');
const id = new URLSearchParams(window.location.search).get('id');

function mostrarError(mensaje) {
    document.title = 'Libro no encontrado - PawPrints';
    reemplazar(zona,
        el('h1', { id: 'titulo-pagina', tabindex: '-1', text: 'No pudimos mostrar el libro' }),
        el('div', { class: 'aviso aviso-error', role: 'alert' },
            el('p', {}, el('span', { class: 'error-icono', 'aria-hidden': 'true', text: '!' }),
                el('span', { class: 'visualmente-oculto', text: 'Error: ' }), mensaje)),
        el('p', {}, el('a', { href: 'catalogo.html' }, 'Volver al catálogo')));
}

async function cargar() {
    if (!id) {
        mostrarError('Falta indicar qué libro querés ver.');
        return;
    }
    try {
        const { libro } = await libros.detalle(id);
        document.title = `${libro.titulo} - PawPrints`;
        $('meta[name="description"]').setAttribute('content', libro.resumen || `Detalle de ${libro.titulo}`);
        reemplazar(zona,
            // Ruta de navegación como BreadcrumbList: cada paso es un ListItem con su posición
            el('nav', { class: 'ruta', 'aria-label': 'Ruta de navegación' }, el('ol', objeto('BreadcrumbList'),
                el('li', { itemprop: 'itemListElement', ...objeto('ListItem') },
                    el('a', { href: 'catalogo.html', itemprop: 'item' }, el('span', { itemprop: 'name' }, 'Catálogo')),
                    el('meta', { itemprop: 'position', content: '1' })),
                el('li', { itemprop: 'itemListElement', ...objeto('ListItem') },
                    el('span', { 'aria-current': 'page', itemprop: 'name' }, libro.titulo),
                    el('meta', { itemprop: 'position', content: '2' })))),
            // El libro completo: Book con autor (Person, con su biografía), género, descripción, tapa y precio (Offer)
            el('article', { class: 'libro', 'aria-labelledby': 'titulo-pagina', ...objeto('Book') },
                el('figure', {},
                    el('img', { src: portada(libro), alt: `Portada de ${libro.titulo}`, width: 200, height: 300, itemprop: 'image' })),
                el('div', { class: 'libro-datos' },
                    el('h1', { id: 'titulo-pagina', text: libro.titulo, itemprop: 'name' }),
                    el('p', {}, 'Autor: ', el('a', { href: '#autor' }, autor(libro.autor, libro.autor_bio))),
                    el('p', {}, 'Género: ', el('span', { itemprop: 'genre' }, genero(libro.genero))),
                    el('p', { class: 'precio' }, 'Precio: ', oferta(libro.precio)),
                    el('a', { class: 'btn', href: `reserva.html?libro=${encodeURIComponent(libro.id)}` }, 'Reservar este libro')),
                el('section', { 'aria-labelledby': 'descripcion-titulo' },
                    el('h2', { id: 'descripcion-titulo', text: 'Descripción completa' }),
                    el('p', {
                        text: libro.descripcion || libro.resumen || 'Sin descripción por el momento.',
                        itemprop: libro.descripcion || libro.resumen ? 'description' : false,
                    })),
                el('section', { id: 'autor', 'aria-labelledby': 'autor-titulo' },
                    el('h2', { id: 'autor-titulo', text: 'Sobre el autor' }),
                    el('p', { text: libro.autor_bio || 'Sin información del autor por el momento.' }))));
    } catch (error) {
        mostrarError(error.status === 404 ? 'El libro que buscás no está en el catálogo.' : error.message);
    }
}

cargar();
