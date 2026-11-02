// Alta de libros (permiso libros.crear, rol admin): POST /api/admin/portadas (si eligieron una tapa) y POST /api/admin/libros.
import { montar, exigir } from '../servicios/layout.js';
import { $ } from '../servicios/dom.js';
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
}
