# PawPrints - front-end

Sitio web de la librería PawPrints. Programación en Ambiente Web (11086), Comisión 50, UNLu.

Integrantes: Federico Kasparian, Justino Bernal, Lautaro Marino y Mateo Ponti. Los legajos están en `autores.txt` y la versión en `VERSION`.

- **Sitio publicado (Vercel):** https://pawprints-sigma.vercel.app

Sitio de la librería PawPrints en HTML, CSS y JavaScript nativo, sin frameworks. Consume la API JSON del back (`Backend`): pide los datos con `fetch` y arma las pantallas en el navegador.

## Cómo probarlo

Los scripts son módulos ES, así que hay que servir la carpeta por HTTP (abrir el archivo con doble clic no funciona):

```
python3 -m http.server 5500      # o la extensión Live Server de VS Code
```

Abrir `http://localhost:5500`. Por defecto el sitio usa el back publicado, así que alcanza con eso.

### Probar con el back local

1. Levantar el back (`php -S localhost:8000 -t public public/index.php` en su carpeta) con el `.env` del back en `APP_ENV=development` (así acepta cualquier puerto de localhost).
2. Copiar `js/api/config.local.example.js` como `js/api/config.local.js`. Ese archivo está en el `.gitignore`: no se sube al repo.
3. Recargar. Para volver al back publicado, borrar `config.local.js`.

## Conexión con el back

- **Dirección de la API** (`js/api/config.js`): por defecto es `PRODUCCION`, el back publicado, así que el sitio publicado (rama `main`) siempre apunta bien sin tocar nada. `config.local.js` solo se carga al abrir el front en `localhost` o `127.0.0.1`: en cualquier otro dominio se ignora, aunque exista.
- **Por qué no es un `.env`:** el front es estático y el navegador no puede leer un `.env`. El equivalente es `config.local.js` (local, no se sube) con `config.local.example.js` como plantilla (se sube).
- **Sesión:** `POST /api/login` devuelve un token JWT. Se guarda en `sessionStorage` y viaja en cada pedido como `Authorization: Bearer <token>`. Salir es descartar el token. No hay cookies ni CSRF.
- **CORS:** el back solo acepta los orígenes de su variable `FRONT_URL`; ahí va la dirección donde se publica el front.
- **Errores:** la API responde `{"error", "mensaje", "errores": {campo: mensaje}}`. Los errores por campo (422) se muestran junto a cada campo, igual que la validación del navegador. Si no se puede conectar (por ejemplo, el servidor está arrancando), el mensaje es genérico y se ofrece reintentar.

## Qué endpoints usa cada página

| Página | Endpoint | Pantalla |
|---|---|---|
| `index.html` | `GET /api/libros?per_page=3` | Inicio con carrusel de novedades y libros destacados |
| `catalogo.html` | `GET /api/libros?per_page=100` (una sola vez) | Búsqueda, filtros, orden y paginación hechos en JS (estado en la URL) |
| `libro.html?id=slug` | `GET /api/libros/{id}` | Detalle |
| `reserva.html` | `GET /api/libros?per_page=100`, `POST /api/reservas` | Reserva de uno o más libros |
| `login.html` | `POST /api/login` | Ingresar (`?volver=pagina.html` vuelve ahí) |
| `registro.html` | `POST /api/registro` y `POST /api/login` | Crear cuenta e ingresar |
| `admin-libro.html` | `POST /api/admin/portadas` y `POST /api/admin/libros` | Alta de libros con tapa por arrastrar y soltar (solo rol admin) |
| `nosotros.html`, `contacto.html` | - | Contenido fijo |

## Contrato de la API que espera el front

Todas las respuestas son JSON. Los errores tienen la forma `{"error": "codigo", "mensaje": "...", "errores": {"campo": "mensaje"}}`.

