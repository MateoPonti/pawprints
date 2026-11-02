// Administración del catálogo (el back exige la sesión de un usuario con rol admin y el token CSRF).
import { post, subir, urlDeApi } from './cliente.js';

// → {libro} (201)
export const crearLibro = (libro) => post('/api/admin/libros', libro);

// imagen: Blob JPG, PNG o WebP de hasta 1 MB → dirección completa de la portada guardada
export async function subirPortada(imagen) {
    const { portada } = await subir('/api/admin/portadas', imagen);
    return urlDeApi(portada.url);
}
