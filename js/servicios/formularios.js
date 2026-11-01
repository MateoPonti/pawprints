// Validación de formularios con la API de restricciones del navegador (required, pattern, min, max, maxlength...).
// Los formularios llevan "novalidate" para que los mensajes los dé este módulo: aparecen junto a cada campo,
// en un resumen con enlaces a cada error, y se vinculan al campo con aria-invalid y aria-describedby.
// Los errores 422 de la API se muestran de la misma forma que los del navegador.
import { ErrorApi } from '../api/cliente.js';
import { el, $, $$ } from './dom.js';

// Campos de texto donde un valor hecho solo de espacios cuenta como vacío (el back recorta los espacios)
const DE_TEXTO = ['text', 'email', 'search', 'url', 'tel', 'textarea'];

export function mensajeDe(control) {
    const v = control.validity;
    if (control.required && DE_TEXTO.includes(control.type) && control.value !== '' && control.value.trim() === '') {
        return control.dataset.faltante || 'Completá este campo.';
    }
    if (v.valid) return '';
    if (v.customError) return control.validationMessage;
    if (v.valueMissing) return control.dataset.faltante || 'Completá este campo.';
    if (v.typeMismatch || v.patternMismatch) return control.title || 'El formato no es válido.';
    if (v.tooShort) return `Ingresá al menos ${control.minLength} caracteres.`;
    if (v.tooLong) return `Podés usar hasta ${control.maxLength} caracteres.`;
    if (v.rangeUnderflow) return `El valor mínimo es ${control.min}.`;
    if (v.rangeOverflow) return `El valor máximo es ${control.max}.`;
    if (v.stepMismatch || v.badInput) return 'Ingresá un número entero.';
    return control.validationMessage || 'El valor no es válido.';
}

function rotulo(control) {
    const etiqueta = control.labels?.[0];
    if (!etiqueta) return control.name || control.id;
    const copia = etiqueta.cloneNode(true);
    copia.querySelectorAll('.nota, .visualmente-oculto').forEach((n) => n.remove());
    return copia.textContent.trim();
}

function descripcionBase(control) {
    if (control.dataset.descripcionBase === undefined) {
        control.dataset.descripcionBase = control.getAttribute('aria-describedby') || '';
    }
    return control.dataset.descripcionBase;
}

export function ponerError(control, mensaje) {
    const idError = `${control.id}-error`;
    let nodo = document.getElementById(idError);
    if (!nodo) {
        nodo = el('p', { class: 'error-campo', id: idError });
        (control.closest('.campo') || control.parentElement).append(nodo);
    }
    nodo.replaceChildren(
        el('span', { class: 'error-icono', 'aria-hidden': 'true', text: '!' }),
        el('span', { class: 'visualmente-oculto', text: 'Error: ' }),
        mensaje,
    );
    nodo.hidden = false;
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', `${descripcionBase(control)} ${idError}`.trim());
}

export function sacarError(control) {
    const nodo = document.getElementById(`${control.id}-error`);
    if (nodo) nodo.hidden = true;
    control.removeAttribute('aria-invalid');
    const base = descripcionBase(control);
    if (base) control.setAttribute('aria-describedby', base);
    else control.removeAttribute('aria-describedby');
}

function limpiar(form) {
    $$('[aria-invalid="true"]', form).forEach(sacarError);
    const resumen = $('.resumen-errores', form);
    if (resumen) resumen.hidden = true;
    const aviso = $('.aviso-general', form);
    if (aviso) aviso.hidden = true;
}

function mostrarResumen(form, errores) {
    const resumen = $('.resumen-errores', form);
    if (!resumen) return;
    const titulo = el('h2', { id: `${form.id}-resumen-titulo`, class: 'resumen-titulo',
        text: errores.length === 1 ? 'Hay 1 campo para revisar' : `Hay ${errores.length} campos para revisar` });
    const lista = el('ul', {}, errores.map(({ control, mensaje }) => el('li', {},
        el('a', {
            href: `#${control.id}`,
            onclick: (evento) => { evento.preventDefault(); control.focus(); },
        }, `${rotulo(control)}: ${mensaje}`))));
    resumen.setAttribute('aria-labelledby', titulo.id);
    resumen.replaceChildren(titulo, lista);
    resumen.hidden = false;
    resumen.focus();
}

export function mostrarAviso(form, mensaje) {
    const aviso = $('.aviso-general', form);
    if (!aviso) return;
    aviso.replaceChildren(el('span', { class: 'error-icono', 'aria-hidden': 'true', text: '!' }),
        el('span', { class: 'visualmente-oculto', text: 'Error: ' }), mensaje);
    aviso.hidden = false;
    aviso.scrollIntoView({ block: 'nearest' });
}