| Método y ruta | Acceso | Cuerpo / parámetros | Respuesta |
|---|---|---|---|
| `GET /api/libros` | público | `genero`, `autor`, `precio_max`, `orden` (`relevancia`, `precio-asc`, `precio-desc`, `titulo`), `page`, `per_page` (6, 12, 24; hasta 100) | `{items: [{id, titulo, autor, genero, precio, resumen, portada}], total, pagina, por_pagina, paginas}`. `404` si `page` supera `paginas`. |
| `GET /api/libros/{id}` | público | `id` = slug | `{libro: {id, titulo, autor, genero, precio, resumen, descripcion, autor_bio, portada}}` o `404` |
| `POST /api/registro` | público | `nombre`, `email`, `password`, `password_confirm` | `201 {usuario}` o `422` con `errores` |
| `POST /api/login` | público | `email`, `password` | `{token, tipo, expira_en, usuario: {id, nombre, email, rol}}` o `422` con `mensaje` |
| `GET /api/me` | token | - | `{usuario}` |
| `POST /api/reservas` | público | `{nombre, email, telefono, items: [{libro, cantidad}]}` | `201 {reserva: {nombre, email, ...}}`. En `422`, las claves de `errores` son `nombre`, `email`, `telefono`, `items.N.libro`, `items.N.cantidad` e `items` (error general). |
| `POST /api/admin/libros` | admin | `titulo`, `autor`, `genero`, `precio`, `resumen`, `descripcion`, `autor_bio`, `imagen_url` | `201 {libro}` o `422` con `errores` (claves = nombres de los campos) |
| `POST /api/admin/portadas` | admin | La imagen tal cual en el cuerpo, con `Content-Type: image/jpeg`, `image/png` o `image/webp` (hasta 1 MB) | `201 {portada: {id, url}}` (`url` relativa a la API, por ejemplo `/api/portadas/3`) o `422` con `errores.portada` |
| `GET /api/portadas/{id}` | público | - | La imagen |

`portada` es la URL de la imagen del libro; si viene vacía, el front usa `img/placeholder.svg`.

## Estructura

```
index.html catalogo.html libro.html reserva.html
nosotros.html contacto.html login.html registro.html admin-libro.html
styles/   reset.css (reset-css 5.0.1), style.css, print.css
img/      logo.svg, icono.svg (favicon), placeholder.svg, carrusel/ (imágenes de novedades del inicio)
SITEMAP.md, PawPrints Wireframes.html, autores.txt, VERSION
js/
  api/          config.js (dirección de la API), config.local.example.js, cliente.js (fetch + token + errores), auth.js, libros.js, reservas.js, admin.js
  servicios/    sesion.js, dom.js, formato.js, formularios.js (validación), layout.js (cabecera, menú y pie), historial.js (búsquedas recientes)
  componentes/  carrusel.js, zona-imagen.js (componentes reutilizables)
  paginas/      un script por pantalla
```

## Programación frontend (Entrega 4)

### Carrusel (`js/componentes/carrusel.js`)

Convierte un contenedor con imágenes en un carrusel. Recibe un solo parámetro, el contenedor:

```html
<div id="novedades" data-efecto="deslizar" data-intervalo="5000" aria-label="Novedades">
  <img src="img/carrusel/semana-libro.svg" alt="...">
  <img src="img/carrusel/club-lectura.svg" alt="...">
</div>
<script type="module">
  import { Carrusel } from './js/componentes/carrusel.js';
  new Carrusel(document.querySelector('#novedades'));
</script>
```

- **Barra de descarga:** cada imagen se descarga con `fetch` leyendo el cuerpo de a pedazos, así se sabe cuántos bytes llegaron sobre el total (`Content-Length`). La barra muestra el porcentaje de todas las imágenes juntas, y recién al llegar a 100% arranca el pase automático. Si un servidor no informa el tamaño, esa imagen cuenta al terminar de bajar.
- **Cuatro efectos de transición:** deslizar, desvanecer, zoom y voltear. Se hacen con la Web Animations API (`element.animate`). El inicial sale de `data-efecto` y se puede cambiar desde el propio carrusel.
- **Formas de pasar las imágenes:** botones anterior y siguiente, miniaturas, swipe (Pointer Events: sirve con el dedo, el lápiz o el mouse) y flechas del teclado. Las flechas funcionan con el foco en el carrusel o mientras se ve en pantalla, salvo que se esté escribiendo en un campo. Inicio y Fin van a la primera y a la última.
- **Responsive y pantalla completa:** dentro del contenedor ocupa todo el ancho con proporción 2:1. El botón *Pantalla completa* lo lleva a todo el viewport con la Fullscreen API, o con CSS donde no existe, como en iPhone. Las imágenes se redimensionan con `object-fit: contain` para entrar enteras. Escape sale.
- **Accesibilidad:** el pase automático se puede pausar y se detiene solo con el mouse encima, con el foco adentro o con la pestaña oculta. Con `prefers-reduced-motion` las imágenes cambian sin animación, y los cambios hechos a mano se anuncian al lector de pantalla.

