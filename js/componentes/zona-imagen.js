// Zona para cargar una imagen arrastrándola o eligiéndola desde el equipo (tapas de los libros).
//
// Uso: new ZonaImagen(input) con un <input type="file" accept="..."> dentro de un .campo.
// El input sigue siendo el control real: se puede usar con teclado y lector de pantalla, y lo que se suelta
// en la zona se copia al input, así el formulario lo valida igual que si se hubiera elegido con el botón.
//
// Antes de subirla, la imagen se achica en el navegador con un <canvas> (como máximo ANCHO_MAX x ALTO_MAX)
// y se convierte a WebP: una foto de varios MB queda en unos KB, la subida es rápida y el back no procesa nada.
import { el } from '../servicios/dom.js';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;   // del archivo original; después de achicarla queda muy por debajo de 1 MB
const ANCHO_MAX = 600;
const ALTO_MAX = 900;
const ANCHO_MIN = 100;
const ALTO_MIN = 150;

const tamanio = (bytes) => (bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

// Si se suelta un archivo fuera de la zona, el navegador lo abriría en la pestaña y se perdería lo cargado
let paginaProtegida = false;
function protegerPagina() {
    if (paginaProtegida) return;
    paginaProtegida = true;
    ['dragover', 'drop'].forEach((tipo) => window.addEventListener(tipo, (evento) => {
        if (evento.dataTransfer?.types.includes('Files')) evento.preventDefault();
    }));
}

export class ZonaImagen {
    constructor(input, { alCambiar } = {}) {
        this.input = input;
        this.alCambiar = alCambiar || (() => {});
        this.imagen = null;    // la imagen ya decodificada (para medirla y achicarla)
        this.error = '';
        this.cargando = null;  // promesa mientras se decodifica

        this.vista = el('div', { class: 'zona-vista', hidden: true });
        this.zona = el('div', { class: 'zona-imagen' },
            el('p', { class: 'zona-texto', 'aria-hidden': 'true' },
                el('span', { class: 'zona-icono', text: '⇪' }),
                'Arrastrá la tapa hasta acá'),
            el('p', { class: 'zona-o', 'aria-hidden': 'true', text: 'o' }));
        // El input se oculta visualmente y su <label class="zona-boton"> hace de botón "Elegir imagen"
        input.classList.add('visualmente-oculto');
        input.before(this.zona);
        this.boton = el('label', { for: input.id, class: 'zona-boton' }, 'Elegir imagen');
        this.zona.append(input, this.boton, this.vista);

        protegerPagina();
        this.conectarArrastre();
        input.addEventListener('change', () => this.elegir(input.files[0] || null));
    }

    conectarArrastre() {
        let dentro = 0;   // dragenter/dragleave se disparan también al pasar por los hijos de la zona
        const marcar = (activo) => this.zona.classList.toggle('arrastrando', activo);

        this.zona.addEventListener('dragenter', (evento) => {
            if (!evento.dataTransfer.types.includes('Files')) return;
            evento.preventDefault();
            dentro += 1;
            marcar(true);
        });
        this.zona.addEventListener('dragover', (evento) => {
            if (!evento.dataTransfer.types.includes('Files')) return;
            evento.preventDefault();
            evento.dataTransfer.dropEffect = 'copy';
        });
        this.zona.addEventListener('dragleave', () => {
            dentro = Math.max(0, dentro - 1);
            if (dentro === 0) marcar(false);
        });
        this.zona.addEventListener('drop', (evento) => {
            evento.preventDefault();
            dentro = 0;
            marcar(false);
            const archivo = evento.dataTransfer.files[0];
            if (!archivo) return;
            // Se copia al input para que el formulario lo vea; si el navegador no lo permite, se usa igual
            try {
                const transferencia = new DataTransfer();
                transferencia.items.add(archivo);
                this.input.files = transferencia.files;
            } catch {
                // Navegadores viejos: el archivo queda solo en el componente
            }
            this.input.dataset.tocado = 'true';
            this.elegir(archivo);
        });
    }

    // Revisa el archivo elegido y muestra la vista previa
    elegir(archivo) {
        this.archivo = archivo;
        this.imagen = null;
        this.error = '';
        this.vista.hidden = true;
        this.zona.classList.remove('con-imagen');
        this.boton.textContent = 'Elegir imagen';

        if (!archivo) {
            this.cargando = null;
            this.alCambiar();
            return;
        }
        if (!TIPOS.includes(archivo.type)) {
            this.error = 'La tapa tiene que ser una imagen JPG, PNG o WebP.';
        } else if (archivo.size > MAX_BYTES) {
            this.error = `La imagen pesa ${tamanio(archivo.size)}: puede pesar hasta ${tamanio(MAX_BYTES)}.`;
        }
        if (this.error) {
            this.cargando = null;
            this.alCambiar();
            return;
        }

        const url = URL.createObjectURL(archivo);
        const imagen = new Image();
        imagen.alt = '';
        this.cargando = new Promise((resolver) => {
            imagen.onload = () => {
                // Si mientras tanto eligieron otro archivo, esta imagen ya no importa
                if (this.archivo !== archivo) {
                    URL.revokeObjectURL(url);
                    resolver();
                    return;
                }
                if (imagen.naturalWidth < ANCHO_MIN || imagen.naturalHeight < ALTO_MIN) {
                    URL.revokeObjectURL(url);
                    this.error = `La imagen es muy chica (${imagen.naturalWidth}x${imagen.naturalHeight} píxeles): `
                        + `tiene que medir al menos ${ANCHO_MIN}x${ALTO_MIN}.`;
                } else {
                    this.imagen = imagen;
                    this.mostrarVista(archivo, imagen, url);
                }
                resolver();
            };
            imagen.onerror = () => {
                URL.revokeObjectURL(url);
                if (this.archivo === archivo) this.error = 'No pudimos leer la imagen: puede estar dañada.';
                resolver();
            };
        }).then(() => this.alCambiar());
        imagen.src = url;
    }

    mostrarVista(archivo, imagen, url) {
        imagen.className = 'zona-miniatura';
        imagen.width = 120;
        imagen.height = Math.round(120 * imagen.naturalHeight / imagen.naturalWidth);
        this.vista.replaceChildren(
            imagen,
            el('div', {},
                el('p', { class: 'zona-nombre', text: archivo.name }),
                el('p', { class: 'ayuda', text: `${imagen.naturalWidth}x${imagen.naturalHeight} píxeles, ${tamanio(archivo.size)}` }),
                el('button', { type: 'button', class: 'boton-secundario', onclick: () => this.quitar() },
                    'Quitar imagen', el('span', { class: 'visualmente-oculto', text: ` ${archivo.name}` }))));
        this.vista.hidden = false;
        this.zona.classList.add('con-imagen');
        this.boton.textContent = 'Cambiar imagen';
        // La imagen ya está decodificada: el objeto URL no hace falta más
        URL.revokeObjectURL(url);
    }

    quitar() {
        this.input.value = '';
        this.elegir(null);
        this.input.focus();
    }

    hayImagen() {
        return Boolean(this.archivo);
    }

    // La imagen achicada, lista para subir (Blob WebP, o JPEG si el navegador no sabe generar WebP)
    async imagenParaSubir() {
        await this.cargando;
        if (this.error || !this.imagen) throw new Error(this.error || 'No hay imagen.');
        const escala = Math.min(1, ANCHO_MAX / this.imagen.naturalWidth, ALTO_MAX / this.imagen.naturalHeight);
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(this.imagen.naturalWidth * escala);
        lienzo.height = Math.round(this.imagen.naturalHeight * escala);
        const contexto = lienzo.getContext('2d');
        // Fondo blanco: las partes transparentes de un PNG no quedan negras al pasar a JPEG
        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, lienzo.width, lienzo.height);
        contexto.drawImage(this.imagen, 0, 0, lienzo.width, lienzo.height);

        const generar = (tipo) => new Promise((resolver) => lienzo.toBlob(resolver, tipo, 0.85));
        let blob = await generar('image/webp');
        if (!blob || blob.type !== 'image/webp') blob = await generar('image/jpeg');
        return blob;
    }
}
