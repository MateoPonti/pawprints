// Catálogo: búsqueda, filtros, orden y paginación hechos 100% en el navegador.
// Los libros se piden una sola vez a la API (son pocos); después todo se calcula acá, sin volver a pedir nada.
// El estado queda en la URL (?q=borges&orden=precio&sentido=desc&pagina=2), así se puede compartir, recargar
// y volver atrás. Las últimas 5 búsquedas se recuerdan en localStorage (ver servicios/historial.js).
import { montar, anunciar } from '../servicios/layout.js';
import { el, $, reemplazar } from '../servicios/dom.js';
import { precio, genero, GENEROS, portada } from '../servicios/formato.js';
import { mensajeDe, ponerError, sacarError } from '../servicios/formularios.js';
import * as libros from '../api/libros.js';
import * as historial from '../servicios/historial.js';

montar();

const form = $('#filtros');
const panel = $('#panel-filtros');
const resultados = $('#resultados');
const estado = $('#estado-resultados');
const tituloListado = $('#listado-titulo');
const celular = window.matchMedia('(max-width: 699px)');

const ORDENES = ['relevancia', 'titulo', 'autor', 'precio', 'genero'];
const POR_PAGINA = ['6', '12', '24', '48'];
const NOMBRE_ORDEN = { relevancia: 'Relevancia', titulo: 'Título', autor: 'Autor', precio: 'Precio', genero: 'Género' };
const INICIAL = {
    q: '', genero: '', precio_min: '', precio_max: '', orden: 'relevancia', sentido: 'asc', por_pagina: '6', modo: 'paginas',
};

let catalogo = [];           // todos los libros, tal como llegan de la API
let filtrados = [];          // después de buscar, filtrar y ordenar
let filtros = leerUrl();
let pagina = Math.max(1, parseInt(new URLSearchParams(window.location.search).get('pagina'), 10) || 1);
let mostrados = 0;           // en scroll infinito, cuántos libros hay en pantalla
let observador = null;

// ---------- Estado <-> URL <-> formulario ----------

function leerUrl() {
    const consulta = new URLSearchParams(window.location.search);
    const entero = (valor) => (/^\d{1,9}$/.test(valor || '') ? valor : '');
    return {
        q: (consulta.get('q') || '').trim().slice(0, 100),
        genero: GENEROS[consulta.get('genero')] ? consulta.get('genero') : '',
        precio_min: entero(consulta.get('precio_min')),
        precio_max: entero(consulta.get('precio_max')),
        orden: ORDENES.includes(consulta.get('orden')) ? consulta.get('orden') : INICIAL.orden,
        sentido: consulta.get('sentido') === 'desc' ? 'desc' : 'asc',
        por_pagina: POR_PAGINA.includes(consulta.get('por_pagina')) ? consulta.get('por_pagina') : INICIAL.por_pagina,
        modo: consulta.get('modo') === 'scroll' ? 'scroll' : 'paginas',
    };
}

// Solo van a la URL los valores distintos de los iniciales, para que quede corta
function escribirUrl({ nuevaEntrada = false } = {}) {
    const consulta = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
        if (valor !== INICIAL[clave]) consulta.set(clave, valor);
    });
    if (filtros.modo === 'paginas' && pagina > 1) consulta.set('pagina', String(pagina));
    const url = `catalogo.html${consulta.toString() ? `?${consulta}` : ''}`;
    if (nuevaEntrada) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
}

function llenarFormulario() {
    Object.entries(filtros).forEach(([nombre, valor]) => { form.elements[nombre].value = valor; });
    [form.elements.precio_min, form.elements.precio_max].forEach(sacarError);
    contarFiltrosActivos();
}