### Validaciones en línea del alta de libros

La validación es la de `js/servicios/formularios.js`, la misma de todos los formularios. Para que se vea igual en todos los navegadores no se usan las burbujas nativas (`novalidate`), que cambian en cada uno:

- Al salir de un campo que se modificó se muestra su error. Mientras se corrige, el mensaje se actualiza con cada tecla y desaparece al quedar bien. Al enviar se revisa todo y aparece un resumen con enlaces a cada error.
- Un campo obligatorio con solo espacios cuenta como vacío, igual que en el back. Cada campo tiene su propio mensaje (`data-faltante`).
- Los campos con límite muestran un contador ("120 de 300 caracteres") que cambia de color cerca del máximo.
- Los límites son los mismos que valida el back (`LibroValidator`), y sus errores 422 se muestran igual que los del navegador.

### Tapa por arrastrar y soltar (`js/componentes/zona-imagen.js`)

- Se arrastra la imagen sobre la zona o se elige con el botón. El control real es un `<input type="file">`, así funciona también con teclado y lector de pantalla. Lo que se suelta se copia al input con `DataTransfer`.
- Se valida en el momento: tipo JPG, PNG o WebP, hasta 10 MB y al menos 100x150 píxeles. Se muestran la vista previa, las medidas y el peso, y se puede quitar.
- Antes de subirla, la imagen se achica en el navegador con un `<canvas>` (como máximo 600x900) y se convierte a WebP, o a JPEG si el navegador no genera WebP. Una foto de varios MB queda en pocos KB.
- Al guardar se sube con `POST /api/admin/portadas`, que devuelve la dirección de la tapa, y esa dirección va como `imagen_url` del libro. Con una imagen elegida, el campo de dirección se deshabilita para que no haya dos tapas.

### Catálogo con filtros en JS (`js/paginas/catalogo.js`)

- Los libros se piden **una sola vez** a la API (de a 100 por pedido). Después buscar, filtrar, ordenar y paginar se hace en el navegador, sin volver a pedir nada.
- **Búsqueda** por título o autor, sin distinguir mayúsculas ni acentos. Cada palabra puede estar en cualquier orden. Los resultados se actualizan mientras se escribe.
- **Filtros:** género y rango de precio (desde y hasta). Si "hasta" es menor que "desde", se marca el error y se sigue usando el último rango válido.
- **Orden** por relevancia, título, autor, precio o género, en sentido ascendente o descendente. A igual valor se desempata por título.
- **Paginado:** 6, 12, 24 o 48 libros por página, con *páginas numeradas* (con "…" cuando son muchas) o *scroll infinito*. El scroll infinito usa `IntersectionObserver`, y el botón "Mostrar más libros" también se puede usar a mano.
- El estado queda en la URL (`?q=borges&orden=precio&sentido=desc`), así se puede compartir, recargar y usar atrás y adelante. Si la URL pide una página que no existe (por ejemplo `?pagina=99`), se avisa y se muestra la última.
- **Descargar CSV:** baja la vista actual, es decir todos los libros que cumplen la búsqueda y los filtros, en el orden elegido (no solo la página en pantalla). Se arma en el navegador con un `Blob` y usa el mismo formato que `GET /api/libros?formato=csv` del back: RFC 4180, BOM para que Excel muestre los acentos, y las celdas que empiezan con `=`, `+`, `-` o `@` neutralizadas para que no se ejecuten como fórmulas.
- **Celular:** los filtros van en un panel plegable que arranca cerrado, para que los libros se vean enseguida, y muestra cuántos filtros hay activos. *Ver N resultados* cierra el panel y lleva a los libros. Los campos tienen 16px para que iOS no haga zoom y son altos para tocarlos con el dedo.

