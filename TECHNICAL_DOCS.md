# MiRest con IA — Frontend Skeleton Base

## Estructura implementada

El shell general del sistema vive en la raíz del proyecto:

- `index.html`: dashboard principal.
- `styles/`: tokens, base visual, layout, componentes y estilos específicos.
- `scripts/`: navegación global, bootstrap del shell y render del dashboard.
- `Caja/caja.html`, `Cocina/cocina.html`, etc.: entry points individuales por módulo con nombres descriptivos.

## Cómo abrir el proyecto

### Opción rápida

Abrir `index.html` directamente en el navegador.

### Opción recomendada

Usar una extensión tipo Live Server para trabajar con recarga automática durante la construcción del frontend.

## Cómo trabajar por equipo

1. Cada compañero debe desarrollar su frontend dentro de su carpeta de módulo.
2. Los cambios globales compartidos deben ir en `styles/` o `scripts/` de la raíz.
3. Evitar duplicar tokens visuales dentro de cada módulo.
4. Mantener el enlace de retorno al dashboard principal.

## Convenciones base

- HTML, CSS y JavaScript vanilla.
- Design System con Inter, grid de 8px, sidebar oscuro, fondo claro y naranja como color primario.
- El dashboard raíz funciona como hub central y no debe asumir lógica de negocio real en esta fase.

## Testing manual mínimo

1. Abrir `index.html`.
2. Verificar navegación hacia los 9 módulos.
3. Verificar retorno desde cada módulo al dashboard.
4. Revisar responsive base del dashboard principal, incluyendo menú lateral móvil.
5. Verificar toggle de tema.
6. En Android/Chrome, instalar la PWA y validar: topbar compacta, dock inferior, safe areas, scroll vertical y acceso rápido a Inicio/Pedidos/Cocina/Caja/Almacén.

## Despliegue

Este skeleton puede publicarse como sitio estático en cualquier hosting de archivos estáticos.

## Gobierno del repositorio

### Rama principal

La rama [main](https://github.com/shonperez/MiRestConIAEsqueleto/tree/main) ya está publicada como base estable.

### Ramas creadas para trabajo por módulo

- `feature/almacen-ui`
- `feature/caja-ui`
- `feature/clientes-ui`
- `feature/cocina-ui`
- `feature/delivery-afiliados-ui`
- `feature/reportes-ui`
- `feature/menu-actual-ui`
- `feature/pedidos-ui`
- `feature/recetas-ui`

### Protección de rama

La protección automática de [main](https://github.com/shonperez/MiRestConIAEsqueleto/tree/main) no quedó aplicada desde este entorno porque la operación no está expuesta por las herramientas disponibles.

Debe configurarse directamente en GitHub desde `Settings` → `Branches` con una regla sobre `main`.

Configuración mínima recomendada:

- Require a pull request before merging
- Require at least 1 approval
- Require conversation resolution before merging
- Block direct pushes a `main`

### Colaboradores

Cuando se tengan los correos o usernames de GitHub, invitarlos desde `Settings` → `Collaborators and teams` del repositorio.

## Próxima evolución sugerida

1. Agregar componentes reutilizables documentados por patrón.
2. Incorporar dark mode persistente más completo.
3. Establecer reglas de PR por carpeta de módulo y changelog compartido.

## Sistema PWA Android unificado

La capa móvil instalada se implementa sin romper módulos legacy:

- [Pwa/manifest.webmanifest](Pwa/manifest.webmanifest): fuerza orientación portrait, agrega `display_override`, categorías y configuración regional `es-PE`.
- [Pwa/sw.js](Pwa/sw.js): cache `mirest-pwa-v26` para invalidar estilos/scripts móviles.
- [scripts/navigation.js](scripts/navigation.js): expone `MOBILE_DOCK_KEYS` y renderiza el dock inferior según permisos.
- [scripts/app.js](scripts/app.js): crea `#mobileAppDock` una sola vez por página y conserva sidebar como navegación extendida.
- [styles/mobile.css](styles/mobile.css): define topbar Android compacta, bottom dock, safe areas, glass surface y reubicación de FAB/instalador.
- [Pedidos/implementacion/frontend/styles/mirest-global-bridge.css](Pedidos/implementacion/frontend/styles/mirest-global-bridge.css): adapta Pedidos legacy al shell PWA Android global sin quitar su bottom nav interna de Salón/Delivery/Para llevar.
- [scripts/onboarding-controller.js](scripts/onboarding-controller.js): controla que solo exista un onboarding activo y limpia overlays/listeners antes de navegar.
- [Pwa/sw.js](Pwa/sw.js) y [Pedidos/implementacion/service-worker.js](Pedidos/implementacion/service-worker.js): limitan entradas de cache runtime para controlar consumo de memoria y datos.

Validación recomendada: Lighthouse PWA, Chrome DevTools con Pixel 7/Android, modo `standalone`, rotación bloqueada en portrait y pruebas táctiles con una mano.

### Mockups de referencia

Abrir [docs/pwa-android-mockups.html](docs/pwa-android-mockups.html) para revisar tres pantallas base: Inicio, Pedidos y Cocina dark mode. Estos mockups usan [docs/pwa-android-mockups.css](docs/pwa-android-mockups.css) y deben funcionar como referencia visual antes de tocar CSS local de módulos legacy.

### QA Android

Checklist operativo en [docs/PWA_ANDROID_QA_CHECKLIST.md](docs/PWA_ANDROID_QA_CHECKLIST.md)