// Lee el formulario. Un precio inválido no se aplica (queda el último válido) y se muestra su error junto al campo.
function leerFormulario() {
    const minimo = form.elements.precio_min;
    const maximo = form.elements.precio_max;
    let rangoValido = true;
    [minimo, maximo].forEach((control) => {
        const mensaje = mensajeDe(control);
        if (mensaje) {
            ponerError(control, mensaje);
            rangoValido = false;
        } else {
            sacarError(control);
        }
    });
    if (rangoValido && minimo.value !== '' && maximo.value !== '' && Number(minimo.value) > Number(maximo.value)) {
        ponerError(maximo, 'El precio "hasta" tiene que ser mayor o igual que el precio "desde".');
        rangoValido = false;
    }

    filtros = {
        q: form.elements.q.value.trim(),
        genero: form.elements.genero.value,
        precio_min: rangoValido ? minimo.value : filtros.precio_min,
        precio_max: rangoValido ? maximo.value : filtros.precio_max,
        orden: form.elements.orden.value,
        sentido: form.elements.sentido.value,
        por_pagina: form.elements.por_pagina.value,
        modo: form.elements.modo.value,
    };
}

function contarFiltrosActivos() {
    const activos = ['genero', 'precio_min', 'precio_max', 'orden', 'sentido']
        .filter((clave) => filtros[clave] !== INICIAL[clave]).length;
    $('#filtros-activos').textContent = activos ? `(${activos} activo${activos === 1 ? '' : 's'})` : '';
}

// ---------- Buscar, filtrar y ordenar ----------

// "García Márquez" y "garcia marquez" tienen que dar lo mismo
const normalizar = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const comparador = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const CRITERIOS = {
    relevancia: (a, b) => a.posicion - b.posicion,
    titulo: (a, b) => comparador.compare(a.titulo, b.titulo),
    autor: (a, b) => comparador.compare(a.autor, b.autor),
    precio: (a, b) => a.precio - b.precio,
    genero: (a, b) => comparador.compare(genero(a.genero), genero(b.genero)),
};

function aplicar() {
    const palabras = normalizar(filtros.q).split(/\s+/).filter(Boolean);
    const minimo = filtros.precio_min === '' ? -Infinity : Number(filtros.precio_min);
    const maximo = filtros.precio_max === '' ? Infinity : Number(filtros.precio_max);
    const criterio = CRITERIOS[filtros.orden];
    const signo = filtros.sentido === 'desc' ? -1 : 1;

    filtrados = catalogo
        .filter((libro) => {
            // Cada palabra tiene que aparecer en el título o en el autor (en cualquier orden)
            const texto = normalizar(`${libro.titulo} ${libro.autor}`);
            return palabras.every((p) => texto.includes(p))
                && (!filtros.genero || libro.genero === filtros.genero)
                && libro.precio >= minimo && libro.precio <= maximo;
        })
        // A igual valor se desempata por título, siempre de la A a la Z
        .sort((a, b) => signo * criterio(a, b) || CRITERIOS.titulo(a, b));
}

// ---------- Pantalla ----------

function ficha(libro) {
    const detalle = `libro.html?id=${encodeURIComponent(libro.id)}`;
    return el('li', {},
        el('article', { 'aria-labelledby': `libro-${libro.id}-titulo` },
            el('img', { src: portada(libro), alt: `Portada de ${libro.titulo}`, width: 120, height: 180, loading: 'lazy' }),
            el('h3', { id: `libro-${libro.id}-titulo` }, el('a', { href: detalle }, libro.titulo)),
            el('p', {}, `Autor: ${libro.autor}`),
            el('p', {}, `Género: ${genero(libro.genero)}`),
            el('p', {}, 'Precio: ', el('data', { value: libro.precio }, precio(libro.precio))),
            el('p', { text: libro.resumen }),
            el('a', { class: 'btn', href: detalle }, 'Ver detalle',
                el('span', { class: 'visualmente-oculto', text: ` de ${libro.titulo}` }))));
}

function textoEstado(desde, hasta) {
    const total = filtrados.length;
    if (total === 0) return 'No hay libros con esa búsqueda.';
    return `Mostrando ${desde}-${hasta} de ${total} libro${total === 1 ? '' : 's'}`;
}

