// Alta de libros (permiso libros.crear, rol admin): POST /api/admin/portadas (si eligieron una tapa) y POST /api/admin/libros.
// Arriba del formulario, la búsqueda en Open Library lo completa con los datos del libro elegido.
import { montar, exigir } from '../servicios/layout.js';
import { el, $, reemplazar } from '../servicios/dom.js';
import { activar, conectarContadores, ponerError, sacarError } from '../servicios/formularios.js';
import { ZonaImagen } from '../componentes/zona-imagen.js';
import { ErrorApi } from '../api/cliente.js';
import * as admin from '../api/admin.js';

montar();

if (exigir({ permiso: 'libros.crear' })) {
    const form = $('#form-libro');
    const campoUrl = form.elements.imagen_url;
    conectarContadores(form);

    // Con una imagen elegida, la dirección no se usa: se deshabilita para que no haya dos tapas a la vez
    const zona = new ZonaImagen(form.elements.portada, {
        alCambiar: () => {
            campoUrl.disabled = zona.hayImagen();
            if (campoUrl.disabled) sacarError(campoUrl);
            // El error de la imagen (o su corrección) se muestra apenas se termina de revisar el archivo
            const control = form.elements.portada;
            if (zona.error) ponerError(control, zona.error);
            else sacarError(control);
        },
    });

    // Reglas que no se pueden escribir como atributos HTML
    const extra = () => ({ portada: zona.error });

    activar(form, async (f) => {
        let imagenUrl = campoUrl.disabled ? '' : campoUrl.value.trim();
        if (zona.hayImagen()) {
            let imagen;
            try {
                imagen = await zona.imagenParaSubir();
            } catch (error) {
                // Se muestra junto al campo, igual que un error de la API
                throw new ErrorApi(422, 'datos_invalidos', error.message, { portada: error.message });
            }
            imagenUrl = await admin.subirPortada(imagen);
        }
        const { libro } = await admin.crearLibro({
            titulo: f.elements.titulo.value.trim(),
            autor: f.elements.autor.value.trim(),
            genero: f.elements.genero.value,
            precio: Number(f.elements.precio.value),
            resumen: f.elements.resumen.value.trim(),
            descripcion: f.elements.descripcion.value.trim(),
            autor_bio: f.elements.autor_bio.value.trim(),
            imagen_url: imagenUrl,
        });
        window.location.href = `libro.html?id=${encodeURIComponent(libro.id)}`;
    }, { extra });

    // ---------- Autocompletar con Open Library ----------
    const formOl = $('#form-openlibrary');
    const estadoOl = $('#ol-estado');
    const listaOl = $('#ol-resultados');
    const botonOl = $('button[type="submit"]', formOl);

    formOl.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const texto = formOl.elements.q.value.trim();
        if (texto.length < 3) {
            estadoOl.textContent = 'Escribí al menos 3 caracteres: el ISBN, o el título y el autor.';
            return;
        }
        botonOl.disabled = true;
        estadoOl.textContent = 'Buscando en Open Library...';
        reemplazar(listaOl);
        try {
            const { items } = await admin.buscarEnOpenLibrary(texto);
            if (items.length === 0) {
                estadoOl.textContent = 'No encontramos ese libro en Open Library. Podés cargarlo a mano.';
            } else {
                estadoOl.textContent = `Encontramos ${items.length} resultado${items.length === 1 ? '' : 's'}. Elegí uno para completar el formulario.`;
            }
            reemplazar(listaOl, items.map(resultado));
        } catch (error) {
            estadoOl.textContent = error.message;
        } finally {
            botonOl.disabled = false;
        }
    });

    function resultado(item) {
        const datos = [item.titulo, item.autor, item.anio].filter(Boolean).join(' · ');
        return el('li', {}, el('button', { type: 'button', class: 'ol-resultado', onclick: () => usar(item) },
            item.portada ? el('img', { src: item.portada.replace('-L.jpg', '-S.jpg'), alt: '', width: 40, height: 60, loading: 'lazy' }) : null,
            el('span', { class: 'visualmente-oculto', text: 'Usar: ' }),
            datos));
    }

    // Completa el formulario con la obra elegida. Si no se pueden traer los datos completos,
    // se usan los de la búsqueda (título, autor y tapa).
    async function usar(item) {
        estadoOl.textContent = 'Trayendo los datos del libro...';
        let libro = { titulo: item.titulo, autor: item.autor, descripcion: '', autor_bio: '', portada: item.portada };
        try {
            const respuesta = await admin.obraDeOpenLibrary(item.clave);
            libro = respuesta.libro;
        } catch {
            // Sigue con los datos de la búsqueda
        }

        completar(form.elements.titulo, libro.titulo || item.titulo);
        completar(form.elements.autor, libro.autor || item.autor);
        completar(form.elements.descripcion, libro.descripcion);
        completar(form.elements.resumen, resumenDe(libro.descripcion));
        completar(form.elements.autor_bio, libro.autor_bio);
        // La tapa va en la dirección de la imagen, salvo que ya hayan elegido un archivo
        if (!zona.hayImagen()) completar(campoUrl, libro.portada || item.portada);

        reemplazar(listaOl);
        estadoOl.textContent = 'Listo: completamos los datos de Open Library. Revisalos, elegí el género y poné el precio antes de guardar.';
        form.elements.genero.focus();
    }

    // Pone el valor (si hay) y avisa del cambio, así se actualizan los contadores de caracteres
    function completar(control, valor) {
        if (!valor) return;
        control.value = valor.slice(0, control.maxLength > 0 ? control.maxLength : undefined);
        control.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // El resumen es el primer párrafo de la descripción, cortado en una palabra si pasa de 300 caracteres
    function resumenDe(descripcion) {
        const parrafo = (descripcion || '').split('\n')[0].trim();
        if (parrafo.length <= 300) return parrafo;
        const corte = parrafo.slice(0, 299);
        return `${corte.slice(0, corte.lastIndexOf(' '))}…`;
    }
}
