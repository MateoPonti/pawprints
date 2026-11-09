// Listado de pedidos (permiso reservas.ver: roles personal y admin): GET /api/admin/reservas?q=&page=
// La búsqueda y la página quedan en la URL (?q=ana&pagina=2) para poder recargar o compartir el enlace.
import { montar, exigir, anunciar } from '../servicios/layout.js';
import { el, $, reemplazar } from '../servicios/dom.js';
import { precio } from '../servicios/formato.js';
import * as admin from '../api/admin.js';

montar();

const fecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
});

if (exigir({ permiso: 'reservas.ver' })) {
    const form = $('#filtro-pedidos');
    const estado = $('#estado-pedidos');
    const zona = $('#pedidos');

    const consulta = new URLSearchParams(window.location.search);
    let texto = (consulta.get('q') || '').trim().slice(0, 80);
    let pagina = Math.max(1, parseInt(consulta.get('pagina'), 10) || 1);
    form.elements.q.value = texto;

    function escribirUrl() {
        const nueva = new URLSearchParams();
        if (texto) nueva.set('q', texto);
        if (pagina > 1) nueva.set('pagina', String(pagina));
        window.history.replaceState(null, '', `admin-reservas.html${nueva.toString() ? `?${nueva}` : ''}`);
    }

    function pedido(reserva) {
        return el('article', { class: 'pedido', 'aria-labelledby': `pedido-${reserva.id}` },
            el('h2', { id: `pedido-${reserva.id}` }, `Reserva #${reserva.id}`),
            el('p', {}, 'Fecha: ', el('time', { datetime: reserva.fecha }, fecha.format(new Date(reserva.fecha)))),
            el('p', {}, `Nombre: ${reserva.nombre}`),
            el('p', {}, 'Correo: ', el('a', { href: `mailto:${reserva.email}` }, reserva.email)),
            el('p', {}, `Teléfono: ${reserva.telefono || 'no informado'}`),
            el('table', {},
                el('caption', { class: 'visualmente-oculto', text: `Libros de la reserva ${reserva.id}` }),
                el('thead', {}, el('tr', {},
                    el('th', { scope: 'col', text: 'Libro' }),
                    el('th', { scope: 'col', text: 'Cantidad' }),
                    el('th', { scope: 'col', text: 'Precio c/u' }))),
                el('tbody', {}, reserva.items.map((item) => el('tr', {},
                    el('td', {}, el('a', { href: `libro.html?id=${encodeURIComponent(item.libro)}` }, item.titulo), ` (${item.autor})`),
                    el('td', { text: String(item.cantidad) }),
                    el('td', { text: precio(item.precio) }))))),
            el('p', {}, el('strong', { text: `Total: ${precio(reserva.total)}` })),
            // Si el correo al personal no salió, la reserva igual quedó guardada: se avisa para revisarla
            reserva.correo_enviado ? null : el('p', { class: 'aviso-suave', text: 'El correo de aviso de esta reserva no se pudo enviar.' }));
    }

    function paginacion(paginas) {
        if (paginas <= 1) return null;
        const boton = (n, textoBoton) => el('button', {
            type: 'button', class: 'boton-secundario boton-chico', onclick: () => { pagina = n; cargar(); },
        }, textoBoton);
        return el('nav', { class: 'paginacion', 'aria-label': 'Páginas de pedidos' }, el('ul', {},
            pagina > 1 ? el('li', {}, boton(pagina - 1, 'Anterior')) : null,
            el('li', {}, el('span', { 'aria-current': 'page' }, `Página ${pagina} de ${paginas}`)),
            pagina < paginas ? el('li', {}, boton(pagina + 1, 'Siguiente')) : null));
    }

    async function cargar() {
        escribirUrl();
        estado.textContent = 'Cargando pedidos...';
        try {
            const datos = await admin.listarReservas({ q: texto, page: pagina });
            if (datos.total === 0) {
                estado.textContent = texto ? 'No hay pedidos con esa búsqueda.' : 'Todavía no hay pedidos.';
                reemplazar(zona);
                return;
            }
            estado.textContent = `${datos.total} pedido${datos.total === 1 ? '' : 's'}.`;
            reemplazar(zona, datos.items.map(pedido), paginacion(datos.paginas));
            anunciar(estado.textContent);
        } catch (error) {
            estado.textContent = error.message;
            reemplazar(zona);
        }
    }

    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        texto = form.elements.q.value.trim();
        pagina = 1;
        cargar();
    });

    cargar();
}
