// Estado de la aplicación
let proveedores = [];
let inventarioActual = [];
let entradas = [];
let archivosAdjuntos = [];
let mediaRecorder;
let audioChunks = [];
let grabacionInterval;
let grabacionSegundos = 0;
let editandoId = null;

// Reconocimiento de voz (Web Speech API)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let textoAcumulado = '';

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        if (event.results[event.results.length - 1].isFinal) {
            textoAcumulado += transcript + ' ';
            inputTextoLibre.value = textoAcumulado;
        } else {
            inputTextoLibre.value = textoAcumulado + transcript;
        }
    };
}

// Elementos del DOM
const formEntrada = document.getElementById('formEntrada');
const selectIngrediente = document.getElementById('ingrediente');
const inputCantidad = document.getElementById('cantidad');
const inputCostoUnitario = document.getElementById('costoUnitario');
const spanCostoTotal = document.getElementById('costoTotal');
const inputComprobante = document.getElementById('comprobante');
const inputCodigo = document.getElementById('codigo');
const inputCategoria = document.getElementById('categoria');
const inputUltimoIngreso = document.getElementById('ultimoIngreso');
const inputHora = document.getElementById('hora');
const inputUsuario = document.getElementById('usuario');
const inputPassword = document.getElementById('password');
const inputTextoLibre = document.getElementById('textoLibre');
const inputArchivosMultimedia = document.getElementById('archivosMultimedia');
const btnGrabarAudio = document.getElementById('btnGrabarAudio');
const statusGrabacion = document.getElementById('statusGrabacion');
const tiempoGrabacionLabel = document.getElementById('tiempoGrabacion');
const listaArchivosAdjuntos = document.getElementById('listaArchivosAdjuntos');
const listaEntradas = document.getElementById('listaEntradas');
const totalRegistrosLabel = document.getElementById('totalRegistros');
const montoTotalLabel = document.getElementById('montoTotal');
const fechaActualLabel = document.getElementById('fechaActual');
const btnAgregarIngrediente = document.getElementById('btnAgregarIngrediente');
const contenedorIngredientesExtra = document.getElementById('contenedorIngredientesExtra');

// Inicialización
async function init() {
    mostrarFechaActual();
    establecerHoraActual();
    configurarEventos();

    try {
        const [insumos, provs, ents] = await Promise.all([
            window.AlmacenDB.getInsumos(),
            window.AlmacenDB.getProveedores(),
            window.AlmacenDB.getEntradas()
        ]);
        inventarioActual = insumos;
        proveedores = provs;
        entradas = ents;
        cargarOpciones();
        renderizarEntradas();
    } catch (err) {
        console.error('[entrada] Error al cargar datos:', err);
        listaEntradas.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:2rem; color:#ef4444;">❌ Error al cargar datos. Verifique la conexión.</td></tr>';
    }
}

function mostrarFechaActual() {
    const hoy = new Date();
    fechaActualLabel.textContent = hoy.toLocaleDateString("es-PE", {
        day: "numeric", month: "long", year: "numeric"
    });
}

function establecerHoraActual() {
    const hoy = new Date();
    inputHora.value = `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}`;
}

function cargarOpciones() {
    selectIngrediente.innerHTML = '<option value="">Seleccione un insumo</option>';
    inventarioActual.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(ing => {
        const option = document.createElement('option');
        option.value = ing.codigo;
        option.textContent = `${ing.nombre} (${ing.unidad})`;
        selectIngrediente.appendChild(option);
    });

    const selectProveedorPrincipal = document.querySelector('#formEntrada .form-section:nth-child(2) #proveedor');
    if (selectProveedorPrincipal) {
        selectProveedorPrincipal.innerHTML = '<option value="">Seleccione un proveedor</option>';
        proveedores.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov.nombre;
            option.textContent = prov.nombre;
            selectProveedorPrincipal.appendChild(option);
        });
    }
}

