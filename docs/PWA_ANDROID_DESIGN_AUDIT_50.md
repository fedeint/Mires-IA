# Auditoría PWA Android — MiRest con IA

## Dirección de diseño

**Humano objetivo:** operador, mesero, cajero, chef o administrador usando Android durante servicio real, muchas veces con una mano, presión de tiempo y ruido operativo.

**Tarea principal:** abrir rápido la app instalada, cambiar entre módulos críticos, leer estado operativo y ejecutar acciones sin fricción.

**Sensación buscada:** app instalada de restaurante, rápida como POS, cálida como ticket de cocina, clara como tablero de comandas.

## Exploración de dominio

**Conceptos:** comanda, pase de cocina, ticket, mesa, caja, turno, stock crítico, cola de pedidos, despacho, cierre diario.

**Color world:** naranja brasa, crema ticket, tinta noche, verde hierbabuena, amarillo advertencia/cocción, rojo merma/urgencia, acero de cocina.

**Firma:** dock inferior operativo tipo “pase de servicio”: Inicio, Pedidos, Cocina, Caja y Almacén siempre disponibles según rol.

**Defaults rechazados:**

- Sidebar desktop adaptado a móvil → dock inferior + sidebar solo como navegación extendida.
- Cards web responsive apiladas sin intención → bloques táctiles con jerarquía de operación.
- Topbar grande tipo dashboard → topbar compacta con safe area y acciones esenciales.

## Mockup base Android

```text
┌─────────────────────────────┐
│ safe area / status bar      │
├─────────────────────────────┤
│ ☰  Pedidos        DalIA  AD │  ← topbar compacta 68px
├─────────────────────────────┤
│ Resumen operativo           │
│ ┌─────────┐ ┌─────────┐     │
│ │Mesa 04  │ │Delivery │     │  ← cards táctiles
│ └─────────┘ └─────────┘     │
│ Cola / acciones / estado    │
│                             │
├─────────────────────────────┤
│ Inicio Pedidos Cocina Caja  │  ← dock inferior PWA
└─────────────────────────────┘
```

## 50 errores de diseño detectados y solución mockup

| # | Error | Impacto | Mockup / solución Android |
|---|---|---|---|
| 1 | Sidebar oscuro era la navegación principal en móvil. | Obliga a abrir cajón para todo. | Dock inferior fijo con 5 módulos críticos. |
| 2 | Topbar móvil ocupaba demasiada altura visual. | Reduce área útil. | Topbar compacta con título truncado y acciones esenciales. |
| 3 | No había firma PWA instalada diferenciada de responsive web. | Se siente como web embebida. | `standalone` + dock + safe areas + portrait. |
| 4 | Acciones flotantes podían chocar con instalador/DalIA/dock. | Tap accidental. | Reubicar FAB e instalador encima del dock. |
| 5 | Targets de 40px eran justos para operación con una mano. | Errores táctiles. | Token táctil mínimo 48px. |
| 6 | Safe areas se trataban parcialmente. | Cortes en Android/iOS con gesture nav. | Padding top/bottom con `env(safe-area-inset-*)`. |
| 7 | Manifest no fijaba orientación. | Pantallas operativas rotan sin intención. | `orientation: portrait-primary`. |
| 8 | Cache PWA podía servir estilos viejos. | Cambios mobile no aparecen. | Cache `mirest-pwa-v26`. |
| 9 | El dashboard móvil mostraba contenido administrativo antes que operación. | Menos foco en servicio. | Hero compacto + tarjetas de estado prioritarias. |
| 10 | La navegación no distinguía rutas críticas por rol. | Operador ve demasiadas opciones. | Dock filtrado por permisos. |
| 11 | Cards tenían sombras web pesadas. | Look menos nativo. | Glass dock + sombras suaves inferiores. |
| 12 | El color naranja se usaba como decoración. | Pierde significado. | Naranja solo para acción/activo. |
| 13 | Sidebar móvil sigue siendo largo para muchas opciones. | Scroll innecesario. | Sidebar como “Más módulos”, dock para operación. |
| 14 | Labels de navegación grandes en sidebar. | Baja densidad. | Dock con icono + label corto. |
| 15 | Falta estado activo visible en bottom nav. | Usuario no sabe dónde está. | Pastilla activa con ícono naranja/brasa. |
| 16 | Header de módulos legacy varía mucho. | Fragmentación. | Topbar global unificada por CSS móvil. |
| 17 | Algunos módulos cargan CSS propio encima. | Pueden romper PWA. | Auditoría posterior por módulo con overrides mínimos. |
| 18 | Tablas se vuelven incómodas en móvil. | Lectura lenta. | Cards por fila con `data-label`. |
| 19 | Modales centrados tipo desktop. | Difíciles de cerrar. | Bottom sheets en móvil. |
| 20 | Estados loading no son homogéneos. | Percepción de lentitud. | Skeleton/ticket loading por módulo. |
| 21 | No hay patrón de offline visible. | Usuario no sabe si puede operar. | Banner “Sin conexión · datos guardados”. |
| 22 | El instalador PWA aparece como popup genérico. | Baja conversión a instalación. | Card cálida “Instalar MiRest en este Android”. |
| 23 | DalIA compite con navegación. | Ruido visual. | Panel encima del dock, botón en topbar. |
| 24 | No hay compact density para cocina/caja. | Mucho scroll. | Cards densas con números tabulares. |
| 25 | La jerarquía textual depende mucho del tamaño. | Menos escaneable. | Peso + tracking + color semántico. |
| 26 | Muchos módulos usan “Módulo” como eyebrow. | Poco contexto. | Eyebrow específico: Operación, Caja, Cocina, Stock. |
| 27 | Iconografía mixta entre Lucide/FontAwesome/Lordicon. | Inconsistencia. | Lucide para shell, animados solo hero/module. |
| 28 | Componentes custom no siempre tienen estados focus. | Accesibilidad baja. | Focus visible por token. |
| 29 | Animaciones sin criterio mobile. | Puede sentirse lento. | Microinteracciones rápidas 120–200ms. |
| 30 | Background radial consume contraste. | Cards pierden foco. | Canvas más plano en móvil. |
| 31 | No hay “thumb zone” clara. | Acciones arriba son difíciles. | Acciones frecuentes abajo/dock. |
| 32 | Botón logout escondido en avatar. | Descubribilidad baja. | Mantener avatar, añadir opción clara en sidebar. |
| 33 | Breadcrumbs largos no aportan en móvil. | Ocupan espacio. | Ocultar/compactar breadcrumbs bajo 640px. |
| 34 | Chips en topbar se ocultan sin reemplazo. | Se pierde rol/contexto. | Avatar title + dock activo + page title. |
| 35 | Formularios con select nativo desigual. | UI inconsistente. | Futuro: select custom tipo bottom sheet. |
| 36 | No hay patrón de confirmación táctil. | Dudas al ejecutar acciones. | Haptics existentes + toast. |
| 37 | Login/legales no comparten PWA shell. | Experiencia partida. | Mantener auth liviano, no dock. |
| 38 | Pedidos tiene PWA local separada. | Doble sistema. | Bridge visual y tokens compartidos. |
| 39 | Accesos tiene CSS inline amplio. | Difícil mantener. | Extraer tokens y responsive global. |
| 40 | Módulos Almacén usan rutas absolutas. | Riesgo en subcarpetas/hosting. | Normalizar root path si se despliega en subpath. |
| 41 | No hay guía de mockups Android. | Equipo diseña distinto. | Este documento como baseline. |
| 42 | Dark mode móvil no se menciona en flujo. | Puede quedar inconsistente. | Toggle dark mode y tokens glass dark. |
| 43 | No hay test de instalación documentado. | PWA puede fallar tarde. | Checklist en docs. |
| 44 | Offline cache no incluye todos los módulos críticos. | Primera navegación offline falla. | Ampliar CORE_ASSETS por rol/módulo. |
| 45 | No hay splash/iconografía maskable ideal. | Instalación se ve poco premium. | Crear iconos maskable 192/512 dedicados. |
| 46 | Topbar fixed puede tapar anclas internas. | Saltos incorrectos. | `scroll-padding-top` futuro. |
| 47 | Elementos hover siguen siendo protagonistas en touch. | No aporta en Android. | Priorizar active/focus. |
| 48 | Métricas sin intención operativa. | Números decorativos. | Métricas con acción sugerida. |
| 49 | No hay patrón para “modo turno”. | App no refleja jornada real. | Chip/estado de turno persistente. |
| 50 | Falta QA por dispositivo real. | Riesgo de layout roto. | Pixel 7/Chrome + Android standalone como gate. |

