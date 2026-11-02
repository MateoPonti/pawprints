// Cabecera, menú, pie y zona de avisos comunes a todas las páginas.
// Cada página marca su sección en <body data-pagina="..."> para resaltar el ítem activo del menú.
import * as sesion from './sesion.js';
import * as auth from '../api/auth.js';
import { el, $, reemplazar } from './dom.js';

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

export function montar() {
    const actual = document.body.dataset.pagina || '';

    reemplazar($('#cabecera'),
        // Logo del manual de identidad (opción Violeta); el alt hace de nombre del enlace
        el('p', { class: 'marca' }, el('a', { href: 'index.html' },
            el('img', { src: 'img/logo.svg', alt: 'PawPrints, ir al inicio', width: 220, height: 75 }))),
        actual === 'inicio' ? el('p', { class: 'lema', text: 'Tu librería de siempre, ahora también online.' }) : null);

    reemplazar($('#menu'), menu(actual));

    reemplazar($('#pie'),
        el('address', {},
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