### Búsquedas recientes (`js/servicios/historial.js`)

- Se guardan en `localStorage` las últimas **5** búsquedas: texto, género, rango de precio y orden. Se guarda una búsqueda al apretar Enter o *Buscar*, o al terminar de escribir en el buscador.
- Si se repite una búsqueda, sube al primer lugar en vez de duplicarse. Con más de 5, se elimina la más antigua.
- Aparecen arriba de los filtros: un clic repite la búsqueda, y hay un botón para borrarlas. Si el navegador bloquea el almacenamiento, el catálogo funciona igual, sin historial.

## Formularios y marcado

- Todos los campos tienen `label`, `autocomplete` y las restricciones HTML (`required`, `type`, `pattern`, `min`, `max`, `maxlength`, `minlength`). Los formularios llevan `novalidate` y `js/servicios/formularios.js` muestra los mensajes junto al campo, con `aria-invalid` y `aria-describedby`, más un resumen con enlaces a cada error.
- Los errores se indican con texto, ícono y borde discontinuo, no solo con color. Los enlaces van subrayados y la página actual del menú se marca con `aria-current`.
- Las imágenes tienen `alt`, `width` y `height`; los resultados y avisos dinámicos usan regiones `aria-live`; cada página tiene un único `h1`, enlace para saltar al contenido y foco visible.
- Los textos que llegan de la API se insertan siempre como texto (`textContent`), nunca como HTML.
- Los límites (nombre 100, cantidad 1 a 10, teléfono, contraseña 8 a 72, etc.) son los mismos que valida el back.

## Manual de identidad

De las dos opciones que daba la consigna elegimos el manual Violeta.

Los colores del manual son el violeta `#5c068c` y el blanco `#ffffff`. El violeta lo usamos en el nombre del sitio, los títulos, los enlaces, los botones y el pie; el blanco es el fondo y el texto que va sobre violeta.

Como el manual solo trae esos dos colores, para el hover, los fondos suaves y los bordes usamos el mismo violeta más oscuro (`#400462`) o más claro (`#f2ebf6` y `#decde8`), así no agregamos colores que no sean de la marca. Para el texto usamos un gris oscuro porque el manual no fija uno.

La tipografía del manual es Argentum Sans y la equivalente que indica es Montserrat. Cargamos Montserrat desde Google Fonts y dejamos Argentum Sans primera en la lista por si está instalada.

Todo esto está definido una sola vez como variables en `:root`, al principio de `styles/style.css`.

El logo del manual (los dos libros con la huella y "PAW prints") está redibujado en SVG: `img/logo.svg` va en la cabecera de todas las páginas y `img/icono.svg` es el favicon.

## Responsive

Lo hicimos mobile first: el CSS base es el de celular, con todo en una columna, y las media queries agregan columnas cuando hay más ancho. A partir de 700px las fichas del catálogo, las promociones y los servicios pasan a dos columnas, y a partir de 1024px a tres. Elegimos esos anchos porque cada ficha necesita unos 300px para que la portada y el texto no queden apretados.

Usamos grid para las grillas de fichas y flex para lo que va en fila y tiene que poder bajar de renglón (el menú, los filtros del catálogo y el pie). Por eso el menú no necesita botón hamburguesa. El `body` tiene un ancho máximo de 1200px para que en monitores grandes no quede todo estirado.

## Impresión

`styles/print.css` se enlaza con `media="print"` en todas las páginas.

Al imprimir se oculta lo que en papel no sirve: el menú, las redes del pie, los botones y los filtros del catálogo. El nombre del sitio y todo el contenido se mantienen, incluido el formulario de reserva, que se puede imprimir para completar a mano. Se imprime en negro sobre blanco y sin fondos de color para no gastar tinta.

Con `@page` definimos hoja A4 y márgenes de 2cm. Con `break-inside: avoid` evitamos que una ficha del catálogo, un grupo de campos o una tabla queden cortados entre dos hojas.

Para ver la versión de celular alcanza con achicar la ventana o usar la vista adaptable del navegador (F12). Para ver la de impresión, la vista previa de impresión (Ctrl+P). Se necesita internet para que cargue Montserrat; sin conexión se ve con la fuente sans-serif del sistema.