## Plan de implementación por componentes

1. **Shell móvil:** topbar compacta, dock inferior, safe areas, scroll estable.
2. **Navegación:** permisos por rol, sidebar extendida, dock operativo.
3. **PWA:** manifest, cache versionado, instalación, standalone.
4. **Componentes:** cards táctiles, tablas-card, bottom sheets, botones 48px.
5. **Módulos críticos:** Pedidos, Cocina, Caja, Almacén.
6. **QA:** Lighthouse PWA, Pixel 7, dark mode, offline y gesture nav.

## Backlog accionable P0/P1/P2

### P0 — Crítico para sentir app instalada

- [x] Dock inferior Android por permisos: hallazgos 1, 10, 13, 15.
- [x] Topbar compacta con safe areas: hallazgos 2, 6, 16.
- [x] Manifest standalone portrait: hallazgos 3, 7.
- [x] Reubicación de FAB/DalIA/instalador: hallazgos 4, 23.
- [x] Cache PWA versionado: hallazgo 8.
- [x] Bridge visual específico para Pedidos legacy: hallazgo 38.
- [ ] QA en Android real Pixel/Chrome: hallazgo 50.

### P1 — Consistencia operativa

- [ ] Cards táctiles por módulo crítico: hallazgos 9, 18, 24, 48.
- [ ] Bottom sheets para modales y selects: hallazgos 19, 35.
- [ ] Offline banner y estados de conexión: hallazgos 21, 44.
- [ ] Estados loading/skeleton por módulo: hallazgo 20.
- [ ] Iconografía shell solo Lucide: hallazgo 27.
- [ ] Modo turno persistente: hallazgo 49.

### P2 — Pulido y escalabilidad visual

- [ ] Iconos maskable dedicados 192/512: hallazgo 45.
- [ ] Scroll padding para anchors con topbar fixed: hallazgo 46.
- [ ] Extracción de CSS inline de Accesos: hallazgo 39.
- [ ] Normalización de rutas absolutas en submódulos Almacén: hallazgo 40.
- [ ] Guía visual de estados semánticos por módulo: hallazgos 12, 25, 29, 30.

## Mockups navegables

Abrir [pwa-android-mockups.html](pwa-android-mockups.html) para revisar mockups reales en HTML/CSS de:

1. Inicio Android PWA.
2. Pedidos Android PWA.
3. Cocina Android PWA en dark mode.

## Checklist de validación

- [ ] Instalar desde Chrome Android.
- [ ] Abrir en modo standalone.
- [ ] Confirmar dock inferior sin solaparse con DalIA/FAB/instalador.
- [ ] Validar navegación por rol.
- [ ] Validar scroll en dashboard y módulos largos.
- [ ] Validar dark mode.
- [ ] Ejecutar Lighthouse PWA.