function dibujar({ anunciarCambio = true } = {}) {
    observador?.disconnect();
    const porPagina = Number(filtros.por_pagina);
    const total = filtrados.length;
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    // Una página que no existe (por ejemplo ?pagina=99 en un enlace viejo) se avisa y se muestra la última
    const aviso = $('#aviso-pagina');
    aviso.hidden = !(filtros.modo === 'paginas' && pagina > paginas);
    if (!aviso.hidden) {
        aviso.textContent = `La página ${pagina} no existe: te mostramos la ${paginas === 1 ? 'única' : `última (${paginas})`}.`;
        pagina = paginas;
        escribirUrl();
    }
    $('#descargar-csv').disabled = total === 0;
    $('#ver-resultados').textContent = total ? `Ver ${total} resultado${total === 1 ? '' : 's'}` : 'Ver resultados';

    if (total === 0) {
        estado.textContent = textoEstado();
        reemplazar(resultados, el('p', {}, 'No encontramos libros con esa búsqueda. ',
            el('button', { type: 'button', class: 'boton-secundario boton-chico', onclick: quitarFiltros }, 'Quitar los filtros')));
    } else if (filtros.modo === 'scroll') {
        mostrados = Math.min(porPagina, total);
        reemplazar(resultados, el('ul', { class: 'catalogo-lista', id: 'lista-libros' }, filtrados.slice(0, mostrados).map(ficha)));
        estado.textContent = textoEstado(1, mostrados);
        prepararScrollInfinito();
    } else {
        const desde = (pagina - 1) * porPagina;
        const hasta = Math.min(desde + porPagina, total);
        reemplazar(resultados,
            el('ul', { class: 'catalogo-lista' }, filtrados.slice(desde, hasta).map(ficha)),
            paginacion(paginas));
        estado.textContent = textoEstado(desde + 1, hasta);
    }
    if (anunciarCambio) anunciar(estado.textContent);
}

// Números de página con "…" cuando son muchas: 1 … 4 5 6 … 12. En el celular entran en una sola línea.
function numerosDePagina(paginas) {
    const visibles = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])]
        .filter((n) => n >= 1 && n <= paginas)
        .sort((a, b) => a - b);
    return visibles.flatMap((n, i) => (i > 0 && n - visibles[i - 1] > 1 ? ['…', n] : [n]));
}

function paginacion(paginas) {
    if (paginas <= 1) return null;
    const boton = (n, texto, extra = {}) => el('button', {
        type: 'button', class: 'boton-pagina', onclick: () => irAPagina(n), ...extra,
    }, texto);
    return el('nav', { class: 'paginacion', 'aria-label': 'Páginas del catálogo' }, el('ul', {},
        el('li', {}, pagina > 1
            ? boton(pagina - 1, 'Anterior', { 'aria-label': 'Página anterior' })
            : el('span', { 'aria-disabled': 'true' }, 'Anterior')),
        numerosDePagina(paginas).map((n) => el('li', {}, n === '…'
            ? el('span', { class: 'puntos', 'aria-hidden': 'true' }, '…')
            : n === pagina
                ? el('span', { 'aria-current': 'page', 'aria-label': `Página ${n}, página actual` }, n)
                : boton(n, n, { 'aria-label': `Ir a la página ${n}` }))),
        el('li', {}, pagina < paginas
            ? boton(pagina + 1, 'Siguiente', { 'aria-label': 'Página siguiente' })
            : el('span', { 'aria-disabled': 'true' }, 'Siguiente'))));
}

function irAPagina(n) {
    pagina = n;
    escribirUrl({ nuevaEntrada: true });
    dibujar();
    // Se vuelve al principio del listado, con el foco ahí para el teclado y el lector de pantalla
    tituloListado.focus();
    tituloListado.scrollIntoView({ block: 'start' });
}

// Scroll infinito: cuando el botón "Mostrar más" se acerca a la pantalla se cargan los libros siguientes.
// El botón también se puede usar a mano (teclado, o navegadores sin IntersectionObserver).
function prepararScrollInfinito() {
    if (mostrados >= filtrados.length) {
        resultados.append(el('p', { class: 'fin-listado', text: 'Llegaste al final del catálogo.' }));
        return;
    }
    const masLibros = el('button', { type: 'button', class: 'boton-secundario mas-libros', onclick: mostrarMas }, 'Mostrar más libros');
    resultados.append(masLibros);
    if ('IntersectionObserver' in window) {
        observador = new IntersectionObserver(([entrada]) => {
            if (entrada.isIntersecting) mostrarMas();
        }, { rootMargin: '300px 0px' });
        observador.observe(masLibros);
    }
}

