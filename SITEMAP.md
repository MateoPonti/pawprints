# SiteMap - PawPrints

```
Inicio (index.html)
├── Catálogo (catalogo.html)
│   └── Detalle de libro (libro.html?id={id})
├── Formulario de Reserva (reserva.html)
├── Nuestra Historia (nosotros.html)
├── Contacto (contacto.html)
├── Ingresar (login.html)
├── Crear cuenta (registro.html)
├── Cargar libro (admin-libro.html, permiso libros.crear: rol admin)
└── Pedidos (admin-reservas.html, permiso reservas.ver: roles personal y admin)

En el footer de todas las páginas: datos de contacto y redes sociales.
```

## Descripción de páginas

- **Inicio**: presentación de la librería (tienda online + tienda física), zona "Tu cuenta" con enlaces a Crear cuenta e Ingresar (con la sesión iniciada muestra un saludo), libros destacados del catálogo y promociones/novedades.
- **Catálogo**: listado de libros con filtro, orden y paginación; cada libro enlaza a su página de detalle.
- **Detalle de libro**: descripción completa, información del autor, precio y botón de reserva. Se accede desde el catálogo.
- **Formulario de Reserva**: datos del solicitante (nombre, email, teléfono) y selección de uno o más libros con su cantidad.
- **Nuestra Historia**: historia, misión y servicios de la librería.
- **Contacto**: dirección, teléfono, email, horario de atención y sedes.
- **Ingresar / Crear cuenta**: acceso con correo y contraseña.
- **Cargar libro**: alta de libros, visible en el menú solo para usuarios con rol admin.

Navegación principal presente en todas las páginas: Inicio, Catálogo, Formulario de reserva, Nuestra historia, Contacto, más Ingresar y Crear cuenta (o Cargar libro y Salir con la sesión iniciada).
