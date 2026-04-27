/**
 * Inyecta componentes compartidos del CRM en el DOM.
 * Esto nos ahorra copiar y pegar el mismo HTML en cada archivo.
 */
(function() {
  // Si el flyout ya existe, no hacemos nada (por seguridad)
  if (document.getElementById('crm-flyout')) return;

  const flyoutHTML = `
    <!-- ============================================================
         PANEL FLYOUT CRM (Dropdown) - Inyectado vía JS
    ============================================================ -->
    <div id="crm-flyout" class="flyout-hidden">
      <header class="flyout-header">
        <h2>CRM</h2>
        <p>12 pantallas · Gestión integral</p>
      </header>
      <div class="flyout-body">
        <section class="flyout-section">
          <h3 class="section-title">ANALYTICS <span class="screen-count">(1 pantalla)</span></h3>
          <ul class="section-links">
            <li><a href="dashboard-crm.html">001 Dashboard CRM</a></li>
          </ul>
        </section>
        <section class="flyout-section">
          <h3 class="section-title">COMUNICACIÓN <span class="screen-count">(2 pantallas)</span></h3>
          <ul class="section-links">
            <li><a href="inbox-whatsapp.html">002 Inbox WhatsApp</a></li>
            <li><a href="campanas.html">003 Campañas</a></li>
          </ul>
        </section>
        <section class="flyout-section">
          <h3 class="section-title">CLIENTES <span class="screen-count">(3 pantallas)</span></h3>
          <ul class="section-links">
            <li><a href="clientes.html">004 Lista de Clientes</a></li>
            <li><a href="lead-scoring.html">005 Lead Scoring RFM</a></li>
            <li><a href="nurturing.html">006 Tipo y Nurturing</a></li>
          </ul>
        </section>
        <section class="flyout-section">
          <h3 class="section-title">PROVEEDORES <span class="screen-count">(1 pantalla)</span></h3>
          <ul class="section-links">
            <li><a href="proveedores.html">007 Lista Proveedores</a></li>
          </ul>
        </section>
      </div>
    </div>
  `;

  // Inyectar al final del body para que los scripts posteriores lo detecten sin problemas
  document.body.insertAdjacentHTML('beforeend', flyoutHTML);

  // ============================================================
  //   PERFIL 360° - INYECCIÓN GLOBAL
  // ============================================================
  if (!document.getElementById('clientProfileModal')) {
    const profileHTML = `
      <div id="clientProfileModal" class="client-profile-modal">
        <div class="profile-modal-content saas-profile">
          <button class="btn-icon profile-close-btn" id="btnCloseProfile" aria-label="Cerrar perfil">
            <i data-lucide="x"></i>
          </button>
          <aside class="saas-profile-sidebar">
            <div class="saas-avatar-section">
              <div class="saas-avatar" id="profileAvatar">MG</div>
              <h3 id="profileName">—</h3>
              <span class="saas-badge" id="profileStatusBadge">Activo - Cliente desde Ene 2024</span>
            </div>
            <div class="saas-kpi-orange">
              <span class="saas-kpi-title" id="profileOrangeTitle">Consumo del Mes</span>
              <strong class="saas-kpi-value" id="profileMonthTotal">S/ 450.00</strong>
              <div class="saas-kpi-details" id="profileOrangeDetails">
                <span id="profileMonthOrders">4 pedidos</span> • <span id="profileMonthAvg">S/ 112.50 prom.</span>
              </div>
            </div>
            <div class="saas-kpi-yellow" id="profileDebtBox" style="display: none;">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <div class="saas-debt-info">
                <strong id="profileDebtAmount">S/ 50.00 por pagar</strong>
                <span id="profileDebtDetails">1 cuenta pendiente</span>
              </div>
            </div>
            <div class="saas-info-group">
              <h4 id="profileScoreTitle">Performance & SLA</h4>
              <div class="saas-score">
                <div class="stars" id="profileStars">
                  <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star-half-stroke"></i>
                </div>
                <strong id="profileScore">4.9/5</strong>
              </div>
              <span class="saas-subtext" id="profileScoreDesc">Puntualidad y retención alta</span>
            </div>
            <div class="saas-info-group">
              <h4 id="profileContactTitle">Datos de Contacto</h4>
              <a href="#" target="_blank" class="btn-whatsapp" id="btnProfileWsp">
                <i class="fa-brands fa-whatsapp"></i> Contactar por WhatsApp
              </a>
              <ul class="saas-contact-list" id="profileContactList"></ul>
            </div>
          </aside>
          <main class="saas-profile-main">
            <div class="saas-top-kpis">
              <div class="saas-top-kpi">
                <span class="kpi-label" id="profileTop1Title">Lifetime Value (LTV)</span>
                <strong class="kpi-value" id="profileLtvTop">S/ 1,840.00</strong>
              </div>
              <div class="saas-top-kpi">
                <span class="kpi-label" id="profileTop2Title">Órdenes Históricas</span>
                <strong class="kpi-value" id="profileTotalOrders">12</strong>
              </div>
              <div class="saas-top-kpi">
                <span class="kpi-label" id="profileTop3Title">Fidelidad / Retención</span>
                <strong class="kpi-value highlight" id="profileRetention">92%</strong>
              </div>
            </div>
            <div class="saas-tabs">
              <button class="saas-tab active" data-target="tab-pedidos" id="tabBtn1">Pedidos</button>
              <button class="saas-tab" data-target="tab-preferencias" id="tabBtn2">Preferencias</button>
              <button class="saas-tab" data-target="tab-pagos" id="tabBtn3">Pagos</button>
              <button class="saas-tab" data-target="tab-mensajes" id="tabBtn4">Mensajes</button>
            </div>
            <div class="saas-tab-content">
              <div id="tab-pedidos" class="saas-panel active">
                <table class="saas-table">
                  <thead id="tab1Thead"><tr><th>FECHA / ID</th><th>DETALLE DE ÍTEMS</th><th>TOTAL</th><th>ESTADO ENTREGA</th></tr></thead>
                  <tbody id="saas-order-history"></tbody>
                </table>
              </div>
              <div id="tab-preferencias" class="saas-panel"><div id="saas-preferences-content"></div></div>
              <div id="tab-pagos" class="saas-panel"><div id="saas-payment-history-container"></div></div>
              <div id="tab-mensajes" class="saas-panel"><div id="saas-chat-history"></div></div>
            </div>
          </main>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', profileHTML);
  }

  // FUNCIÓN GLOBAL PARA ABRIR PERFILES
  window.openProfileView = function(client) {
      if (!client) return;
      const modal = document.getElementById('clientProfileModal');
      if (!modal) return;

      document.getElementById('profileAvatar').textContent = client.avatar || client.nombre.substring(0, 2).toUpperCase();
      document.getElementById('profileName').textContent = client.nombre;
      document.getElementById('profileStatusBadge').textContent = client.statusText || `Activo - Cliente desde ${new Date().getFullYear() - 1}`;

      const ltv = client.ltv || 0;
      const isProv = client.tipo === 'Proveedor';

      // =========================================================
      // CAMBIO DE TÍTULOS DEPENDIENDO SI ES CLIENTE O PROVEEDOR
      // =========================================================
      document.getElementById('profileOrangeTitle').textContent = isProv ? 'Performance Logístico' : 'Consumo del Mes';
      document.getElementById('profileScoreTitle').textContent  = isProv ? 'Evaluación de Performance' : 'Performance & SLA';
      document.getElementById('profileContactTitle').textContent= isProv ? 'Legal & Logística'     : 'Datos de Contacto';
      document.getElementById('profileTop1Title').textContent   = isProv ? 'Gasto Histórico'       : 'Lifetime Value (LTV)';
      document.getElementById('profileTop2Title').textContent   = isProv ? 'Tasa de Cumplimiento'  : 'Órdenes Históricas';
      document.getElementById('profileTop3Title').textContent   = isProv ? 'Lead Time Promedio'    : 'Fidelidad / Retención';
      
      document.getElementById('tabBtn1').textContent = isProv ? 'Catálogo' : 'Pedidos';
      document.getElementById('tabBtn2').textContent = isProv ? 'Pagos'    : 'Preferencias';
      document.getElementById('tabBtn3').textContent = isProv ? 'Mensajes' : 'Pagos';
      document.getElementById('tabBtn4').textContent = isProv ? 'Compras'  : 'Mensajes';
      
      document.getElementById('profileStars').innerHTML = isProv ? '<i class="fa-solid fa-chart-line" style="color:#ea580c;"></i>' : '<i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star-half-stroke"></i>';

      const debtBox = document.getElementById('profileDebtBox');
      if (isProv || Math.random() > 0.8) {
          debtBox.style.display = 'flex';
          document.getElementById('profileDebtAmount').textContent = isProv ? `S/ ${(Math.random() * 1500 + 200).toFixed(2)} por pagar` : `S/ ${(Math.random() * 150).toFixed(2)} por pagar`;
          document.getElementById('profileDebtDetails').textContent = isProv ? 'Vence en 24 hrs (Crédito: 15 días)' : '1 cuenta pendiente';
      } else {
          debtBox.style.display = 'none';
      }

      document.getElementById('btnProfileWsp').href = `https://wa.me/${(client.telefono || '').replace(/\D/g,'')}`;
      document.getElementById('profileLtvTop').textContent = `S/ ${ltv.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

      if (isProv) {
          // =========================================================
          // DATA EXCLUSIVA PARA PROVEEDORES
          // =========================================================
          document.getElementById('profileScore').textContent = '95/100';
          document.getElementById('profileScoreDesc').textContent = 'Puntualidad, calidad y precios';
          
          document.getElementById('profileMonthTotal').textContent = '98.5%';
          document.getElementById('profileOrangeDetails').innerHTML = '<span>Tasa de Cumplimiento</span> • <span>Fill Rate</span>';
          
          document.getElementById('profileContactList').innerHTML = `
              <li><i class="fa-solid fa-file-invoice"></i> <span><strong>RUC:</strong> 20${Math.floor(Math.random()*80000000+10000000)}</span></li>
              <li><i class="fa-solid fa-building"></i> <span><strong>Razón Social:</strong> ${client.nombre} S.A.C.</span></li>
              <li><i class="fa-solid fa-stopwatch"></i> <span><strong>Cut-off Pedido:</strong> Antes de 11:00 PM</span></li>
              <li><i class="fa-solid fa-truck"></i> <span><strong>Días Visita:</strong> Mar - Jue - Sáb</span></li>
              <li><i class="fa-solid fa-money-bill"></i> <span><strong>Pedido Mínimo:</strong> S/ 150.00</span></li>
          `;

          document.getElementById('profileTotalOrders').textContent = '95.0%'; // Fill rate simulado
          document.getElementById('profileRetention').textContent = '1.5 días'; // Lead Time

          // TABLA 1: CATÁLOGO
          document.getElementById('tab-pedidos').innerHTML = `
            <div style="padding: 24px;">
                <div style="margin-bottom: 20px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <input type="text" placeholder="Buscar insumos..." class="form-control" style="flex:1; max-width:300px; padding: 10px 14px;">
                    <select class="form-control" style="width: 160px; padding: 10px 14px;">
                        <option>Categorías</option>
                        <option>Verduras</option>
                        <option>Cárnicos</option>
                    </select>
                    <button id="btnNewInsumo" class="btn-new" style="border-radius: 8px; padding: 10px 16px;"><i class="fa-solid fa-plus"></i> Nuevo Insumo</button>
                </div>
                <div id="catalogGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
                    <div class="saas-top-kpi" style="padding: 16px; border-radius: 12px;">
                        <span class="status-badge status-ontime" style="float:right; font-size:10px; padding:4px 8px;">En stock</span>
                        <h4 style="margin:0 0 4px; color:#0f172a; font-size:15px;">Ají Amarillo</h4>
                        <span style="font-size:12px; color:#64748b;">Verduras y Frescos</span>
                        <strong style="display:block; font-size:20px; margin: 12px 0 4px; color:#0f172a;">S/ 4.50 <span style="font-size:13px; color:#64748b; font-weight:normal;">/ kg</span></strong>
                        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #e2e8f0;">
                            <span style="font-size:12px; color:#ea580c; font-weight:700;"><i class="fa-solid fa-box"></i> Pedido Mín: 5 kg</span>
                        </div>
                    </div>
                    <div class="saas-top-kpi" style="padding: 16px; border-radius: 12px;">
                        <span class="status-badge status-ontime" style="float:right; font-size:10px; padding:4px 8px;">En stock</span>
                        <h4 style="margin:0 0 4px; color:#0f172a; font-size:15px;">Papa Blanca</h4>
                        <span style="font-size:12px; color:#64748b;">Tubérculos</span>
                        <strong style="display:block; font-size:20px; margin: 12px 0 4px; color:#0f172a;">S/ 2.20 <span style="font-size:13px; color:#64748b; font-weight:normal;">/ kg</span></strong>
                        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #e2e8f0;">
                            <span style="font-size:12px; color:#ea580c; font-weight:700;"><i class="fa-solid fa-box"></i> Pedido Mín: 50 kg</span>
                        </div>
                    </div>
                    <div class="saas-top-kpi" style="padding: 16px; border-radius: 12px; opacity: 0.85;">
                        <span class="status-badge status-delayed" style="float:right; font-size:10px; padding:4px 8px; background:#f1f5f9; color:#64748b;">Agotado</span>
                        <h4 style="margin:0 0 4px; color:#0f172a; font-size:15px;">Limón Sutil</h4>
                        <span style="font-size:12px; color:#64748b;">Frutas/Cítricos</span>
                        <strong style="display:block; font-size:20px; margin: 12px 0 4px; color:#0f172a;">S/ 8.00 <span style="font-size:13px; color:#64748b; font-weight:normal;">/ kg</span></strong>
                        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #e2e8f0;">
                            <span style="font-size:12px; color:#ea580c; font-weight:700;"><i class="fa-solid fa-box"></i> Pedido Mín: 10 kg</span>
                        </div>
                    </div>
                </div>
            </div>
          `;

          // TABLA 2: PAGOS
          document.getElementById('tab-preferencias').innerHTML = `
            <div style="padding: 24px;">
               <div style="display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap;">
                   <div style="flex: 1; min-width: 250px; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                       <h4 style="margin:0 0 16px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Información Legal y Bancaria</h4>
                       <div style="display:flex; flex-direction:column; gap:12px;">
                           <div style="display:flex; justify-content:space-between;"><span style="color:#475569; font-size:13px;">RUC</span><strong style="font-size:13px; color:#0f172a;">20123456789</strong></div>
                           <div style="display:flex; justify-content:space-between;"><span style="color:#475569; font-size:13px;">Cuenta BCP</span><strong style="font-size:13px; color:#0f172a;">191-98765432-0-00</strong></div>
                           <div style="display:flex; justify-content:space-between;"><span style="color:#475569; font-size:13px;">Condición</span><span class="status-badge status-ontime" style="font-size:11px; padding: 2px 8px;">Crédito 30 días</span></div>
                       </div>
                   </div>
                   <div style="flex: 1; min-width: 250px; background: #fffbeb; padding: 20px; border-radius: 16px; border: 1px solid #fde68a; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align:center;">
                       <span style="color: #b45309; font-weight:600; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Deuda Total Pendiente</span>
                       <strong style="font-size: 32px; color: #92400e; margin: 8px 0;">S/ 1,250.00</strong>
                       <span style="color: #b45309; font-size:13px; margin-bottom: 16px; display:flex; align-items:center; gap:6px;"><i class="fa-regular fa-calendar"></i> Próx. Vencimiento: 15/05/2026</span>
                       <button id="btnRegisterPayment" class="btn-new" style="padding: 10px 24px; font-size:14px; border-radius:8px; background:#ea580c;"><i class="fa-solid fa-file-invoice-dollar"></i> Registrar Pago / Voucher</button>
                   </div>
               </div>
               <h4 style="margin:0 0 16px; font-size:14px; color:#1e293b;">Historial de Órdenes</h4>
               <table class="saas-table" style="margin: 0 -24px -24px -24px; width: calc(100% + 48px); border-radius:0; border-top: 1px solid #e2e8f0;">
                   <thead><tr><th>FECHA</th><th>ORDEN DE COMPRA</th><th>MONTO</th><th>ESTADO</th></tr></thead>
                   <tbody>
                      <tr><td>10/04/2026</td><td><strong>ORD-0042</strong></td><td>S/ 450.00</td><td><span class="status-badge status-delayed" style="background:#ffedd5; color:#ea580c;"><i class="fa-solid fa-clock"></i> Pendiente</span></td></tr>
                      <tr><td>01/04/2026</td><td><strong>ORD-0038</strong></td><td>S/ 800.00</td><td><span class="status-badge status-ontime"><i class="fa-solid fa-check"></i> Pagado</span></td></tr>
                      <tr><td>15/03/2026</td><td><strong>ORD-0031</strong></td><td>S/ 1,120.00</td><td><span class="status-badge status-ontime"><i class="fa-solid fa-check"></i> Pagado</span></td></tr>
                   </tbody>
               </table>
            </div>
          `;

          // TABLA 3: MENSAJES
          document.getElementById('tab-pagos').innerHTML = `
            <div style="display: flex; height: 500px; margin: 0;">
                <div style="flex: 1; display:flex; flex-direction:column; background: #f8fafc; border-right: 1px solid #e2e8f0;">
                    <div style="padding: 16px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:50%; background:#25d366; color:white; display:flex; align-items:center; justify-content:center; font-size:20px;"><i class="fa-brands fa-whatsapp"></i></div>
                        <div>
                            <strong style="display:block; color:#0f172a; font-size:14px;">WhatsApp Negocio</strong>
                            <span style="color:#16a34a; font-size:12px; font-weight:600;">En línea</span>
                        </div>
                    </div>
                    <div class="saas-chat-mockup" style="flex:1; border-radius:0; border:none; margin:0; overflow-y:auto; padding:20px;">
                        <div style="text-align:center; margin-bottom:16px;"><span style="background:#e2e8f0; font-size:11px; color:#475569; padding:4px 12px; border-radius:12px;">Ayer</span></div>
                        <div class="chat-msg sent">Confirmo el pedido de 20kg de limón y 50kg de papa para mañana a primera hora. Enviar factura a la cuenta de siempre.<span class="time">09:00 AM</span></div>
                        <div class="chat-msg received">Recibido, jefe. Mañana el camión está por allá a las 8:00 AM. La factura se la mando por correo en un rato.<span class="time">09:05 AM</span></div>
                        <div style="text-align:center; margin:16px 0;"><span style="background:#e2e8f0; font-size:11px; color:#475569; padding:4px 12px; border-radius:12px;">Hoy</span></div>
                        <div class="chat-msg received">Ya está la mercadería en ruta. El conductor es Juan.<span class="time">07:30 AM</span></div>
                        <div class="chat-msg sent">Perfecto, gracias. Lo recibo en almacén.<span class="time">07:35 AM</span></div>
                    </div>
                    <div style="padding: 16px; background: #ffffff; border-top: 1px solid #e2e8f0; display:flex; gap:12px;">
                        <input type="text" class="form-control" placeholder="Escribir mensaje..." style="flex:1; border-radius:20px; padding: 10px 16px;">
                        <button class="btn-new" style="border-radius:50%; width:42px; height:42px; padding:0; justify-content:center; background:#25d366;"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
                <div style="width: 260px; background: #ffffff; padding: 24px; overflow-y:auto;">
                    <h4 style="margin:0 0 24px; font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Estadísticas del Canal</h4>
                    <ul class="saas-contact-list" style="gap:24px;">
                        <li style="display:flex; flex-direction:column; gap:6px; border-bottom:1px solid #f1f5f9; padding-bottom:16px;">
                            <span style="color:#64748b; font-size:12px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-comments"></i> Mensajes Históricos</span>
                            <strong style="font-size:24px; color:#0f172a;">1,245</strong>
                        </li>
                        <li style="display:flex; flex-direction:column; gap:6px; border-bottom:1px solid #f1f5f9; padding-bottom:16px;">
                            <span style="color:#64748b; font-size:12px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-stopwatch"></i> Tiempo Respuesta Prom.</span>
                            <strong style="font-size:24px; color:#0f172a;">~5 min</strong>
                        </li>
                        <li style="display:flex; flex-direction:column; gap:6px;">
                            <span style="color:#64748b; font-size:12px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-cart-shopping"></i> Órdenes por Chat</span>
                            <strong style="font-size:24px; color:#ea580c;">42</strong>
                        </li>
                    </ul>
                </div>
            </div>
          `;

          // TABLA 4: COMPRAS
          document.getElementById('tab-mensajes').innerHTML = `
            <table class="saas-table" style="border-radius: 0;">
                <thead><tr><th>FECHA</th><th>CÓDIGO ORDEN</th><th>ÍTEMS EXACTOS</th><th>COSTO TOTAL</th><th>ESTADO LOGÍSTICO</th></tr></thead>
                <tbody>
                    <tr>
                        <td><span style="font-size:13px; color:#64748b;">Hoy</span><br><strong style="color:#0f172a;">23/04/2026</strong></td>
                        <td><strong style="color:#ea580c;">ORD-202604</strong></td>
                        <td>
                            <span class="item-detail">20x Limón Sutil (kg)</span>
                            <span class="item-detail">50x Papa Blanca (kg)</span>
                        </td>
                        <td><strong style="font-size:15px; color:#0f172a;">S/ 270.00</strong></td>
                        <td><span class="status-badge status-ontime"><i class="fa-solid fa-truck-fast"></i> Puntual</span></td>
                    </tr>
                    <tr>
                        <td><span style="font-size:13px; color:#64748b;">Semana pasada</span><br><strong style="color:#0f172a;">15/04/2026</strong></td>
                        <td><strong style="color:#ea580c;">ORD-202603</strong></td>
                        <td>
                            <span class="item-detail">30x Ají Amarillo (kg)</span>
                            <span class="item-detail">10x Cebolla Roja (saco)</span>
                        </td>
                        <td><strong style="font-size:15px; color:#0f172a;">S/ 410.00</strong></td>
                        <td><span class="status-badge status-delayed" style="background:#ffedd5; color:#ea580c;"><i class="fa-solid fa-triangle-exclamation"></i> Retraso 2h</span></td>
                    </tr>
                    <tr>
                        <td><span style="font-size:13px; color:#64748b;">Hace 2 semanas</span><br><strong style="color:#0f172a;">08/04/2026</strong></td>
                        <td><strong style="color:#ea580c;">ORD-202602</strong></td>
                        <td>
                            <span class="item-detail">15x Tomate Especial (jaba)</span>
                        </td>
                        <td><strong style="font-size:15px; color:#0f172a;">S/ 180.00</strong></td>
                        <td><span class="status-badge status-ontime"><i class="fa-solid fa-truck-fast"></i> Puntual</span></td>
                    </tr>
                </tbody>
            </table>
          `;

      } else {
          // =========================================================
          // RESTAURAR DATA PARA CLIENTES NORMALES
          // =========================================================
          document.getElementById('tab-pedidos').innerHTML = '<table class="saas-table"><thead id="tab1Thead"></thead><tbody id="saas-order-history"></tbody></table>';
          document.getElementById('tab-preferencias').innerHTML = '<div id="saas-preferences-content"></div>';
          document.getElementById('tab-pagos').innerHTML = '<div id="saas-payment-history-container"></div>';
          document.getElementById('tab-mensajes').innerHTML = '<div id="saas-chat-history"></div>';
          
          const monthTotal = (ltv * 0.25).toFixed(2);
          const monthOrders = Math.max(1, Math.floor((client.pedidos || 1) * 0.3));
          const monthAvg = (monthTotal / monthOrders).toFixed(2);
          
          document.getElementById('profileMonthTotal').textContent = `S/ ${monthTotal}`;
          document.getElementById('profileOrangeDetails').innerHTML = `<span id="profileMonthOrders">${monthOrders} pedidos</span> • <span id="profileMonthAvg">S/ ${monthAvg} prom.</span>`;

          document.getElementById('profileScore').textContent = `${(4.0 + Math.random() * 1.0).toFixed(1)}/5`;
          document.getElementById('profileScoreDesc').textContent = 'Puntualidad y retención alta';

          document.getElementById('profileContactList').innerHTML = `
              <li><i class="fa-solid fa-envelope"></i> <span>${client.email || 'No registrado'}</span></li>
              <li><i class="fa-solid fa-location-dot"></i> <span>Av. Principal ${(client.id || 1) * 123}, Chimbote</span></li>
              <li><i class="fa-solid fa-clock"></i> <span><strong>Horario pref:</strong> ${client.comportamiento?.horario || 'Lun-Sáb 1:00pm - 3:00pm'}</span></li>
          `;

          document.getElementById('profileTotalOrders').textContent = `${client.pedidos || 0}`;
          document.getElementById('profileRetention').textContent = `${client.rfm?.engagement || 85}%`;

          document.getElementById('tab1Thead').innerHTML = '<tr><th>FECHA / ID</th><th>DETALLE DE ÍTEMS</th><th>TOTAL</th><th>ESTADO ENTREGA</th></tr>';
          
          let historyHtml = '';
          const menuItems = ['Ceviche Mixto', 'Lomo Saltado', 'Pisco Sour', 'Jalea', 'Chicha Morada 1L'];
          if (client.pedidos > 0) {
              for (let i = 0; i < Math.min(client.pedidos, 5); i++) {
                  const total = (50 + Math.random() * 150).toFixed(2);
                  const isDelayed = Math.random() > 0.7;
                  let itemsList = '';
                  for(let j=0; j< (Math.floor(Math.random() * 3) + 1); j++) {
                      itemsList += `<span class="item-detail">${Math.floor(Math.random() * 3) + 1}x ${menuItems[Math.floor(Math.random() * menuItems.length)]}</span>`;
                  }
                  historyHtml += `<tr><td><strong style="color: #0f172a;">ORD-${2026 - i}0${i+1}</strong><br><span style="font-size:12px;color:#64748b;">Hace ${i * 4 + 1} días</span></td><td>${itemsList}</td><td><strong style="color: #0f172a;">S/ ${total}</strong><br><span style="font-size:12px;color:#64748b;">Pagado</span></td><td><span class="status-badge ${isDelayed ? 'status-delayed' : 'status-ontime'}"><i class="fa-solid ${isDelayed ? 'fa-clock' : 'fa-check'}"></i> ${isDelayed ? 'Retraso 12m' : 'On Time'}</span></td></tr>`;
              }
          }
          document.getElementById('saas-order-history').innerHTML = historyHtml || '<tr><td colspan="4" style="text-align:center;padding:32px;">Sin historial reciente.</td></tr>';

          document.getElementById('saas-preferences-content').innerHTML = '<div class="saas-preferences" style="padding:24px;"><span class="pref-tag"><strong>★</strong> Preferencia: Lomo Saltado</span><span class="pref-tag"><strong>★</strong> Preferencia: Bebidas Frías</span></div>';
          
          document.getElementById('saas-payment-history-container').innerHTML = `
              <table class="saas-table"><thead><tr><th>FECHA</th><th>MÉTODO</th><th>MONTO</th><th>ESTADO</th></tr></thead><tbody>
                <tr><td>Hace 2 días</td><td>Yape</td><td>S/ 85.00</td><td><span class="status-badge status-ontime">Completado</span></td></tr>
              </tbody></table>
          `;
          
          document.getElementById('saas-chat-history').innerHTML = '<div class="workspace-note" style="padding:16px; margin:0;">No hay trazas de historial conectadas a DallA. Vincular WhatsApp Business o el canal de cocina operativo.</div>';
      }

      document.querySelectorAll('.saas-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.saas-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('.saas-tab[data-target="tab-pedidos"]')?.classList.add('active');
      document.getElementById('tab-pedidos')?.classList.add('active');

      modal.classList.add('show');
      if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  window.closeProfileView = function() {
      document.getElementById('clientProfileModal')?.classList.remove('show');
  };

  // EVENTOS GLOBALES DEL MODAL
  document.addEventListener('click', (e) => {
      if (e.target.closest('#btnCloseProfile') || e.target.id === 'clientProfileModal') window.closeProfileView();
      
      const tab = e.target.closest('.saas-tab');
      if (tab) {
          document.querySelectorAll('.saas-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.saas-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById(tab.dataset.target)?.classList.add('active');
      }

      // — UI provisional (persistencia en almacén / insumos pendiente) —
      if (e.target.closest('#btnNewInsumo')) {
          let modal = document.getElementById('customInsumoModal');
          if (!modal) {
              const modalHTML = `
              <div id="customInsumoModal" class="modal-overlay" style="z-index: 10005;">
                <div class="modal-content" style="max-width: 400px; transform: scale(0.95); transition: transform 0.3s ease;">
                  <header class="modal-header">
                    <h3><i class="fa-solid fa-box-open" style="color: #ea580c;"></i> Nuevo Insumo</h3>
                    <button class="btn-icon" id="btnCloseInsumo"><i class="fa-solid fa-xmark"></i></button>
                  </header>
                  <div class="form-group" style="margin-bottom: 16px;">
                    <label style="font-size: 13px; font-weight: 600; color: #475569; display: block; margin-bottom: 8px;">Nombre del Insumo</label>
                    <input type="text" id="insumoNameInput" class="form-control" placeholder="Ej. Palta Fuerte">
                  </div>
                  <div class="form-group" style="margin-bottom: 24px;">
                    <label style="font-size: 13px; font-weight: 600; color: #475569; display: block; margin-bottom: 8px;">Precio Referencial (S/)</label>
                    <input type="number" id="insumoPriceInput" class="form-control" placeholder="0.00" step="0.01">
                  </div>
                  <div class="modal-footer" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">
                    <button class="btn-secondary" id="btnCancelInsumo" style="padding: 10px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; font-weight: 600; color: #475569;">Cancelar</button>
                    <button class="btn-orange-gradient" id="btnSaveInsumo" style="padding: 10px 16px; border-radius: 8px; border: none; background: linear-gradient(135deg, #f97316, #ea580c); color: white; cursor: pointer; font-weight: 600;">Guardar Insumo</button>
                  </div>
                </div>
              </div>`;
              document.body.insertAdjacentHTML('beforeend', modalHTML);
              modal = document.getElementById('customInsumoModal');

              const closeMod = () => { modal.classList.remove('show'); modal.querySelector('.modal-content').style.transform = 'scale(0.95)'; };
              document.getElementById('btnCloseInsumo').addEventListener('click', closeMod);
              document.getElementById('btnCancelInsumo').addEventListener('click', closeMod);
              document.getElementById('btnSaveInsumo').addEventListener('click', () => {
                  const insumoName = document.getElementById('insumoNameInput').value;
                  const price = document.getElementById('insumoPriceInput').value || "0.00";
                  if (insumoName.trim() !== "") {
                      const htmlNewItem = `<div class="saas-top-kpi" style="padding: 16px; border-radius: 12px; animation: fadeIn 0.3s ease; border: 1px solid #bae6fd; background: #f0f9ff;"><span class="status-badge status-pending" style="float:right; font-size:10px; padding:4px 8px; background:#e0f2fe; color:#2563eb;">Nuevo</span><h4 style="margin:0 0 4px; color:#0f172a; font-size:15px;">${insumoName}</h4><span style="font-size:12px; color:#64748b;">Por categorizar</span><strong style="display:block; font-size:20px; margin: 12px 0 4px; color:#0f172a;">S/ ${parseFloat(price).toFixed(2)} <span style="font-size:13px; color:#64748b; font-weight:normal;">/ kg</span></strong><div style="margin-top:12px; padding-top:12px; border-top:1px dashed #bae6fd;"><span style="font-size:12px; color:#0284c7; font-weight:700;"><i class="fa-solid fa-box"></i> Pedido Mín: Por definir</span></div></div>`;
                      const grid = document.getElementById('catalogGrid');
                      if (grid) grid.insertAdjacentHTML('afterbegin', htmlNewItem);
                      closeMod();
                  }
              });
          }
          
          document.getElementById('insumoNameInput').value = '';
          document.getElementById('insumoPriceInput').value = '';
          modal.classList.add('show');
          setTimeout(() => { modal.querySelector('.modal-content').style.transform = 'scale(1)'; }, 10);
      }

      // — Comprobante local (borrador); conectar a facturación o ERP —
      if (e.target.closest('#btnRegisterPayment')) {
          const confirmPago = confirm("¿Registrar pago y descargar comprobante de borrador? (En producción: integrar comprobante fiscal o ERP.)");
          if (confirmPago) {
              const clientName = document.getElementById('profileName').innerText;
              const amount = document.getElementById('profileDebtAmount').innerText;
              const receiptContent = "========================================\\n       COMPROBANTE DE PAGO (BORRADOR LOCAL)\\n========================================\\nFecha: " + new Date().toLocaleString() + "\\nProveedor: " + clientName + "\\nMonto cancelado: " + amount + "\\nEstado: PAGADO (solo referencia, no es comprobante SUNAT)\\n\\n* Generado en MiRest con IA.\\n========================================";
              
              const blob = new Blob([receiptContent], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Voucher_${clientName.replace(/\s+/g, '_')}_${Date.now()}.txt`;
              document.body.appendChild(a);
              a.click(); // Forzamos el click invisible para que el navegador descargue el archivo
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              // 2. Actualizar la interfaz (El cuadrito amarillo pasa a verde)
              document.getElementById('profileDebtAmount').innerText = "S/ 0.00 por pagar";
              document.getElementById('profileDebtDetails').innerText = "Cuentas al día";
              const debtBox = document.getElementById('profileDebtBox');
              debtBox.style.background = "#dcfce7";
              debtBox.style.borderColor = "#bbf7d0";
              debtBox.querySelector('i').className = "fa-solid fa-check-circle";
              debtBox.querySelector('i').style.color = "#16a34a";
              debtBox.querySelector('.saas-debt-info strong').style.color = "#16a34a";
              debtBox.querySelector('.saas-debt-info span').style.color = "#15803d";
          }
      }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.closeProfileView(); });
})();