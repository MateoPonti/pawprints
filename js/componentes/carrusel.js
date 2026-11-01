// Carrusel de imágenes reutilizable.
//
// Uso: new Carrusel(contenedor), donde el contenedor tiene adentro las <img> (con su alt). Es el único parámetro;
// lo demás se puede ajustar con atributos opcionales del contenedor:
//   data-efecto="deslizar|desvanecer|zoom|voltear"   efecto inicial (se puede cambiar desde el propio carrusel)
//   data-intervalo="5000"                              milisegundos entre imagen e imagen
//   aria-label="..."                                   nombre del carrusel para el lector de pantalla
//
// Qué hace:
// - Muestra una barra con el porcentaje descargado de las imágenes; al llegar a 100% arranca el pase automático.
// - Se pasa de imagen con los botones, las miniaturas, deslizando el dedo (o el mouse) y con las flechas del teclado.
// - Funciona dentro del contenedor o en pantalla completa; las imágenes se redimensionan para entrar enteras.
// - El pase automático se puede pausar, y se detiene solo al pasar el mouse, al enfocarlo o si la pestaña no se ve.
import { el } from '../servicios/dom.js';

const DURACION = 600;
const DESLIZAMIENTO_MIN = 50;   // píxeles que hay que arrastrar para que cuente como swipe

// Cada efecto devuelve los keyframes (Web Animations API) de la imagen que entra y la que sale.
// sentido: 1 = hacia adelante, -1 = hacia atrás
const EFECTOS = {
    deslizar: {
        nombre: 'Deslizar',
        cuadros: (sentido) => ({
            entra: [{ transform: `translateX(${100 * sentido}%)` }, { transform: 'translateX(0)' }],
            sale: [{ transform: 'translateX(0)' }, { transform: `translateX(${-100 * sentido}%)` }],
        }),
    },
    desvanecer: {
        nombre: 'Desvanecer',
        cuadros: () => ({
            entra: [{ opacity: 0 }, { opacity: 1 }],
            sale: [{ opacity: 1 }, { opacity: 0 }],
        }),
    },
    zoom: {
        nombre: 'Zoom',
        cuadros: () => ({
            entra: [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(1)' }],
            sale: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.7)' }],
        }),
    },
    voltear: {
        nombre: 'Voltear',
        // La que sale gira hasta quedar de canto en la primera mitad; la que entra aparece de canto y termina de girar
        cuadros: (sentido) => ({
            entra: [
                { transform: `perspective(1200px) rotateY(${-90 * sentido}deg)`, opacity: 0 },
                { transform: `perspective(1200px) rotateY(${-90 * sentido}deg)`, opacity: 0, offset: 0.5 },
                { transform: 'perspective(1200px) rotateY(0)', opacity: 1 },
            ],
            sale: [
                { transform: 'perspective(1200px) rotateY(0)', opacity: 1 },
                { transform: `perspective(1200px) rotateY(${90 * sentido}deg)`, opacity: 0, offset: 0.5 },
                { transform: `perspective(1200px) rotateY(${90 * sentido}deg)`, opacity: 0 },
            ],
        }),
    },
};

let cantidad = 0;   // para generar ids únicos si hay más de un carrusel en la página

export class Carrusel {
    constructor(contenedor) {
        this.raiz = contenedor;
        this.imagenes = [...contenedor.querySelectorAll('img')];
        if (this.imagenes.length === 0) return;

        cantidad += 1;
        this.id = `carrusel-${cantidad}`;
        this.actual = 0;
        this.efecto = EFECTOS[contenedor.dataset.efecto] ? contenedor.dataset.efecto : 'deslizar';
        this.intervalo = Number(contenedor.dataset.intervalo) || 5000;
        this.listo = false;
        this.pausado = false;        // pausa elegida por el usuario con el botón
        this.detenido = false;       // pausa momentánea (mouse encima, foco adentro, pestaña oculta)
        this.temporizador = null;
        this.animaciones = [];
        this.visible = true;
        this.sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.armar();
        this.conectar();
        this.cargarImagenes();
    }

    // ---------- Estructura ----------

