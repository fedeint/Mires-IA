# QA PWA Android MiRest

## Dispositivo base

- Android 16
- Pantalla 6.5 pulgadas
- Chrome instalado como PWA
- Ancho menor a 1024px

## Navegación

- Bottom nav visible con máximo 4 acciones principales más menú
- Sidebar abre con hamburguesa
- Logout solo aparece en Cuenta
- Avatar no cierra sesión
- Cambio de módulo se siente inmediato

## Onboarding

- Solo un onboarding activo
- Al navegar se limpian overlays tooltips y listeners
- Tooltip no tapa bottom nav
- Al finalizar aparece Insights con Estado y Mañana

## Módulos

- Productos centrado sin PR PR duplicado
- Proveedores acciones visibles sin overflow
- Clientes muestra Sin Clientes cuando corresponde
- Caja muestra estado acción principal y movimientos
- Almacén sigue flujo Yauri
- Facturación no muestra footer ni breadcrumb interno

## Rendimiento

- Performance monitor sin crecimiento continuo de memoria
- Cache Storage no crece sin límite
- Sin intervalos duplicados tras cambiar módulo 5 veces
- Imágenes cargan lazy cuando aplique
- Lighthouse PWA sin errores críticos
