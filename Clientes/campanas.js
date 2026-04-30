document.addEventListener('DOMContentLoaded', () => {
    // Elementos del Drawer
    const btnNewCampaign = document.getElementById('btnNewCampaign');
    const drawerOverlay = document.getElementById('campaignDrawerOverlay');
    const drawer = document.getElementById('campaignDrawer');
    const btnCloseDrawer = document.getElementById('btnCloseDrawer');
    
    // Navegación de pasos
    const btnPrevStep = document.getElementById('btnPrevStep');
    const btnNextStep = document.getElementById('btnNextStep');
    const steps = document.querySelectorAll('.step-content');
    let currentStep = 1;
    const totalSteps = steps.length;

    // Abrir/Cerrar Drawer
    const openDrawer = () => {
        drawerOverlay.classList.add('show');
        drawer.classList.add('open');
    };
    const closeDrawer = () => {
        drawerOverlay.classList.remove('show');
        drawer.classList.remove('open');
        setTimeout(() => goToStep(1), 300); // Resetear al cerrar
    };

    btnNewCampaign.addEventListener('click', openDrawer);
    btnCloseDrawer.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    // Lógica de Radio Cards (Paso 1)
    document.querySelectorAll('.radio-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            card.querySelector('input').checked = true;
        });
    });

    // Lógica de Pasos
    const goToStep = (stepNumber) => {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index + 1 === stepNumber);
        });
        currentStep = stepNumber;
        btnPrevStep.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
        
        if (currentStep === totalSteps) {
            btnNextStep.innerHTML = '<i class="fa-solid fa-power-off"></i> Guardar y Activar';
        } else {
            btnNextStep.textContent = 'Siguiente Paso';
        }
    };

    btnNextStep.addEventListener('click', () => { if (currentStep < totalSteps) goToStep(currentStep + 1); else { alert("¡Campaña guardada y activada con éxito!"); closeDrawer(); }});
    btnPrevStep.addEventListener('click', () => { if (currentStep > 1) goToStep(currentStep - 1); });

    // Interacción de variables dinámicas en el textarea
    const textarea = document.querySelector('.template-textarea');
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const insertText = btn.textContent;
                textarea.value = text.substring(0, start) + insertText + text.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
                textarea.focus();
            }
        });
    });
});