    armar() {
        const total = this.imagenes.length;
        this.raiz.classList.add('carrusel');
        this.raiz.setAttribute('aria-roledescription', 'carrusel');
        if (!this.raiz.hasAttribute('aria-label')) this.raiz.setAttribute('aria-label', 'Galería de imágenes');

        this.diapositivas = this.imagenes.map((imagen, i) => {
            imagen.draggable = false;
            imagen.decoding = 'async';
            return el('div', {
                class: `carrusel-diapositiva${i === 0 ? ' activa' : ''}`,
                role: 'group',
                'aria-roledescription': 'diapositiva',
                'aria-label': `${i + 1} de ${total}`,
                'aria-hidden': i === 0 ? false : 'true',
            }, imagen);
        });

        this.porcentaje = el('span', { class: 'carrusel-porcentaje', text: '0%' });
        this.relleno = el('span', { class: 'carrusel-relleno' });
        this.carga = el('div', {
            class: 'carrusel-carga',
            role: 'progressbar',
            'aria-label': 'Descarga de las imágenes',
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': 0,
        }, el('span', { class: 'carrusel-pista' }, this.relleno),
        el('span', { class: 'carrusel-carga-texto' }, 'Cargando imágenes... ', this.porcentaje));

        this.escenario = el('div', { class: 'carrusel-escenario', id: `${this.id}-escenario`, 'aria-live': 'off' },
            this.diapositivas);

        this.botonAnterior = el('button', { type: 'button', class: 'carrusel-flecha anterior', 'aria-controls': this.escenario.id },
            el('span', { 'aria-hidden': 'true', text: '‹' }), el('span', { class: 'visualmente-oculto', text: 'Imagen anterior' }));
        this.botonSiguiente = el('button', { type: 'button', class: 'carrusel-flecha siguiente', 'aria-controls': this.escenario.id },
            el('span', { 'aria-hidden': 'true', text: '›' }), el('span', { class: 'visualmente-oculto', text: 'Imagen siguiente' }));

        this.botonPausa = el('button', { type: 'button', class: 'boton-secundario carrusel-pausa' }, 'Pausar');
        this.selectorEfecto = el('select', { id: `${this.id}-efecto` },
            Object.entries(EFECTOS).map(([clave, { nombre }]) =>
                el('option', { value: clave, selected: clave === this.efecto }, nombre)));
        this.botonPantalla = el('button', { type: 'button', class: 'boton-secundario carrusel-pantalla' }, 'Pantalla completa');
        this.contador = el('p', { class: 'carrusel-contador', 'aria-hidden': 'true' });

        this.miniaturas = el('div', { class: 'carrusel-miniaturas', role: 'group', 'aria-label': 'Elegir imagen' },
            this.imagenes.map((imagen, i) => el('button', {
                type: 'button',
                class: 'carrusel-miniatura',
                'aria-label': `Ver imagen ${i + 1}: ${imagen.alt}`,
                'aria-current': i === 0 ? 'true' : false,
                onclick: () => this.ir(i, { anunciar: true }),
            }, el('img', { src: imagen.getAttribute('src'), alt: '', width: 96, height: 54, draggable: 'false' }))));

        this.anuncio = el('p', { class: 'visualmente-oculto', 'aria-live': 'polite' });

        this.raiz.replaceChildren(
            this.carga,
            el('div', { class: 'carrusel-marco' }, this.escenario, this.botonAnterior, this.botonSiguiente),
            el('div', { class: 'carrusel-barra' },
                this.contador,
                this.botonPausa,
                el('label', { class: 'carrusel-efecto', for: this.selectorEfecto.id }, 'Efecto ', this.selectorEfecto),
                this.botonPantalla),
            this.miniaturas,
            this.anuncio);
        this.raiz.classList.add('cargando');
        this.actualizarContador();
    }

    // ---------- Eventos ----------

    conectar() {
        this.botonAnterior.addEventListener('click', () => this.anterior({ anunciar: true }));
        this.botonSiguiente.addEventListener('click', () => this.siguiente({ anunciar: true }));
        this.botonPausa.addEventListener('click', () => this.alternarPausa());
        this.botonPantalla.addEventListener('click', () => this.alternarPantallaCompleta());
        this.selectorEfecto.addEventListener('change', () => { this.efecto = this.selectorEfecto.value; });

        // Flechas del teclado: funcionan si el foco está en el carrusel, o en cualquier lado de la página mientras
        // el carrusel se ve (salvo que se esté escribiendo en un campo)
        document.addEventListener('keydown', (evento) => this.teclado(evento));
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(([entrada]) => { this.visible = entrada.isIntersecting; }, { threshold: 0.5 })
                .observe(this.raiz);
        }

        this.conectarDeslizamiento();

