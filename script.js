// Variables globales
let db;
let inventarioActual = null;
let seccionActual = null;
let imagenSeleccionada = null;

// Elementos del DOM
const periodoSelect = document.getElementById('periodo');
const nuevoPeriodoNombre = document.getElementById('nuevo-periodo-nombre');
const crearPeriodoBtn = document.getElementById('crear-periodo');
const seccionSelect = document.getElementById('seccion');
const nuevaSeccionNombre = document.getElementById('nueva-seccion-nombre');
const crearSeccionBtn = document.getElementById('crear-seccion');
const filtroSeccionSelect = document.getElementById('filtro-seccion');
const inventarioItems = document.getElementById('inventario-items');
const inventarioTitulo = document.getElementById('inventario-titulo');
const eliminarInventarioBtn = document.getElementById('eliminar-inventario');

// Elementos del formulario de artículo
const nombreArticulo = document.getElementById('nombre');
const cantidadArticulo = document.getElementById('cantidad');
const estadoArticulo = document.getElementById('estado');
const descripcionArticulo = document.getElementById('descripcion');
const imagenInput = document.getElementById('imagen');
const imagenPreview = document.getElementById('imagen-preview');
const agregarArticuloBtn = document.getElementById('agregar-articulo');
const generarPdfBtn = document.getElementById('generar-pdf');

// Inicializar la base de datos
function iniciarDB() {
    const request = indexedDB.open('InventarioDB', 1);

    request.onerror = (event) => {
        console.error('Error al abrir la base de datos:', event.target.error);
        alert('Error al acceder a la base de datos');
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Crear almacén para los inventarios
        if (!db.objectStoreNames.contains('inventarios')) {
            const inventariosStore = db.createObjectStore('inventarios', { keyPath: 'id', autoIncrement: true });
            inventariosStore.createIndex('nombre', 'nombre', { unique: true });
        }

        // Crear almacén para las secciones
        if (!db.objectStoreNames.contains('secciones')) {
            const seccionesStore = db.createObjectStore('secciones', { keyPath: 'id', autoIncrement: true });
            seccionesStore.createIndex('inventarioId', 'inventarioId', { unique: false });
            seccionesStore.createIndex('nombre', 'nombre', { unique: false });
        }

        // Crear almacén para los artículos
        if (!db.objectStoreNames.contains('articulos')) {
            const articulosStore = db.createObjectStore('articulos', { keyPath: 'id', autoIncrement: true });
            articulosStore.createIndex('seccionId', 'seccionId', { unique: false });
            articulosStore.createIndex('inventarioId', 'inventarioId', { unique: false });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Base de datos abierta correctamente');

        // Cargar los inventarios existentes
        cargarInventarios();
    };
}

// Cargar todos los inventarios existentes
function cargarInventarios() {
    const transaction = db.transaction(['inventarios'], 'readonly');
    const store = transaction.objectStore('inventarios');
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
        const inventarios = getAllRequest.result;

        // Limpiar el select
        periodoSelect.innerHTML = '<option value="">-- Crear Nuevo Inventario --</option>';

        // Agregar cada inventario al select
        inventarios.forEach(inventario => {
            const option = document.createElement('option');
            option.value = inventario.id;
            option.textContent = inventario.nombre;
            periodoSelect.appendChild(option);
        });
    };

    transaction.oncomplete = () => {
        // Si no hay inventario seleccionado actualmente, ocultar el botón de eliminar
        if (!inventarioActual) {
            eliminarInventarioBtn.style.display = 'none';
        }
    };
}

