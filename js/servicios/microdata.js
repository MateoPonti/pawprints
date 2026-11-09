// Microdata de schema.org (TP5, consigna 8). Son atributos HTML que les dicen a los buscadores qué es cada
// cosa de la página: un libro (Book), su autor (Person), su precio (Offer), la librería (BookStore)...
//   itemscope + itemtype  -> "acá empieza un objeto de este tipo"
//   itemprop              -> "este elemento es tal dato del objeto" (name, author, price...)
// Los libros vienen de la API, así que su microdata se arma acá, junto con la ficha.
import { el } from './dom.js';
import { precio } from './formato.js';

// Atributos para abrir un objeto: {...objeto('Book')} -> itemscope itemtype="https://schema.org/Book"
export const objeto = (tipo) => ({ itemscope: true, itemtype: `https://schema.org/${tipo}` });

// Precio del libro como oferta en pesos. <data value="15000"> le da al buscador el número sin formato.
export function oferta(valor) {
    return el('span', { itemprop: 'offers', ...objeto('Offer') },
        el('meta', { itemprop: 'priceCurrency', content: 'ARS' }),
        el('data', { itemprop: 'price', value: valor }, precio(valor)));
}

// Autor del libro como persona (con su biografía, si se pasa)
export function autor(nombre, bio = '') {
    return el('span', { itemprop: 'author', ...objeto('Person') },
        el('span', { itemprop: 'name' }, nombre),
        bio ? el('meta', { itemprop: 'description', content: bio }) : null);
}
