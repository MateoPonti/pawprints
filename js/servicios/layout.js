// Cabecera, menú, pie y zona de avisos comunes a todas las páginas.
// Cada página marca su sección en <body data-pagina="..."> para resaltar el ítem activo del menú.
import * as sesion from './sesion.js';
import * as auth from '../api/auth.js';
import { el, $, reemplazar } from './dom.js';
import { objeto } from './microdata.js';

const MENU = [
    ['inicio', 'index.html', 'Inicio'],
    ['catalogo', 'catalogo.html', 'Catálogo'],
    ['reserva', 'reserva.html', 'Formulario de reserva'],
    ['nosotros', 'nosotros.html', 'Nuestra historia'],
    ['contacto', 'contacto.html', 'Contacto'],
];

function enlace(clave, href, texto, actual) {
    return el('li', {}, el('a', { href, 'aria-current': clave === actual ? 'page' : false }, texto));
}

function menu(actual) {
    const items = MENU.map(([clave, href, texto]) => enlace(clave, href, texto, actual));
    if (sesion.hayUsuario()) {
        if (sesion.puede('libros.crear')) items.push(enlace('admin', 'admin-libro.html', 'Cargar libro', actual));
        if (sesion.puede('reservas.ver')) items.push(enlace('pedidos', 'admin-reservas.html', 'Pedidos', actual));
        items.push(el('li', {}, el('button', {
            type: 'button',
            class: 'boton-menu',
            onclick: async () => {
                try {
                    await auth.logout(); // destruye la sesión en el back y borra la cookie
                } catch {
                    // Sin conexión: se borra lo local igual.
                }
                sesion.cerrar();
                window.location.href = 'index.html';
            },
        }, `Salir (${sesion.usuario().nombre})`)));
    } else {
        items.push(enlace('login', 'login.html', 'Ingresar', actual));
        items.push(enlace('registro', 'registro.html', 'Crear cuenta', actual));
    }
    return el('ul', {}, items);
}

// Los datos de la librería con microdata (BookStore) van solo en el pie del inicio; la ficha completa,
// con horarios y sedes, está en contacto.html. En el resto de las páginas el pie es el mismo pero sin
// microdata: repetir la librería en cada página no le suma nada al buscador (ver README, consigna 8).
function direccionConMicrodata() {
    return el('address', objeto('BookStore'),
        el('meta', { itemprop: 'name', content: 'PawPrints' }),
        el('link', { itemprop: 'url', href: 'index.html' }),
        el('span', { itemprop: 'address', ...objeto('PostalAddress') },
            el('span', { itemprop: 'streetAddress' }, 'Av. Siempre Viva 742'), ', ',
            el('span', { itemprop: 'addressLocality' }, 'Luján'), ', ',
            el('span', { itemprop: 'addressRegion' }, 'Buenos Aires'),
            el('meta', { itemprop: 'addressCountry', content: 'AR' })), el('br'),
        'Teléfono: ', el('a', { href: 'tel:+542323123456' }, el('span', { itemprop: 'telephone' }, '(02323) 12-3456')), el('br'),
        'Email: ', el('a', { href: 'mailto:contacto@pawprints.com.ar' }, el('span', { itemprop: 'email' }, 'contacto@pawprints.com.ar')));
}

export function montar() {
    const actual = document.body.dataset.pagina || '';

    reemplazar($('#cabecera'),
        // Logo del manual de identidad (opción Violeta); el alt hace de nombre del enlace
        el('p', { class: 'marca' }, el('a', { href: 'index.html' },
            el('img', { src: 'img/logo.svg', alt: 'PawPrints, ir al inicio', width: 220, height: 75 }))),
        actual === 'inicio' ? el('p', { class: 'lema', text: 'Tu librería de siempre, ahora también online.' }) : null);

    reemplazar($('#menu'), menu(actual));

    reemplazar($('#pie'),
        actual === 'inicio' ? direccionConMicrodata() : el('address', {},
            'Av. Siempre Viva 742, Luján, Buenos Aires', el('br'),
            'Teléfono: ', el('a', { href: 'tel:+542323123456' }, '(02323) 12-3456'), el('br'),
            'Email: ', el('a', { href: 'mailto:contacto@pawprints.com.ar' }, 'contacto@pawprints.com.ar')),
        el('nav', { 'aria-label': 'Redes sociales' }, el('ul', {},
            [['Instagram', 'https://instagram.com/pawprints'],
                ['Facebook', 'https://facebook.com/pawprints'],
                ['Twitter/X', 'https://twitter.com/pawprints']].map(([nombre, href]) => el('li', {},
                el('a', { href, target: '_blank', rel: 'noopener noreferrer' },
                    nombre, el('span', { class: 'visualmente-oculto', text: ' (se abre en una pestaña nueva)' })))))),
        el('p', {}, el('small', {}, `© ${new Date().getFullYear()} PawPrints. Todos los derechos reservados.`)));

    // Zona de avisos para los cambios que no mueven el foco (resultados, confirmaciones)
    document.body.append(el('div', { id: 'anuncios', class: 'visualmente-oculto', role: 'status', 'aria-live': 'polite' }));
}

// Lee un aviso en voz de la zona de estado.
export function anunciar(texto) {
    const zona = document.getElementById('anuncios');
    if (!zona) return;
    zona.textContent = '';
    window.setTimeout(() => { zona.textContent = texto; }, 50);
}

// Exige sesión (y un permiso si hace falta); si no se cumple, redirige. El back vuelve a controlarlo en cada pedido.
export function exigir({ permiso = null } = {}) {
    if (!sesion.hayUsuario()) {
        window.location.replace(`login.html?volver=${encodeURIComponent(window.location.pathname.split('/').pop())}`);
        return false;
    }
    if (permiso && !sesion.puede(permiso)) {
        window.location.replace('index.html');
        return false;
    }
    return true;
}