// Crear un nuevo inventario
function crearInventario(nombre) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['inventarios'], 'readwrite');
        const store = transaction.objectStore('inventarios');

        const inventario = {
            nombre: nombre,
            fechaCreacion: new Date()
        };

        const addRequest = store.add(inventario);

        addRequest.onsuccess = () => {
            console.log('Inventario creado con ID:', addRequest.result);
            resolve(addRequest.result);
        };

        addRequest.onerror = (event) => {
            console.error('Error al crear el inventario:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Seleccionar un inventario
function seleccionarInventario(inventarioId) {
    return new Promise((resolve, reject) => {
        if (!inventarioId) {
            inventarioActual = null;
            seccionActual = null;
            limpiarSeccionesYArticulos();
            inventarioTitulo.textContent = 'Inventario';
            eliminarInventarioBtn.style.display = 'none';
            resolve();
            return;
        }

        const transaction = db.transaction(['inventarios'], 'readonly');
        const store = transaction.objectStore('inventarios');
        const getRequest = store.get(Number(inventarioId));

        getRequest.onsuccess = () => {
            inventarioActual = getRequest.result;
            if (inventarioActual) {
                console.log('Inventario seleccionado:', inventarioActual);
                inventarioTitulo.textContent = `Inventario: ${inventarioActual.nombre}`;
                eliminarInventarioBtn.style.display = 'inline-flex';
                cargarSecciones(inventarioActual.id);
                cargarArticulos(inventarioActual.id);
                resolve(inventarioActual);
            } else {
                reject(new Error('No se encontró el inventario'));
            }
        };

        getRequest.onerror = (event) => {
            console.error('Error al obtener el inventario:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Eliminar un inventario y todos sus datos relacionados
function eliminarInventario(inventarioId) {
    return new Promise((resolve, reject) => {
        if (!inventarioId) {
            reject(new Error('No hay inventario seleccionado'));
            return;
        }

        // Primero obtenemos todas las secciones para luego eliminar los artículos
        const transaction = db.transaction(['secciones', 'articulos', 'inventarios'], 'readwrite');

        transaction.onerror = (event) => {
            console.error('Error en la transacción:', event.target.error);
            reject(event.target.error);
        };

        // Eliminar artículos del inventario
        const articulosStore = transaction.objectStore('articulos');
        const articulosIndex = articulosStore.index('inventarioId');
        const articulosRequest = articulosIndex.getAll(Number(inventarioId));

        articulosRequest.onsuccess = () => {
            const articulos = articulosRequest.result;
            articulos.forEach(articulo => {
                articulosStore.delete(articulo.id);
            });

            // Eliminar secciones del inventario
            const seccionesStore = transaction.objectStore('secciones');
            const seccionesIndex = seccionesStore.index('inventarioId');
            const seccionesRequest = seccionesIndex.getAll(Number(inventarioId));

            seccionesRequest.onsuccess = () => {
                const secciones = seccionesRequest.result;
                secciones.forEach(seccion => {
                    seccionesStore.delete(seccion.id);
                });

                // Finalmente eliminar el inventario
                const inventariosStore = transaction.objectStore('inventarios');
                inventariosStore.delete(Number(inventarioId));
            };
        };

        transaction.oncomplete = () => {
            console.log('Inventario y datos relacionados eliminados correctamente');
            resolve();
        };
    });
}

// Limpiar las secciones y los artículos cuando se cambia de inventario
function limpiarSeccionesYArticulos() {
    seccionSelect.innerHTML = '<option value="">-- Seleccionar Sección --</option>';
    filtroSeccionSelect.innerHTML = '<option value="todas">Todas las secciones</option>';
    inventarioItems.innerHTML = '';
    limpiarFormularioArticulo();
}

// Cargar las secciones de un inventario
function cargarSecciones(inventarioId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['secciones'], 'readonly');
        const store = transaction.objectStore('secciones');
        const index = store.index('inventarioId');
        const getRequest = index.getAll(Number(inventarioId));

        getRequest.onsuccess = () => {
            const secciones = getRequest.result;

            // Limpiar los selects
            seccionSelect.innerHTML = '<option value="">-- Seleccionar Sección --</option>';
            filtroSeccionSelect.innerHTML = '<option value="todas">Todas las secciones</option>';

            // Agregar cada sección a los selects
            secciones.forEach(seccion => {
                // Agregar al select de formulario
                const option1 = document.createElement('option');
                option1.value = seccion.id;
                option1.textContent = seccion.nombre;
                seccionSelect.appendChild(option1);

                // Agregar al select de filtro
                const option2 = document.createElement('option');
                option2.value = seccion.id;
                option2.textContent = seccion.nombre;
                filtroSeccionSelect.appendChild(option2);
            });

            resolve(secciones);
        };

        getRequest.onerror = (event) => {
            console.error('Error al cargar las secciones:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Crear una nueva sección
function crearSeccion(nombre, inventarioId) {
    return new Promise((resolve, reject) => {
        if (!inventarioId) {
            reject(new Error('No hay inventario seleccionado'));
            return;
        }

        const transaction = db.transaction(['secciones'], 'readwrite');
        const store = transaction.objectStore('secciones');

        const seccion = {
            nombre: nombre,
            inventarioId: Number(inventarioId),
            fechaCreacion: new Date()
        };

        const addRequest = store.add(seccion);

        addRequest.onsuccess = () => {
            console.log('Sección creada con ID:', addRequest.result);
            resolve(addRequest.result);
        };

        addRequest.onerror = (event) => {
            console.error('Error al crear la sección:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Seleccionar una sección
function seleccionarSeccion(seccionId) {
    if (!seccionId) {
        seccionActual = null;
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['secciones'], 'readonly');
        const store = transaction.objectStore('secciones');
        const getRequest = store.get(Number(seccionId));

        getRequest.onsuccess = () => {
            seccionActual = getRequest.result;
            console.log('Sección seleccionada:', seccionActual);
            resolve(seccionActual);
        };

        getRequest.onerror = (event) => {
            console.error('Error al obtener la sección:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Función para cargar artículos (versión mejorada)
function cargarArticulos(inventarioId, seccionId = null) {
    return new Promise((resolve, reject) => {
        if (!inventarioId) {
            reject(new Error('No hay inventario seleccionado'));
            return;
        }

        const transaction = db.transaction(['articulos', 'secciones'], 'readonly');
        const articulosStore = transaction.objectStore('articulos');
        const seccionesStore = transaction.objectStore('secciones');

        // Primero obtener todas las secciones para mapear IDs a nombres
        const seccionesRequest = seccionesStore.index('inventarioId').getAll(Number(inventarioId));

        seccionesRequest.onsuccess = () => {
            const secciones = seccionesRequest.result;
            const seccionesMap = {};
            secciones.forEach(seccion => {
                seccionesMap[seccion.id] = seccion;
            });

            // Obtener los artículos según el filtro
            let articulosRequest;
            if (seccionId && seccionId !== 'todas') {
                articulosRequest = articulosStore.index('seccionId').getAll(Number(seccionId));
            } else {
                articulosRequest = articulosStore.index('inventarioId').getAll(Number(inventarioId));
            }

            articulosRequest.onsuccess = () => {
                const articulos = articulosRequest.result;

                // Limpiar el contenedor
                inventarioItems.innerHTML = '';

                if (articulos.length === 0) {
                    const noItemsMsg = document.createElement('div');
                    noItemsMsg.className = 'no-items-msg';
                    noItemsMsg.textContent = 'No hay artículos en este inventario';
                    inventarioItems.appendChild(noItemsMsg);
                } else {
                    // Mostrar cada artículo con su sección correspondiente
                    articulos.forEach(articulo => {
                        const seccion = seccionesMap[articulo.seccionId];
                        mostrarArticulo(articulo, seccion);
                    });
                }

                resolve(articulos);
            };

            articulosRequest.onerror = (event) => {
                reject(event.target.error);
            };
        };

        seccionesRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Crear un nuevo artículo
// Función para crear artículo (versión mejorada)
function crearArticulo(datosArticulo) {
    return new Promise((resolve, reject) => {
        if (!inventarioActual) {
            reject(new Error('No hay inventario seleccionado'));
            return;
        }

        if (!seccionActual) {
            reject(new Error('No hay sección seleccionada'));
            return;
        }

        const transaction = db.transaction(['articulos'], 'readwrite');
        const store = transaction.objectStore('articulos');

        const articulo = {
            nombre: datosArticulo.nombre,
            cantidad: datosArticulo.cantidad,
            estado: datosArticulo.estado,
            descripcion: datosArticulo.descripcion,
            imagen: datosArticulo.imagen,
            inventarioId: inventarioActual.id,
            seccionId: seccionActual.id,
            fechaCreacion: new Date()
        };

        const addRequest = store.add(articulo);

        addRequest.onsuccess = () => {
            console.log('Artículo creado con ID:', addRequest.result);

            // Esperar a que la transacción se complete antes de resolver
            transaction.oncomplete = () => {
                resolve(addRequest.result);
            };
        };

        addRequest.onerror = (event) => {
            console.error('Error al crear el artículo:', event.target.error);
            reject(event.target.error);
        };

        transaction.onerror = (event) => {
            console.error('Error en la transacción:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Eliminar un artículo
function eliminarArticulo(articuloId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['articulos'], 'readwrite');
        const store = transaction.objectStore('articulos');

        const deleteRequest = store.delete(Number(articuloId));

        deleteRequest.onsuccess = () => {
            console.log('Artículo eliminado correctamente');
            resolve();
        };

        deleteRequest.onerror = (event) => {
            console.error('Error al eliminar el artículo:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Mostrar un artículo en el DOM
function mostrarArticulo(articulo, seccion) {
    const articuloCard = document.createElement('div');
    articuloCard.className = 'articulo-card';
    articuloCard.dataset.id = articulo.id;

    let imagenHTML = '';
    if (articulo.imagen) {
        imagenHTML = `
            <div class="articulo-img-container">
                <img src="${articulo.imagen}" alt="${articulo.nombre}" class="articulo-img">
            </div>
        `;
    }

    articuloCard.innerHTML = `
        <div class="articulo-header">
            <h3>${articulo.nombre}</h3>
            <span class="estado-badge estado-${articulo.estado.toLowerCase()}">${articulo.estado}</span>
        </div>
        <div class="articulo-body">
            <span class="seccion-badge">${seccion ? seccion.nombre : 'Sin sección'}</span>
            <div class="articulo-info">
                <span class="articulo-label">Cantidad:</span>
                <span class="articulo-value">${articulo.cantidad}</span>
                
                <span class="articulo-label">Descripción:</span>
                <span class="articulo-value">${articulo.descripcion || 'Sin descripción'}</span>
            </div>
            ${imagenHTML}
            <div class="articulo-actions">
                <button class="btn btn-danger btn-eliminar-articulo" data-id="${articulo.id}">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;

    // Agregar evento para eliminar el artículo
    const btnEliminar = articuloCard.querySelector('.btn-eliminar-articulo');
    btnEliminar.addEventListener('click', (e) => {
        e.preventDefault();
        const articuloId = e.currentTarget.dataset.id;
        if (confirm('¿Estás seguro de que deseas eliminar este artículo?')) {
            eliminarArticulo(articuloId)
                .then(() => {
                    articuloCard.remove();
                    // Si no hay más artículos, mostrar mensaje
                    if (inventarioItems.children.length === 0) {
                        const noItemsMsg = document.createElement('div');
                        noItemsMsg.className = 'no-items-msg';
                        noItemsMsg.textContent = 'No hay artículos en este inventario';
                        inventarioItems.appendChild(noItemsMsg);
                    }
                })
                .catch(error => {
                    alert('Error al eliminar el artículo: ' + error.message);
                });
        }
    });

    inventarioItems.appendChild(articuloCard);
}

// Limpiar el formulario de artículo
function limpiarFormularioArticulo() {
    nombreArticulo.value = '';
    cantidadArticulo.value = '1';
    estadoArticulo.value = 'Nuevo';
    descripcionArticulo.value = '';
    imagenInput.value = '';
    imagenPreview.innerHTML = '';
    imagenSeleccionada = null;
}
// Obtener el color según el estado del artículo
function getEstadoColor(estado) {
    switch (estado) {
        case 'Nuevo':
            return '#28a745'; // Verde
        case 'Bueno':
            return '#17a2b8'; // Azul
        case 'Regular':
            return '#ffc107'; // Amarillo
        case 'Malo':
            return '#dc3545'; // Rojo
        default:
            return '#6c757d'; // Gris
    }
}

function generarPDF() {
    if (!inventarioActual) {
        alert('No hay inventario seleccionado');
        return;
    }

    // Mostrar mensaje de carga
    const loadingMessage = document.createElement('div');
    loadingMessage.textContent = 'Generando PDF, por favor espere...';
    loadingMessage.style.position = 'fixed';
    loadingMessage.style.top = '50%';
    loadingMessage.style.left = '50%';
    loadingMessage.style.transform = 'translate(-50%, -50%)';
    loadingMessage.style.backgroundColor = 'white';
    loadingMessage.style.padding = '20px';
    loadingMessage.style.border = '1px solid #ccc';
    loadingMessage.style.borderRadius = '5px';
    loadingMessage.style.zIndex = '1000';
    document.body.appendChild(loadingMessage);

    // Obtener todos los artículos y secciones del inventario
    const transaction = db.transaction(['articulos', 'secciones'], 'readonly');
    const articulosStore = transaction.objectStore('articulos');
    const seccionesStore = transaction.objectStore('secciones');

    // Obtener todas las secciones del inventario
    const seccionesRequest = seccionesStore.index('inventarioId').getAll(inventarioActual.id);

    seccionesRequest.onsuccess = () => {
        const secciones = seccionesRequest.result;
        const seccionesMap = {};
        secciones.forEach(seccion => {
            seccionesMap[seccion.id] = seccion;
        });

        // Obtener todos los artículos del inventario
        const articulosRequest = articulosStore.index('inventarioId').getAll(inventarioActual.id);

        articulosRequest.onsuccess = async () => {
            const articulos = articulosRequest.result;

            // Verificar si hay artículos
            if (articulos.length === 0) {
                document.body.removeChild(loadingMessage);
                alert('No hay artículos en este inventario para generar el PDF');
                return;
            }

            // Inicializar el PDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const contentWidth = pageWidth - (margin * 2);

            // ===== CREAR PORTADA =====
            await crearPortada(pdf, pageWidth, pageHeight, margin);

            // Añadir nueva página para el contenido del inventario
            pdf.addPage();

            // Función para añadir encabezado común a cada página de contenido
            const addHeader = () => {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(16);
                pdf.setTextColor(0, 58, 77);
                pdf.text(`Inventario: ${inventarioActual.nombre}`, pageWidth / 2, margin + 5, { align: 'center' });
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(10);
                pdf.setTextColor(0, 0, 0);
                pdf.text(`Fecha del informe: ${new Date().toLocaleDateString()}`, margin, margin + 15);
                pdf.text(`Total de artículos: ${articulos.length}`, pageWidth - margin, margin + 15, { align: 'right' });

                // Línea separadora
                pdf.setDrawColor(0, 58, 77);
                pdf.line(margin, margin + 18, pageWidth - margin, margin + 18);

                return margin + 25;
            };

            // Agrupar artículos por sección
            const articulosPorSeccion = {};
            articulos.forEach(articulo => {
                const seccionId = articulo.seccionId;
                if (!articulosPorSeccion[seccionId]) {
                    articulosPorSeccion[seccionId] = [];
                }
                articulosPorSeccion[seccionId].push(articulo);
            });

            // Comenzar con la primera página de contenido y agregar encabezado
            let yPos = addHeader();
            let isFirstPage = true;

            // Procesar cada sección
            for (const seccionId in articulosPorSeccion) {
                const seccion = seccionesMap[seccionId];
                const articulosSeccion = articulosPorSeccion[seccionId];

                // Si no hay espacio suficiente para el título de la sección y al menos una fila, añadir nueva página
                if (!isFirstPage && yPos > pageHeight - 50) {
                    pdf.addPage();
                    yPos = addHeader();
                }

                // Título de la sección
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(0, 58, 77);
                pdf.text(seccion ? seccion.nombre : 'Sin sección', margin, yPos);

                // Línea debajo del título de la sección
                pdf.setDrawColor(0, 58, 77);
                pdf.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

                yPos += 10;

                // Configuración de la tabla
                const headers = ['Nombre', 'Cantidad', 'Estado', 'Descripción'];
                const columnWidths = [60, 25, 30, 65];
                const rowHeight = 10;

                // Encabezados de la tabla
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);

                let xPos = margin;
                for (let i = 0; i < headers.length; i++) {
                    pdf.setFillColor(0, 58, 77);
                    pdf.rect(xPos, yPos, columnWidths[i], rowHeight, 'F');

                    pdf.setTextColor(255, 255, 255);
                    pdf.text(
                        headers[i],
                        xPos + (columnWidths[i] / 2),
                        yPos + (rowHeight / 2),
                        {
                            align: 'center',
                            baseline: 'middle'
                        }
                    );

                    pdf.rect(xPos, yPos, columnWidths[i], rowHeight);
                    xPos += columnWidths[i];
                }

                pdf.setFillColor(249, 249, 249);
                pdf.setTextColor(0, 0, 0);
                yPos += rowHeight;

                // Contenido de la tabla
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(0, 0, 0);
                pdf.setFillColor(249, 249, 249);

                for (let i = 0; i < articulosSeccion.length; i++) {
                    const articulo = articulosSeccion[i];

                    if (yPos > pageHeight - 20) {
                        pdf.addPage();
                        yPos = addHeader();

                        pdf.setFillColor(0, 58, 77);
                        pdf.setTextColor(255, 255, 255);
                        pdf.setFont('helvetica', 'bold');

                        xPos = margin;
                        for (let j = 0; j < headers.length; j++) {
                            pdf.rect(xPos, yPos, columnWidths[j], rowHeight, 'F');
                            pdf.text(headers[j], xPos + (columnWidths[j] / 2), yPos + (rowHeight / 2), {
                                align: 'center',
                                baseline: 'middle'
                            });
                            xPos += columnWidths[j];
                        }

                        yPos += rowHeight;
                        pdf.setFont('helvetica', 'normal');
                        pdf.setTextColor(0, 0, 0);
                    }

                    if (i % 2 === 0) {
                        pdf.setFillColor(249, 249, 249);
                        xPos = margin;
                        for (let j = 0; j < headers.length; j++) {
                            pdf.rect(xPos, yPos, columnWidths[j], rowHeight, 'F');
                            xPos += columnWidths[j];
                        }
                    } else {
                        pdf.setFillColor(255, 255, 255);
                    }

                    let colorEstado;
                    switch (articulo.estado) {
                        case 'Nuevo':
                            colorEstado = [40, 167, 69];
                            break;
                        case 'Bueno':
                            colorEstado = [23, 162, 184];
                            break;
                        case 'Regular':
                            colorEstado = [255, 193, 7];
                            break;
                        case 'Defectuoso':
                        case 'Malo':
                            colorEstado = [220, 53, 69];
                            break;
                        default:
                            colorEstado = [108, 117, 125];
                    }

                    xPos = margin;

                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(0, 0, 0);
                    pdf.text(articulo.nombre.substring(0, 25), xPos + 2, yPos + (rowHeight / 2), {
                        baseline: 'middle'
                    });
                    xPos += columnWidths[0];

                    pdf.text(articulo.cantidad.toString(), xPos + (columnWidths[1] / 2), yPos + (rowHeight / 2), {
                        align: 'center',
                        baseline: 'middle'
                    });
                    xPos += columnWidths[1];

                    const estadoX = xPos + (columnWidths[2] / 2);
                    const estadoY = yPos + (rowHeight / 2);

                    pdf.setFillColor(...colorEstado);
                    pdf.roundedRect(estadoX - 10, estadoY - 3, 20, 6, 1, 1, 'F');

                    if (articulo.estado === 'Regular') {
                        pdf.setTextColor(51, 51, 51);
                    } else {
                        pdf.setTextColor(255, 255, 255);
                    }
                    pdf.setFontSize(8);
                    pdf.text(articulo.estado, estadoX, estadoY, {
                        align: 'center',
                        baseline: 'middle'
                    });
                    xPos += columnWidths[2];

                    pdf.setTextColor(0, 0, 0);
                    pdf.setFontSize(10);
                    const descripcion = articulo.descripcion || '-';
                    pdf.text(descripcion.substring(0, 30), xPos + 2, yPos + (rowHeight / 2), {
                        baseline: 'middle'
                    });

                    yPos += rowHeight;
                }

                yPos += 10;
                isFirstPage = false;
            }

            // Sección de imágenes
            const articulosConImagen = articulos.filter(articulo => articulo.imagen);

            if (articulosConImagen.length > 0) {
                if (yPos > pageHeight - 50) {
                    pdf.addPage();
                    yPos = addHeader();
                }

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(14);
                pdf.setTextColor(0, 58, 77);
                pdf.text('Imágenes del Inventario', margin, yPos);

                pdf.setDrawColor(0, 58, 77);
                pdf.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

                yPos += 10;

                const imageWidth = (contentWidth - 10) / 2;
                const imageHeight = 100;

                let currentX = margin;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                for (let i = 0; i < articulosConImagen.length; i++) {
                    const articulo = articulosConImagen[i];
                    const seccion = seccionesMap[articulo.seccionId];

                    if (currentX === margin && yPos + imageHeight + 30 > pageHeight) {
                        pdf.addPage();
                        yPos = addHeader();
                    }

                    pdf.setDrawColor(221, 221, 221);
                    pdf.setFillColor(249, 249, 249);
                    pdf.roundedRect(currentX, yPos, imageWidth, imageHeight + 20, 1, 1, 'FD');

                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(10);
                    pdf.setTextColor(0, 0, 0);
                    pdf.text(articulo.nombre.substring(0, 25), currentX + 5, yPos + 5);

                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(8);
                    pdf.setTextColor(85, 85, 85);
                    pdf.text(`Sección: ${seccion ? seccion.nombre : 'Sin sección'}`, currentX + 5, yPos + 10);

                    const img = document.createElement('img');
                    img.src = articulo.imagen;

                    const processImage = new Promise((resolve) => {
                        img.onload = function () {
                            const aspectRatio = img.width / img.height;
                            let drawWidth = imageWidth - 10;
                            let drawHeight = drawWidth / aspectRatio;

                            if (drawHeight > imageHeight - 10) {
                                drawHeight = imageHeight - 15;
                                drawWidth = drawHeight * aspectRatio;
                            }

                            const imageX = currentX + ((imageWidth - drawWidth) / 2);

                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0, img.width, img.height);

                            const imgData = canvas.toDataURL('image/jpeg');
                            pdf.addImage(imgData, 'JPEG', imageX, yPos + 20, drawWidth, drawHeight);

                            resolve();
                        };

                        img.onerror = function () {
                            pdf.setTextColor(220, 53, 69);
                            pdf.text('Error al cargar la imagen', currentX + 5, yPos + 25);
                            resolve();
                        };
                    });

                    await processImage;

                    if (currentX === margin) {
                        currentX = margin + imageWidth + 10;
                    } else {
                        currentX = margin;
                        yPos += imageHeight + 30;
                    }
                }

                if (currentX !== margin) {
                    yPos += imageHeight + 30;
                }
            }

            // Eliminar el mensaje de carga
            document.body.removeChild(loadingMessage);

            // Guardar el PDF
            pdf.save(`Inventario_${inventarioActual.nombre}_${new Date().toISOString().split('T')[0]}.pdf`);
        };

        articulosRequest.onerror = (error) => {
            document.body.removeChild(loadingMessage);
            console.error('Error al obtener los artículos:', error);
            alert('Error al obtener los artículos para el PDF');
        };
    };

    seccionesRequest.onerror = (error) => {
        document.body.removeChild(loadingMessage);
        console.error('Error al obtener las secciones:', error);
        alert('Error al obtener las secciones para el PDF');
    };
}

// Función para crear la portada del PDF
async function crearPortada(pdf, pageWidth, pageHeight, margin) {
    // Fondo degradado (simulado con rectángulos)
    pdf.setFillColor(0, 58, 77); // Color principal de Vacasa
    pdf.rect(0, 0, pageWidth, pageHeight / 3, 'F');
    
    pdf.setFillColor(240, 248, 255); // Color azul muy claro
    pdf.rect(0, pageHeight / 3, pageWidth, pageHeight * 2/3, 'F');

    // Obtener el logo de Vacasa del HTML
    const logoImg = document.querySelector('.logo');
    
    if (logoImg && logoImg.complete) {
        // Crear canvas para procesar el logo
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Configurar el canvas con las dimensiones de la imagen
        canvas.width = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        
        // Dibujar la imagen en el canvas
        ctx.drawImage(logoImg, 0, 0);
        
        // Convertir a base64
        const logoData = canvas.toDataURL('image/jpeg');
        
        // Calcular dimensiones del logo en el PDF (máximo 40mm de ancho)
        const maxLogoWidth = 40;
        const logoAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
        const logoWidth = maxLogoWidth;
        const logoHeight = logoWidth / logoAspectRatio;
        
        // Centrar el logo horizontalmente
        const logoX = (pageWidth - logoWidth) / 2;
        const logoY = 30;
        
        // Añadir el logo al PDF
        pdf.addImage(logoData, 'JPEG', logoX, logoY, logoWidth, logoHeight);
    }

    // Título principal
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(28);
    pdf.setTextColor(255, 255, 255); // Blanco
    pdf.text('INVENTARIO', pageWidth / 2, 90, { align: 'center' });

    // Nombre del inventario
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor(0, 58, 77); // Color principal
    pdf.text(inventarioActual.nombre.toUpperCase(), pageWidth / 2, 140, { align: 'center' });

    // Línea decorativa
    pdf.setDrawColor(0, 58, 77);
    pdf.setLineWidth(2);
    pdf.line(margin + 20, 150, pageWidth - margin - 20, 150);

    // Información adicional
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(85, 85, 85); // Gris oscuro
    

    // Información del sistema
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(128, 128, 128); // Gris claro
    pdf.text('Sistema de Inventario de Condominios', pageWidth / 2, pageHeight - 30, { align: 'center' });
    pdf.text('© 2025 Vacasa', pageWidth / 2, pageHeight - 20, { align: 'center' });

    // Decoración adicional - Rectángulo con bordes redondeados
    pdf.setDrawColor(0, 58, 77);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(margin + 10, 120, pageWidth - (margin * 2) - 20, 80, 5, 5, 'D');
}

// Función para manejar la subida de imágenes
function manejarSubidaImagen(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        imagenSeleccionada = e.target.result;

        // Mostrar la imagen previa
        imagenPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = imagenSeleccionada;
        img.classList.add('preview-img');
        imagenPreview.appendChild(img);

        // Botón para eliminar la imagen seleccionada
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'remove-img-btn');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => {
            imagenPreview.innerHTML = '';
            imagenInput.value = '';
            imagenSeleccionada = null;
        });
        imagenPreview.appendChild(removeBtn);
    };

    reader.readAsDataURL(file);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Iniciar la base de datos
    iniciarDB();

    // Evento para cambiar de inventario
    periodoSelect.addEventListener('change', () => {
        const inventarioId = periodoSelect.value;
        seleccionarInventario(inventarioId)
            .then(() => {
                // Deshabilitar el input de nuevo inventario si hay uno seleccionado
                if (inventarioId) {
                    nuevoPeriodoNombre.disabled = true;
                    crearPeriodoBtn.disabled = true;
                } else {
                    nuevoPeriodoNombre.disabled = false;
                    crearPeriodoBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error al seleccionar el inventario:', error);
                alert('Error al seleccionar el inventario: ' + error.message);
            });
    });

    // Evento para crear un nuevo inventario
    crearPeriodoBtn.addEventListener('click', () => {
        const nombre = nuevoPeriodoNombre.value.trim();
        if (!nombre) {
            alert('Por favor, ingrese un nombre para el inventario');
            return;
        }

        crearInventario(nombre)
            .then(inventarioId => {
                cargarInventarios();
                periodoSelect.value = inventarioId;
                seleccionarInventario(inventarioId);
                nuevoPeriodoNombre.value = '';

                // Deshabilitar el input de nuevo inventario
                nuevoPeriodoNombre.disabled = true;
                crearPeriodoBtn.disabled = true;
            })
            .catch(error => {
                console.error('Error al crear el inventario:', error);
                alert('Error al crear el inventario: ' + error.message);
            });
    });

    // Evento para eliminar un inventario
    eliminarInventarioBtn.addEventListener('click', () => {
        if (!inventarioActual) {
            alert('No hay inventario seleccionado');
            return;
        }

        if (confirm(`¿Estás seguro de que deseas eliminar el inventario "${inventarioActual.nombre}" y todos sus datos?`)) {
            eliminarInventario(inventarioActual.id)
                .then(() => {
                    cargarInventarios();
                    periodoSelect.value = '';
                    seleccionarInventario('');

                    // Habilitar el input de nuevo inventario
                    nuevoPeriodoNombre.disabled = false;
                    crearPeriodoBtn.disabled = false;
                })
                .catch(error => {
                    console.error('Error al eliminar el inventario:', error);
                    alert('Error al eliminar el inventario: ' + error.message);
                });
        }
    });

    // Evento para cambiar de sección
    seccionSelect.addEventListener('change', () => {
        const seccionId = seccionSelect.value;
        seleccionarSeccion(seccionId);
    });

    // Evento para crear una nueva sección
    crearSeccionBtn.addEventListener('click', () => {
        const nombre = nuevaSeccionNombre.value.trim();
        if (!nombre) {
            alert('Por favor, ingrese un nombre para la sección');
            return;
        }

        if (!inventarioActual) {
            alert('Por favor, seleccione un inventario primero');
            return;
        }

        crearSeccion(nombre, inventarioActual.id)
            .then(seccionId => {
                cargarSecciones(inventarioActual.id)
                    .then(() => {
                        seccionSelect.value = seccionId;
                        seleccionarSeccion(seccionId);
                        nuevaSeccionNombre.value = '';
                    });
            })
            .catch(error => {
                console.error('Error al crear la sección:', error);
                alert('Error al crear la sección: ' + error.message);
            });
    });

    // Evento para filtrar artículos por sección
    filtroSeccionSelect.addEventListener('change', () => {
        if (!inventarioActual) return;

        const seccionId = filtroSeccionSelect.value;
        cargarArticulos(inventarioActual.id, seccionId === 'todas' ? null : seccionId);
    });

    // Evento para subir imagen
    imagenInput.addEventListener('change', manejarSubidaImagen);

    // Evento para agregar un nuevo artículo
    agregarArticuloBtn.addEventListener('click', async () => {
        if (!inventarioActual) {
            alert('Por favor, seleccione un inventario primero');
            return;
        }

        if (!seccionActual) {
            alert('Por favor, seleccione una sección primero');
            return;
        }

        const nombre = nombreArticulo.value.trim();
        if (!nombre) {
            alert('Por favor, ingrese un nombre para el artículo');
            return;
        }

        const cantidad = parseInt(cantidadArticulo.value);
        if (isNaN(cantidad)) {
            alert('Por favor, ingrese una cantidad válida');
            return;
        }

        try {
            const datosArticulo = {
                nombre: nombre,
                cantidad: cantidad,
                estado: estadoArticulo.value,
                descripcion: descripcionArticulo.value.trim(),
                imagen: imagenSeleccionada
            };

            await crearArticulo(datosArticulo);

            // Recargar artículos manteniendo el filtro actual
            const seccionFiltro = filtroSeccionSelect.value === 'todas' ? null : filtroSeccionSelect.value;
            await cargarArticulos(inventarioActual.id, seccionFiltro);

            limpiarFormularioArticulo();
        } catch (error) {
            console.error('Error al crear el artículo:', error);
            alert('Error al crear el artículo: ' + error.message);
        }
    });

    // Evento para generar PDF
    generarPdfBtn.addEventListener('click', generarPDF);
});