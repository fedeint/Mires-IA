document.addEventListener('DOMContentLoaded', () => {
    const directory = document.getElementById('nurturingDirectory');
    const panel = document.getElementById('nurturingPanel');
    const overlay = document.getElementById('nurturingPanelOverlay');
    const btnClose = document.getElementById('btnCloseNPanel');

    const modalSeq = document.getElementById('modalNewSequence');
    const btnNewSeq = document.getElementById('btnNewSequence');
    const btnCloseSeq = document.getElementById('btnCloseSeqModal');
    const btnCancelSeq = document.getElementById('btnCancelSeq');
    const formSeq = document.getElementById('formNewSequence');

    const nurturingClients = [];

    function renderCards() {
        if (!nurturingClients.length) {
            directory.innerHTML = `
            <div class="n-card" style="grid-column:1/-1;cursor:default;max-width:40rem" role="status">
                <h3 class="n-name" style="margin-top:0">Sin datos aún</h3>
                <p class="n-email" style="line-height:1.5">Los perfiles de nurturing y el LTV deben alimentarse desde clientes reales (pedidos cobrados e historial en CRM). Completa el <strong>onboarding</strong> hasta operar con pedidos reales; aquí no se usan filas de muestra.</p>
            </div>`;
            return;
        }
        directory.innerHTML = nurturingClients.map(c => `
            <div class="n-card" onclick="openNurturingProfile(${c.id})">
                <div class="n-avatar">${c.avatar}</div>
                <h3 class="n-name">${c.nombre}</h3>
                <p class="n-email"><i class="fa-solid fa-envelope"></i> ${c.email}</p>
                <div class="n-metrics">
                    <span class="badge habitual">${c.pedidos} Pedidos</span>
                    <span class="badge ${c.estado === 'VIP' ? 'vip' : 'altovalor'}">${c.estado}</span>
                </div>
            </div>
        `).join('');
    }

    window.openNurturingProfile = function(id) {
        const c = nurturingClients.find(x => x.id === id);
        if (!c) return;

        document.getElementById('np-name').textContent = c.nombre.split(' ')[0] + ' ' + (c.nombre.split(' ')[1] || '');
        document.getElementById('np-visit').textContent = c.ultimaVisita;
        const statusTag = document.getElementById('np-status-tag');
        statusTag.textContent = c.actividad;
        statusTag.className = `badge ${c.actividad === 'Cliente Activo' ? 'active-client' : 'altovalor'}`;

        document.getElementById('np-avatar').textContent = c.avatar;
        document.getElementById('np-full-name').textContent = c.nombre;
        document.getElementById('np-badge').textContent = c.estado;
        document.getElementById('np-pedidos-badge').textContent = `${c.pedidos} Pedidos`;
        document.getElementById('np-desde').textContent = c.clienteDesde;
        document.getElementById('np-pedidos').textContent = c.pedidos;
        document.getElementById('np-ltv').textContent = `S/ ${c.ltv}`;
        document.getElementById('np-puntos').textContent = c.puntos;
        document.getElementById('np-arq-name').textContent = c.arquetipo.nombre;
        document.getElementById('np-arq-desc').textContent = c.arquetipo.desc;
        document.getElementById('np-arq-tags').innerHTML = c.arquetipo.tags.map(t => `<span>${t}</span>`).join('');
        document.getElementById('np-churn-bar').style.width = `${c.churn.width}%`;
        document.getElementById('np-churn-text').textContent = c.churn.text;
        document.getElementById('np-retention').textContent = c.churn.score;
        document.getElementById('np-b-horario').textContent = c.comportamiento.horario;
        document.getElementById('np-b-dias').textContent = c.comportamiento.dias;
        document.getElementById('np-b-freq').textContent = c.comportamiento.freq;
        document.getElementById('np-b-ticket').textContent = c.comportamiento.ticket;
        document.getElementById('np-fav-pedidos').textContent = c.pedidos;
        document.getElementById('np-fav-list').innerHTML = c.comportamiento.favs.map((f, i) => `<li><span class="rank">#${i+1}</span> ${f.nombre} <span class="count">${f.cant} pedidos</span></li>`).join('');
        document.getElementById('np-seq-list').innerHTML = c.secuencias.map(s => `<div class="seq-item"><div class="seq-info"><strong>${s.nombre}</strong><p>${s.desc}</p></div><span class="badge ${s.clase}">${s.estado}</span></div>`).join('');

        panel.classList.add('open');
        overlay.classList.add('show');
    };

    const closePanel = () => { panel.classList.remove('open'); overlay.classList.remove('show'); };
    btnClose.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // Modal
    btnNewSeq.addEventListener('click', () => modalSeq.classList.add('show'));
    const closeModalSeq = () => { modalSeq.classList.remove('show'); formSeq.reset(); };
    btnCloseSeq.addEventListener('click', closeModalSeq);
    btnCancelSeq.addEventListener('click', closeModalSeq);
    formSeq.addEventListener('submit', (e) => { e.preventDefault(); alert('La activación de secuencias requiere la API de campañas conectada; aún no hay registro en base.'); closeModalSeq(); });

    renderCards();
});