// Revisa todos los campos. `extra()` puede devolver {idDelCampo: mensaje} para reglas entre campos.
function revisar(form, extra) {
    const errores = [];
    const personalizados = extra ? extra() : {};
    $$('input, select, textarea', form).forEach((control) => {
        if (!control.id || control.disabled) return;
        control.setCustomValidity('');
        const mensaje = personalizados[control.id] || mensajeDe(control);
        if (mensaje) errores.push({ control, mensaje });
    });
    errores.forEach(({ control, mensaje }) => ponerError(control, mensaje));
    return errores;
}

function ocupado(form, estado) {
    const boton = $('button[type="submit"]', form);
    form.setAttribute('aria-busy', String(estado));
    if (!boton) return;
    boton.disabled = estado;
    if (estado) {
        boton.dataset.texto = boton.textContent;
        boton.textContent = boton.dataset.ocupado || 'Enviando...';
    } else if (boton.dataset.texto) {
        boton.textContent = boton.dataset.texto;
    }
}

// Conecta el formulario: valida al enviar, corrige en vivo y llama a alEnviar(form) si todo está bien.
// Validación en línea, igual en todos los navegadores (no se usan las burbujas nativas, que cambian en cada uno):
// - al salir de un campo que el usuario modificó se muestra su error, si tiene;
// - mientras se corrige un campo con error, el mensaje se actualiza con cada tecla y desaparece al quedar bien.
export function activar(form, alEnviar, { extra } = {}) {
    form.noValidate = true;

    const validarCampo = (control) => {
        if (!control.id || control.disabled) return;
        control.setCustomValidity('');
        const mensaje = (extra ? extra()[control.id] : '') || mensajeDe(control);
        if (mensaje) ponerError(control, mensaje);
        else sacarError(control);
    };

    form.addEventListener('input', (evento) => {
        const control = evento.target;
        control.dataset.tocado = 'true';
        if (control.getAttribute?.('aria-invalid') === 'true') validarCampo(control);
    });
    // change llega con los select, las casillas y los archivos: ahí el valor ya es definitivo
    form.addEventListener('change', (evento) => {
        evento.target.dataset.tocado = 'true';
        validarCampo(evento.target);
    });
    form.addEventListener('focusout', (evento) => {
        if (evento.target.dataset?.tocado === 'true') validarCampo(evento.target);
    });

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        limpiar(form);
        const errores = revisar(form, extra);
        if (errores.length) {
            mostrarResumen(form, errores);
            return;
        }
        ocupado(form, true);
        try {
            await alEnviar(form);
        } catch (error) {
            if (!(error instanceof ErrorApi)) throw error;
            mostrarErroresDeApi(form, error);
        } finally {
            ocupado(form, false);
        }
    });
}

// Errores de la API: {campo: mensaje} se asigna al campo con ese name; el resto va a un aviso general.
export function mostrarErroresDeApi(form, error) {
    const errores = [];
    const sueltos = [];
    for (const [campo, mensaje] of Object.entries(error.errores || {})) {
        const control = form.elements[campo];
        if (control && control.id) {
            ponerError(control, mensaje);
            errores.push({ control, mensaje });
        } else {
            sueltos.push(mensaje);
        }
    }
    if (errores.length) mostrarResumen(form, errores);
    if (sueltos.length || !errores.length) {
        mostrarAviso(form, sueltos.join(' ') || error.message);
        if (!errores.length) $('.aviso-general', form)?.focus();
    }
}

// Contador de caracteres para los campos con data-contador y maxlength: "120 de 300 caracteres".
// Cerca del límite cambia de estilo y lo anuncia el lector de pantalla (aria-live).
export function conectarContadores(form) {
    $$('[data-contador][maxlength]', form).forEach((control) => {
        const contador = el('p', { class: 'contador', id: `${control.id}-contador`, 'aria-live': 'polite' });
        control.after(contador);
        const actualizar = () => {
            const usados = control.value.length;
            const cerca = usados >= control.maxLength * 0.9;
            contador.textContent = `${usados} de ${control.maxLength} caracteres`;
            contador.classList.toggle('cerca', cerca);
            // Solo se anuncia cuando falta poco, para no leer un número con cada tecla
            contador.setAttribute('aria-live', cerca ? 'polite' : 'off');
        };
        control.addEventListener('input', actualizar);
        form.addEventListener('reset', () => window.setTimeout(actualizar));
        actualizar();
    });
}

// Casilla "Mostrar contraseña": cambia el type de los campos listados en data-destino (ids separados por espacio).
export function conectarMostrarClave(form) {
    const casilla = $('.mostrar-clave', form);
    if (!casilla) return;
    casilla.addEventListener('change', () => {
        casilla.dataset.destino.split(' ').forEach((id) => {
            const campo = document.getElementById(id);
            if (campo) campo.type = casilla.checked ? 'text' : 'password';
        });
    });
}
