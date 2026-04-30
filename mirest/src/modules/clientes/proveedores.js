document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('provTableBody');
    const searchInput = document.getElementById('provSearchInput');

    // Datos Mock de Proveedores según requerimientos
    const proveedoresData = [
        {
            id: 1,
            nombre: "Frutas y Verduras Sr. Juan",
            categoria: "Frescos - insumos diarios",
            telefono: "+51 987 123 456",
            email: "srjuan@gmail.com",
            tiempoUltimaCompra: "Hace 2 días",
            montoUltimaCompra: "S/ 340.00",
            totalMes: "2,450.00",
            wspStatus: { text: "Responde en ~5 min - Activo", color: "green" }
        },
        {
            id: 2,
            nombre: "Carnes El Bravo",
            categoria: "Cárnicos y Embutidos",
            telefono: "+51 912 345 678",
            email: "ventas@elbravo.pe",
            tiempoUltimaCompra: "Hace 5 días",
            montoUltimaCompra: "S/ 1,200.00",
            totalMes: "5,800.00",
            wspStatus: { text: "Responde en ~5 min - Activo", color: "green" }
        },
        {
            id: 3,
            nombre: "Bebidas Inca",
            categoria: "Licores y Gaseosas",
            telefono: "+51 999 888 777",
            email: "pedidos@bebidasinca.com",
            tiempoUltimaCompra: "Hace 1 día",
            montoUltimaCompra: "S/ 500.00",
            totalMes: "3,200.00",
            wspStatus: { text: "Pedido pendiente - Revisar", color: "orange" }
        },
        {
            id: 4,
            nombre: "Packaging & Bolsas",
            categoria: "Empaques Delivery",
            telefono: "+51 944 555 666",
            email: "contacto@packbolsas.com",
            tiempoUltimaCompra: "Hace 2 semanas",
            montoUltimaCompra: "S/ 800.00",
            totalMes: "1,500.00",
            wspStatus: { text: "Sin respuesta - revisar", color: "red" }
        },
        {
            id: 5,
            nombre: "Gas Lima Sur",
            categoria: "Suministros Básicos",
            telefono: "+51 988 777 444",
            email: "servicios@gaslimasur.pe",
            tiempoUltimaCompra: "Hace 1 mes",
            montoUltimaCompra: "S/ 450.00",
            totalMes: "900.00",
            wspStatus: { text: "Responde en ~5 min - Activo", color: "green" }
        }
    ];

    // Renderizar Tabla
    function renderTable(data) {
        tableBody.innerHTML = data.map(p => `
            <tr data-id="${p.id}" class="prov-row" style="cursor: pointer;">
                <td>
                    <span class="td-prov-name">${p.nombre}</span>
                    <span class="td-prov-cat">${p.categoria}</span>
                </td>
                <td>
                    <div class="td-contact-info">
                        <span><i class="fa-solid fa-phone"></i> ${p.telefono}</span>
                        <span><i class="fa-solid fa-envelope"></i> ${p.email}</span>
                    </div>
                </td>
                <td>
                    <span class="td-purchase-time">${p.tiempoUltimaCompra}</span>
                    <span class="td-purchase-amount">${p.montoUltimaCompra}</span>
                </td>
                <td class="td-total-month">S/ ${p.totalMes}</td>
                <td>
                    <span class="wsp-badge ${p.wspStatus.color}">
                        <i class="fa-brands fa-whatsapp"></i> ${p.wspStatus.text}
                    </span>
                </td>
            </tr>
        `).join('');
        document
            .querySelector('.crm-database-container')
            ?.classList.toggle('crm-database-container--empty', data.length === 0);
    }

    // Búsqueda simple
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = proveedoresData.filter(p => 
            p.nombre.toLowerCase().includes(term) || 
            p.categoria.toLowerCase().includes(term)
        );
        renderTable(filtered);
    });

    // Inicializar
    renderTable(proveedoresData);

    // Delegación de eventos para abrir el Perfil 360° del Proveedor
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.prov-row[data-id]');
        if (target?.dataset.id) {
            const prov = proveedoresData.find(p => p.id === parseInt(target.dataset.id));
            if (prov && typeof window.openProfileView === 'function') {
                // Mapeamos los datos del proveedor al formato que espera el perfil
                window.openProfileView({
                    id: prov.id,
                    nombre: prov.nombre,
                    avatar: prov.nombre.substring(0, 2).toUpperCase(),
                    tipo: 'Proveedor',
                    ltv: parseFloat(prov.totalMes.replace(/,/g, '')),
                    pedidos: Math.floor(Math.random() * 10) + 5, // Falso de momento
                    telefono: prov.telefono,
                    email: prov.email,
                    statusText: `Activo - ${prov.categoria}`,
                    comportamiento: { horario: "08:00am - 12:00pm" }
                });
            }
        }
    });
});