function mostrarMas() {
    observador?.disconnect();
    $('.mas-libros', resultados)?.remove();
    const antes = mostrados;
    mostrados = Math.min(mostrados + Number(filtros.por_pagina), filtrados.length);
    $('#lista-libros').append(...filtrados.slice(antes, mostrados).map(ficha));
    estado.textContent = textoEstado(1, mostrados);
    anunciar(`Se agregaron ${mostrados - antes} libros. ${estado.textContent}`);
    prepararScrollInfinito();
}

// ---------- Descarga en CSV ----------

// Se descarga la vista actual: todos los libros que cumplen la búsqueda y los filtros, en el orden elegido
// (no solo la página en pantalla). Formato RFC 4180 con BOM, así Excel muestra bien los acentos.
function celdaCsv(valor) {
    let texto = String(valor ?? '');
    // Un texto que empieza con = + - @ lo ejecutaría Excel como fórmula
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargarCsv() {
    const filas = [
        ['id', 'titulo', 'autor', 'genero', 'precio', 'resumen'],
        ...filtrados.map((l) => [l.id, l.titulo, l.autor, genero(l.genero), l.precio, l.resumen]),
    ];
    const csv = `﻿${filas.map((fila) => fila.map(celdaCsv).join(',')).join('\r\n')}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = el('a', { href: url, download: `catalogo-pawprints-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    anunciar(`Se descargó el catálogo con ${filtrados.length} libro${filtrados.length === 1 ? '' : 's'}.`);
}

// ---------- Búsquedas recientes (localStorage) ----------

// Una búsqueda guardada son solo los criterios (no cómo se muestran ni la página)
function busquedaActual() {
    const { q, genero: g, precio_min: min, precio_max: max, orden, sentido } = filtros;
    return { q, genero: g, precio_min: min, precio_max: max, orden, sentido };
}

const esBusquedaVacia = (b) => Object.entries(b).every(([clave, valor]) => valor === INICIAL[clave]);

function describir(b) {
    const partes = [];
    if (b.q) partes.push(`"${b.q}"`);
    if (b.genero) partes.push(genero(b.genero));
    if (b.precio_min && b.precio_max) partes.push(`${precio(b.precio_min)} a ${precio(b.precio_max)}`);
    else if (b.precio_min) partes.push(`desde ${precio(b.precio_min)}`);
    else if (b.precio_max) partes.push(`hasta ${precio(b.precio_max)}`);
    if (b.orden !== 'relevancia' || b.sentido !== 'asc') {
        partes.push(`${NOMBRE_ORDEN[b.orden]} ${b.sentido === 'desc' ? 'descendente' : 'ascendente'}`);
    }
    return partes.join(' · ');
}

function recordarBusqueda() {
    const busqueda = busquedaActual();
    if (esBusquedaVacia(busqueda)) return;
    historial.guardar(busqueda);
    dibujarHistorial();
}

function dibujarHistorial() {
    const lista = historial.listar();
    $('#historial').hidden = lista.length === 0;
    reemplazar($('#historial-lista'), lista.map((b) => el('li', {},
        el('button', {
            type: 'button',
            class: 'busqueda-reciente',
            onclick: () => usarBusqueda(b),
        }, el('span', { class: 'visualmente-oculto', text: 'Repetir la búsqueda: ' }), describir(b)))));
}

function usarBusqueda(b) {
    // Se toman solo las claves conocidas: lo guardado podría haber sido editado a mano
    filtros = { ...filtros, ...Object.fromEntries(Object.keys(b).filter((k) => k in INICIAL).map((k) => [k, String(b[k] ?? '')])) };
    if (!ORDENES.includes(filtros.orden)) filtros.orden = INICIAL.orden;
    pagina = 1;
    llenarFormulario();
    escribirUrl({ nuevaEntrada: true });
    aplicar();
    dibujar();
    recordarBusqueda();
}

// ---------- Eventos ----------

let espera = null;
function actualizar({ demora = 0 } = {}) {
    window.clearTimeout(espera);
    espera = window.setTimeout(() => {
        leerFormulario();
        pagina = 1;
        contarFiltrosActivos();
        escribirUrl();
        aplicar();
        dibujar();
    }, demora);
}

function quitarFiltros() {
    filtros = { ...INICIAL, por_pagina: filtros.por_pagina, modo: filtros.modo };
    pagina = 1;
    llenarFormulario();
    escribirUrl();
    aplicar();
    dibujar();
    form.elements.q.focus();
}

function conectar() {
    // Mientras se escribe se espera un momento para no recalcular con cada tecla
    form.addEventListener('input', (evento) => {
        const esTexto = evento.target.type === 'search' || evento.target.type === 'number';
        actualizar({ demora: esTexto ? 250 : 0 });
    });
    form.addEventListener('change', (evento) => {
        if (evento.target.tagName === 'SELECT') actualizar();
    });
    // Terminar de escribir la búsqueda (Enter o salir del campo) la guarda en las recientes
    form.elements.q.addEventListener('change', () => {
        leerFormulario();
        recordarBusqueda();
    });

    // Enter o "Buscar" / "Ver resultados": aplica, guarda la búsqueda y en el celular cierra el panel
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        window.clearTimeout(espera);
        leerFormulario();
        pagina = 1;
        escribirUrl();
        aplicar();
        dibujar();
        recordarBusqueda();
        if (celular.matches && panel.open) {
            panel.open = false;
            tituloListado.focus();
            tituloListado.scrollIntoView({ block: 'start' });
        }
    });

    $('#quitar-filtros').addEventListener('click', quitarFiltros);
    $('#descargar-csv').addEventListener('click', descargarCsv);
    $('#historial-borrar').addEventListener('click', () => {
        historial.borrar();
        dibujarHistorial();
        anunciar('Se borraron las búsquedas recientes.');
        form.elements.q.focus();
    });

    // Atrás / adelante del navegador
    window.addEventListener('popstate', () => {
        filtros = leerUrl();
        pagina = Math.max(1, parseInt(new URLSearchParams(window.location.search).get('pagina'), 10) || 1);
        llenarFormulario();
        aplicar();
        dibujar();
    });

    // En el celular el panel arranca cerrado para que los libros se vean enseguida; en pantallas anchas, abierto
    panel.open = !celular.matches;
    celular.addEventListener('change', () => { panel.open = !celular.matches; });
}