function configurarEventos() {
    selectIngrediente.addEventListener('change', (e) => {
        const ing = inventarioActual.find(i => i.codigo === e.target.value);
        actualizarCamposInsumo(ing, inputCodigo, inputCategoria, inputCostoUnitario, inputUltimoIngreso);
        if (ing) {
            const selectProv = document.querySelector('#formEntrada .form-section:nth-child(2) #proveedor');
            if (selectProv) selectProv.value = ing.proveedor || '';
        }
    });

    inputCantidad.addEventListener('input', calcularTotal);
    btnGrabarAudio.addEventListener('click', toggleGrabacion);
    btnAgregarIngrediente.addEventListener('click', agregarFilaIngredienteExtra);

    inputArchivosMultimedia.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (!archivosAdjuntos.find(f => f.name === file.name)) {
                const base64 = await toBase64(file);
                archivosAdjuntos.push({ name: file.name, type: file.type, data: base64 });
            }
        }
        actualizarListaArchivos();
    });

    formEntrada.addEventListener('submit', (e) => {
        e.preventDefault();
        validarYRegistrar();
    });
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function actualizarCamposInsumo(ing, fieldCodigo, fieldCategoria, fieldCosto, fieldUltimo) {
    if (ing) {
        fieldCodigo.value = ing.codigo;
        fieldCategoria.value = ing.categoria;
        fieldCosto.value = (ing.costoUnitario || 0).toFixed(2);
        fieldUltimo.value = ing.ultimoIngreso || '-';
    } else {
        fieldCodigo.value = '';
        fieldCategoria.value = '';
        fieldCosto.value = '';
        fieldUltimo.value = '-';
    }
    calcularTotal();
}