        // Pausa momentánea: con el mouse encima, con el foco adentro o con la pestaña oculta
        const detener = (valor) => () => { this.detenido = valor; this.programar(); };
        this.raiz.addEventListener('mouseenter', detener(true));
        this.raiz.addEventListener('mouseleave', detener(false));
        this.raiz.addEventListener('focusin', detener(true));
        this.raiz.addEventListener('focusout', (evento) => {
            if (!this.raiz.contains(evento.relatedTarget)) detener(false)();
        });
        document.addEventListener('visibilitychange', () => {
            this.detenido = document.hidden;
            this.programar();
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && this.raiz.classList.contains('pantalla-completa')) this.salirPantallaCompleta();
        });
    }

    teclado(evento) {
        const enCampo = evento.target.closest?.('input, select, textarea, [contenteditable="true"]');
        const adentro = this.raiz.contains(evento.target);
        const pantalla = this.raiz.classList.contains('pantalla-completa');
        if (enCampo || !(adentro || pantalla || this.visible)) return;

        const acciones = {
            ArrowLeft: () => this.anterior({ anunciar: true }),
            ArrowRight: () => this.siguiente({ anunciar: true }),
            Home: () => this.ir(0, { anunciar: true }),
            End: () => this.ir(this.imagenes.length - 1, { anunciar: true }),
            Escape: () => this.salirPantallaCompleta(),
        };
        // Inicio y Fin solo dentro del carrusel, para no robarle a la página esas teclas
        if ((evento.key === 'Home' || evento.key === 'End') && !adentro && !pantalla) return;
        if (evento.key === 'Escape' && !pantalla) return;
        if (!acciones[evento.key]) return;
        evento.preventDefault();
        acciones[evento.key]();
    }

    // Swipe con Pointer Events: sirve igual para el dedo, el lápiz y el mouse
    conectarDeslizamiento() {
        let inicio = null;
        this.escenario.addEventListener('pointerdown', (evento) => {
            if (evento.button !== 0) return;
            inicio = { x: evento.clientX, y: evento.clientY };
        });
        this.escenario.addEventListener('pointerup', (evento) => {
            if (!inicio) return;
            const dx = evento.clientX - inicio.x;
            const dy = evento.clientY - inicio.y;
            inicio = null;
            // Solo cuenta si el movimiento es más horizontal que vertical (si no, el usuario quería scrollear)
            if (Math.abs(dx) < DESLIZAMIENTO_MIN || Math.abs(dx) < Math.abs(dy)) return;
            if (dx < 0) this.siguiente({ anunciar: true });
            else this.anterior({ anunciar: true });
        });
        this.escenario.addEventListener('pointercancel', () => { inicio = null; });
    }

    // ---------- Descarga de imágenes y barra de progreso ----------

    // Se descarga cada imagen con fetch leyendo de a pedazos, así se sabe cuántos bytes llegaron de cada una.
    // Si el servidor no informa el tamaño (o no deja leerla por CORS), esa imagen cuenta recién al terminar.
    async cargarImagenes() {
        const progreso = this.imagenes.map(() => 0);   // de 0 a 1 por imagen
        const actualizar = () => {
            const total = Math.round(progreso.reduce((a, b) => a + b, 0) / progreso.length * 100);
            this.mostrarProgreso(total);
        };

        await Promise.all(this.imagenes.map(async (imagen, i) => {
            const url = imagen.getAttribute('src');
            try {
                const respuesta = await fetch(url);
                if (!respuesta.ok || !respuesta.body) throw new Error(`HTTP ${respuesta.status}`);
                const largo = Number(respuesta.headers.get('Content-Length')) || 0;
                const lector = respuesta.body.getReader();
                const pedazos = [];
                let recibidos = 0;
                for (;;) {
                    const { done, value } = await lector.read();
                    if (done) break;
                    pedazos.push(value);
                    recibidos += value.length;
                    if (largo) {
                        progreso[i] = Math.min(recibidos / largo, 0.99);
                        actualizar();
                    }
                }
                const tipo = respuesta.headers.get('Content-Type') || '';
                imagen.src = URL.createObjectURL(new Blob(pedazos, { type: tipo }));
            } catch {
                // Sin acceso a los bytes: se espera abajo a que el navegador la cargue por su cuenta
            }
            await this.esperarImagen(imagen);
            progreso[i] = 1;
            actualizar();
        }));

        this.listo = true;
        this.raiz.classList.remove('cargando');
        this.programar();
    }

    esperarImagen(imagen) {
        if (imagen.complete) return Promise.resolve();
        return new Promise((resolver) => {
            imagen.addEventListener('load', resolver, { once: true });
            // Una imagen rota no frena al resto: se muestra el texto alternativo
            imagen.addEventListener('error', () => { imagen.classList.add('rota'); resolver(); }, { once: true });
        });
    }

    mostrarProgreso(valor) {
        this.relleno.style.width = `${valor}%`;
        this.porcentaje.textContent = `${valor}%`;
        this.carga.setAttribute('aria-valuenow', valor);
        if (valor === 100) this.carga.setAttribute('aria-valuetext', 'Imágenes cargadas');
    }

    // ---------- Navegación ----------

    siguiente(opciones) {
        this.ir((this.actual + 1) % this.imagenes.length, { ...opciones, sentido: 1 });
    }

    anterior(opciones) {
        this.ir((this.actual - 1 + this.imagenes.length) % this.imagenes.length, { ...opciones, sentido: -1 });
    }

    ir(indice, { anunciar = false, sentido } = {}) {
        if (indice === this.actual) return;
        // Si todavía se está animando el pase anterior, se termina de golpe antes de empezar el nuevo
        this.animaciones.forEach((a) => a.finish());

        const sale = this.diapositivas[this.actual];
        const entra = this.diapositivas[indice];
        const direccion = sentido || (indice > this.actual ? 1 : -1);
        this.actual = indice;

        sale.classList.remove('activa');
        sale.setAttribute('aria-hidden', 'true');
        entra.classList.add('activa');
        entra.removeAttribute('aria-hidden');

        if (!this.sinMovimiento && typeof entra.animate === 'function') {
            const { entra: cuadrosEntra, sale: cuadrosSale } = EFECTOS[this.efecto].cuadros(direccion);
            const opciones = { duration: DURACION, easing: 'ease-in-out' };
            sale.classList.add('saliendo');
            const animSale = sale.animate(cuadrosSale, opciones);
            const animEntra = entra.animate(cuadrosEntra, opciones);
            this.animaciones = [animSale, animEntra];
            animSale.finished.catch(() => {}).finally(() => sale.classList.remove('saliendo'));
        }

        [...this.miniaturas.children].forEach((boton, i) => {
            if (i === indice) boton.setAttribute('aria-current', 'true');
            else boton.removeAttribute('aria-current');
        });
        this.mostrarMiniatura(indice);
        this.actualizarContador();
        if (anunciar) this.anuncio.textContent = `Imagen ${indice + 1} de ${this.imagenes.length}: ${this.imagenes[indice].alt}`;
        this.programar();
    }

    // Lleva la miniatura activa a la vista dentro de su fila, sin mover el scroll de la página
    mostrarMiniatura(indice) {
        const boton = this.miniaturas.children[indice];
        const fila = this.miniaturas;
        const izquierda = boton.offsetLeft - fila.offsetLeft;
        if (izquierda < fila.scrollLeft || izquierda + boton.offsetWidth > fila.scrollLeft + fila.clientWidth) {
            fila.scrollTo({ left: izquierda - (fila.clientWidth - boton.offsetWidth) / 2, behavior: this.sinMovimiento ? 'auto' : 'smooth' });
        }
    }

    actualizarContador() {
        this.contador.textContent = `${this.actual + 1} / ${this.imagenes.length}`;
    }

    // ---------- Pase automático ----------

    programar() {
        window.clearTimeout(this.temporizador);
        if (!this.listo || this.pausado || this.detenido || this.imagenes.length < 2) return;
        this.temporizador = window.setTimeout(() => this.siguiente(), this.intervalo);
    }

    alternarPausa() {
        this.pausado = !this.pausado;
        this.botonPausa.textContent = this.pausado ? 'Reproducir' : 'Pausar';
        this.programar();
    }

    // ---------- Pantalla completa ----------

    // Se usa la Fullscreen API cuando existe; si no (por ejemplo en iPhone), la clase sola ocupa todo el viewport
    alternarPantallaCompleta() {
        if (this.raiz.classList.contains('pantalla-completa')) {
            this.salirPantallaCompleta();
            return;
        }
        this.raiz.classList.add('pantalla-completa');
        document.documentElement.classList.add('sin-scroll');
        this.botonPantalla.textContent = 'Salir de pantalla completa';
        this.raiz.requestFullscreen?.().catch(() => {});
        this.botonPantalla.focus();
    }

    salirPantallaCompleta() {
        if (!this.raiz.classList.contains('pantalla-completa')) return;
        this.raiz.classList.remove('pantalla-completa');
        document.documentElement.classList.remove('sin-scroll');
        this.botonPantalla.textContent = 'Pantalla completa';
        if (document.fullscreenElement === this.raiz) document.exitFullscreen().catch(() => {});
    }
}