// ---------- Carga inicial ----------

// La API entrega como mucho 100 libros por pedido: si hubiera más, se piden las páginas que falten
async function traerTodos() {
    const primera = await libros.listar({ per_page: 100, page: 1 });
    const resto = await Promise.all(Array.from({ length: primera.paginas - 1 },
        (_, i) => libros.listar({ per_page: 100, page: i + 2 })));
    return [primera, ...resto].flatMap((r) => r.items)
        .map((libro, posicion) => ({ ...libro, precio: Number(libro.precio), posicion }));
}

async function cargar() {
    resultados.setAttribute('aria-busy', 'true');
    estado.textContent = 'Cargando libros...';
    reemplazar(resultados);
    try {
        catalogo = await traerTodos();
        aplicar();
        dibujar({ anunciarCambio: false });
    } catch (error) {
        estado.textContent = '';
        reemplazar(resultados, el('div', { class: 'aviso aviso-error', role: 'alert' },
            el('p', {}, el('span', { class: 'error-icono', 'aria-hidden': 'true', text: '!' }),
                el('span', { class: 'visualmente-oculto', text: 'Error: ' }), error.message),
            el('p', {}, el('button', { type: 'button', class: 'boton-secundario', onclick: cargar }, 'Reintentar'))));
    } finally {
        resultados.setAttribute('aria-busy', 'false');
    }
}

llenarFormulario();
dibujarHistorial();
conectar();
cargar();