function agregarFilaIngredienteExtra() {
    const div = document.createElement('div');
    div.className = 'extra-ingrediente animate-fade-in';
    div.style.marginTop = '1rem';

    div.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Insumo adicional</label>
                <select class="extra-select" required>
                    <option value="">Seleccione un insumo</option>
                    ${inventarioActual.map(ing => `<option value="${ing.codigo}">${ing.nombre} (${ing.unidad})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Cantidad</label>
                <input type="number" class="extra-cantidad" step="0.01" min="0" required>
            </div>
            <div class="form-group">
                <label>Proveedor *</label>
                <select class="extra-proveedor" required>
                    <option value="">Seleccione un proveedor</option>
                    ${proveedores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Costo Unitario (S/)</label>
                <input type="number" class="extra-costo" step="0.01" min="0" readonly>
            </div>
            <div class="form-group">
                <label>Código</label>
                <input type="text" class="extra-codigo" readonly>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <input type="text" class="extra-categoria" readonly>
            </div>
            <div class="form-group">
                <label>Último Ingreso</label>
                <input type="text" class="extra-ultimo" readonly>
            </div>
            <div style="display: flex; align-items: flex-end;">
                <button type="button" class="btn btn-destructive btn-sm" onclick="this.parentElement.parentElement.parentElement.remove(); calcularTotal();">❌</button>
            </div>
        </div>
    `;

    const select = div.querySelector('.extra-select');
    const inputCosto = div.querySelector('.extra-costo');
    const inputCodigoExtra = div.querySelector('.extra-codigo');
    const inputCantExtra = div.querySelector('.extra-cantidad');
    const inputCatExtra = div.querySelector('.extra-categoria');
    const inputUltimoExtra = div.querySelector('.extra-ultimo');
    const selectProvExtra = div.querySelector('.extra-proveedor');

    select.addEventListener('change', (e) => {
        const ing = inventarioActual.find(i => i.codigo === e.target.value);
        if (ing) {
            inputCosto.value = (ing.costoUnitario || 0).toFixed(2);
            inputCodigoExtra.value = ing.codigo;
            inputCatExtra.value = ing.categoria || '-';
            inputUltimoExtra.value = ing.ultimoIngreso || '-';
            selectProvExtra.value = ing.proveedor || '';
        } else {
            inputCosto.value = '';
            inputCodigoExtra.value = '';
            inputCatExtra.value = '';
            inputUltimoExtra.value = '';
            selectProvExtra.value = '';
        }
        calcularTotal();
    });
    inputCantExtra.addEventListener('input', calcularTotal);

    contenedorIngredientesExtra.appendChild(div);
}

function calcularTotal() {
    let total = 0;
    const cantPrincipal = parseFloat(inputCantidad.value) || 0;
    const unitPrincipal = parseFloat(inputCostoUnitario.value) || 0;
    total += (cantPrincipal * unitPrincipal);

    document.querySelectorAll('.extra-ingrediente').forEach(fila => {
        const cant = parseFloat(fila.querySelector('.extra-cantidad').value) || 0;
        const unit = parseFloat(fila.querySelector('.extra-costo').value) || 0;
        total += (cant * unit);
    });
    spanCostoTotal.textContent = total.toFixed(2);
}

function validarYRegistrar() {
    if (inputPassword.value !== 'admin123') {
        alert('Contraseña incorrecta.');
        return;
    }
    registrarEntrada();
}

async function registrarEntrada() {
    const nuevoId = editandoId ? editandoId : generarSiguienteID();
    const listaIngredientes = [];

    // Principal
    const ingPrincipal = inventarioActual.find(i => i.codigo === selectIngrediente.value);
    const cantPrincipal = parseFloat(inputCantidad.value);
    const unitPrincipal = parseFloat(inputCostoUnitario.value);
    const selectProvPrincipal = document.querySelector('#formEntrada .form-section:nth-child(2) #proveedor');

    if (ingPrincipal) {
        listaIngredientes.push({
            codigo: ingPrincipal.codigo,
            nombre: ingPrincipal.nombre,
            categoria: ingPrincipal.categoria,
            costoUnitario: unitPrincipal,
            ultimoIngreso: ingPrincipal.ultimoIngreso || "-",
            estado: ingPrincipal.estado || "ok",
            costoTotal: cantPrincipal * unitPrincipal,
            cantidad: cantPrincipal,
            proveedor: selectProvPrincipal ? selectProvPrincipal.value : "-"
        });
    }

    // Extras
    document.querySelectorAll('.extra-ingrediente').forEach(fila => {
        const cod = fila.querySelector('.extra-select').value;
        const ing = inventarioActual.find(i => i.codigo === cod);
        const cant = parseFloat(fila.querySelector('.extra-cantidad').value);
        const unit = parseFloat(fila.querySelector('.extra-costo').value);
        const prov = fila.querySelector('.extra-proveedor').value;
        if (ing && cant > 0) {
            listaIngredientes.push({
                codigo: ing.codigo,
                nombre: ing.nombre,
                categoria: ing.categoria,
                costoUnitario: unit,
                ultimoIngreso: ing.ultimoIngreso || "-",
                estado: ing.estado || "ok",
                costoTotal: cant * unit,
                cantidad: cant,
                proveedor: prov
            });
        }
    });

    // Procesar adjuntos con nombres únicos
    const adjuntosProcesados = await Promise.all(archivosAdjuntos.map(async (file, index) => {
        const extension = file.name.split('.').pop();
        const nuevoNombre = `${nuevoId}_${index + 1}.${extension}`;
        return { name: nuevoNombre, type: file.type, data: file.data };
    }));

    const nuevaEntrada = {
        id: nuevoId,
        hora: inputHora.value,
        comprobante: inputComprobante.value || "-",
        usuario: inputUsuario.value,
        fecha: new Date().toLocaleDateString("es-PE"),
        notas: inputTextoLibre.value.trim(),
        archivos: adjuntosProcesados,
        tipo: editandoId ? 'corregido' : 'original',
        referencia_id: editandoId || null,
        ingredientes: listaIngredientes,
        costo_total_movimiento: parseFloat(spanCostoTotal.textContent),
        movimiento: 'ENTRADA'
    };

    // Insertar entrada en Supabase
    try {
        await window.AlmacenDB.insertEntrada(nuevaEntrada);
    } catch (err) {
        console.error('[entrada] Error al insertar entrada:', err);
        alert('Error al guardar el registro. No se actualizó el stock.');
        return;
    }

    // Actualizar stock de cada ingrediente
    for (const item of listaIngredientes) {
        const insumoActual = inventarioActual.find(i => i.codigo === item.codigo);
        if (!insumoActual) continue;
        const nuevoStock = insumoActual.stockActual + item.cantidad;
        try {
            await window.AlmacenDB.updateStockInsumo(item.codigo, nuevoStock);
            insumoActual.stockActual = nuevoStock;
        } catch (err) {
            console.error('[entrada] Error al actualizar stock de', item.codigo, err);
            alert(`Historial guardado pero stock no actualizado para: ${item.nombre}`);
        }
    }

    // Recargar entradas desde Supabase
    try {
        entradas = await window.AlmacenDB.getEntradas();
    } catch (err) {
        console.error('[entrada] Error al recargar entradas:', err);
    }

    limpiarFormulario();
    renderizarEntradas();
    alert('Ingreso registrado con éxito.');
}

function generarSiguienteID() {
    const prefijo = 'ENT';
    const ids = entradas.map(r => r.id).filter(id => id && id.startsWith(prefijo));
    if (ids.length === 0) return `${prefijo}00001`;
    const numeros = ids.map(id => parseInt(id.replace(prefijo, '')) || 0);
    const siguiente = Math.max(...numeros) + 1;
    return `${prefijo}${siguiente.toString().padStart(5, '0')}`;
}

function limpiarFormulario() {
    formEntrada.reset();
    inputTextoLibre.value = '';
    archivosAdjuntos = [];
    actualizarListaArchivos();
    establecerHoraActual();
    inputCodigo.value = '';
    inputCategoria.value = '';
    inputUltimoIngreso.value = '';
    inputCostoUnitario.value = '';
    spanCostoTotal.textContent = '0.00';
    editandoId = null;
    contenedorIngredientesExtra.innerHTML = '';
    document.querySelector('.card-title').textContent = '📝 Formulario de Registro';
}

function renderizarEntradas() {
    listaEntradas.innerHTML = '';
    let totalInversion = 0;

    entradas.forEach(entrada => {
        const costoTotal = entrada.costo_total_movimiento || entrada.costoTotalMovimiento || 0;
        const referenciaId = entrada.referencia_id || entrada.referenciaId || null;
        const corregidoPorId = entrada.corregido_por_id || entrada.corregidoPorId || null;

        if (entrada.tipo !== 'no-valido') totalInversion += costoTotal;

        const row = document.createElement('tr');
        if (entrada.tipo === 'no-valido') row.classList.add('row-no-valido');

        const badgeClass = `badge-${entrada.tipo}`;
        const refInfo = referenciaId ? `<br><small>Ref: ${referenciaId}</small>` : '';
        const corrInfo = corregidoPorId ? `<br><small>Corr: ${corregidoPorId}</small>` : '';

        let ingredientesHTML = '';
        let cantidadesHTML = '';
        let costosUnitHTML = '';
        let costosTotalHTML = '';
        let codigosHTML = '';
        let categoriasHTML = '';
        let estadosHTML = '';
        let ultimosHTML = '';
        let proveedoresHTML = '';

        const items = entrada.ingredientes || [entrada];
        items.forEach(ing => {
            const nombre = ing.nombre || ing.ingredienteNombre;
            codigosHTML += `<div>${ing.codigo}</div>`;
            ingredientesHTML += `<div style="font-weight:600;">${nombre}</div>`;
            categoriasHTML += `<div>${ing.categoria}</div>`;
            costosUnitHTML += `<div>${parseFloat(ing.costoUnitario || 0).toFixed(2)}</div>`;
            ultimosHTML += `<div>${ing.ultimoIngreso || "-"}</div>`;
            estadosHTML += `<div><span class="badge-estado badge-${ing.estado || 'ok'}">${ing.estado || 'ok'}</span></div>`;
            costosTotalHTML += `<div style="font-weight:700;">${parseFloat(ing.costoTotal || 0).toFixed(2)}</div>`;
            cantidadesHTML += `<div>${ing.cantidad}</div>`;
            proveedoresHTML += `<div>${ing.proveedor || "-"}</div>`;
        });

        let adjuntosHTML = '';
        if (entrada.archivos && entrada.archivos.length > 0) {
            adjuntosHTML += '<div class="adjuntos-container" style="display:flex; flex-wrap:wrap; gap:8px;">';
            entrada.archivos.forEach(file => {
                adjuntosHTML += `<a href="${file.data}" download="${file.name}" title="Descargar ${file.name}" style="font-size:0.7rem; color:var(--primary); text-decoration:underline; display: flex; align-items: center; gap: 4px; background: var(--secondary); padding: 4px 8px; border-radius: 4px;">💾 ${file.name}</a>`;
            });
            adjuntosHTML += '</div>';
        }
        if (entrada.notas) adjuntosHTML += `<div style="font-size: 0.7rem; color: var(--muted-foreground); font-style: italic; margin-top:4px;">" ${entrada.notas} "</div>`;

        row.innerHTML = `
            <td>${entrada.id}${refInfo}${corrInfo}</td>
            <td><span class="badge-tipo ${badgeClass}">${entrada.tipo}</span></td>
            <td>${codigosHTML}</td>
            <td>${ingredientesHTML}</td>
            <td>${categoriasHTML}</td>
            <td>${costosUnitHTML}</td>
            <td>${ultimosHTML}</td>
            <td>${estadosHTML}</td>
            <td>${costosTotalHTML}</td>
            <td>${proveedoresHTML}</td>
            <td>${entrada.hora}</td>
            <td>${cantidadesHTML}</td>
            <td>${entrada.comprobante}</td>
            <td>${entrada.usuario}</td>
            <td>${adjuntosHTML || '-'}</td>
            <td>
                ${entrada.tipo !== 'no-valido' ? `<button class="btn btn-modificar btn-sm" onclick="prepararModificacion('${entrada.id}')">Modificar</button>` : ''}
            </td>
        `;
        listaEntradas.appendChild(row);
    });

    totalRegistrosLabel.textContent = entradas.filter(e => e.tipo !== 'no-valido').length;
    montoTotalLabel.textContent = `S/ ${totalInversion.toFixed(2)}`;
}

window.prepararModificacion = function(id) {
    const entrada = entradas.find(e => e.id === id);
    if (!entrada) return;

    editandoId = id;
    document.querySelector('.card-title').textContent = `Modificando Registro (Ref: ${id})`;

    const items = entrada.ingredientes || [entrada];
    const principal = items[0];

    inputHora.value = entrada.hora;
    inputComprobante.value = entrada.comprobante !== '-' ? entrada.comprobante : '';
    inputUsuario.value = entrada.usuario;
    inputTextoLibre.value = entrada.notas || '';

    selectIngrediente.value = principal.codigo;
    inputCantidad.value = principal.cantidad;
    inputCodigo.value = principal.codigo;
    inputCategoria.value = principal.categoria;
    inputCostoUnitario.value = principal.costoUnitario.toFixed(2);
    inputUltimoIngreso.value = principal.ultimoIngreso;

    contenedorIngredientesExtra.innerHTML = '';
    for (let i = 1; i < items.length; i++) {
        agregarFilaIngredienteExtra();
        const filas = document.querySelectorAll('.extra-ingrediente');
        const ultima = filas[filas.length - 1];
        const ing = items[i];
        ultima.querySelector('.extra-select').value = ing.codigo;
        ultima.querySelector('.extra-cantidad').value = ing.cantidad;
        ultima.querySelector('.extra-costo').value = ing.costoUnitario.toFixed(2);
        ultima.querySelector('.extra-codigo').value = ing.codigo;
    }

    calcularTotal();
    document.getElementById('formEntrada').scrollIntoView({ behavior: 'smooth' });
};

// Lógica de Audio
async function toggleGrabacion() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            textoAcumulado = inputTextoLibre.value ? inputTextoLibre.value.trim() + ' ' : '';
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioFile = new File([audioBlob], `grabacion_${Date.now()}.wav`, { type: 'audio/wav' });
                archivosAdjuntos.push(audioFile);
                actualizarListaArchivos();
                clearInterval(grabacionInterval);
                statusGrabacion.style.display = 'none';
                document.getElementById('textoGrabar').textContent = 'Grabar Audio';
                btnGrabarAudio.classList.replace('btn-destructive', 'btn-secondary');
                if (recognition) recognition.stop();
            };
            mediaRecorder.start();
            if (recognition) recognition.start();
            grabacionSegundos = 0;
            statusGrabacion.style.display = 'flex';
            document.getElementById('textoGrabar').textContent = 'Detener Grabación';
            btnGrabarAudio.classList.replace('btn-secondary', 'btn-destructive');
            grabacionInterval = setInterval(() => {
                grabacionSegundos++;
                const mins = Math.floor(grabacionSegundos / 60).toString().padStart(2, '0');
                const secs = (grabacionSegundos % 60).toString().padStart(2, '0');
                tiempoGrabacionLabel.textContent = `${mins}:${secs}`;
            }, 1000);
        } catch (err) { alert('Error al acceder al micrófono.'); }
    } else { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(track => track.stop()); }
}

function actualizarListaArchivos() {
    listaArchivosAdjuntos.innerHTML = '';
    archivosAdjuntos.forEach((file, index) => {
        const tag = document.createElement('div');
        tag.className = 'archivo-tag';
        tag.innerHTML = `<span>${file.name}</span><span class="remove" onclick="removerArchivo(${index})">×</span>`;
        listaArchivosAdjuntos.appendChild(tag);
    });
}

window.removerArchivo = function(index) {
    archivosAdjuntos.splice(index, 1);
    actualizarListaArchivos();
};

init();
