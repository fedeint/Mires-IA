# MiRest con IA — Frontend Skeleton Base

Base frontend del sistema administrativo MiRest con IA construida con HTML, CSS y JavaScript vanilla.

## Qué incluye

- Dashboard principal responsive en [index.html](index.html)
- Navegación global entre módulos
- Placeholders independientes por módulo en [Almacen/index.html](Almacen/index.html), [Caja/index.html](Caja/index.html), [Clientes/index.html](Clientes/index.html), [Cocina/index.html](Cocina/index.html), [DeliveryAfiliados/index.html](DeliveryAfiliados/index.html), [Reportes/index.html](Reportes/index.html), [MenuActual/index.html](MenuActual/index.html), [Pedidos/index.html](Pedidos/index.html) y [Recetas/index.html](Recetas/index.html)
- Design System base en [styles/tokens.css](styles/tokens.css)
- Scripts globales en [scripts/app.js](scripts/app.js), [scripts/navigation.js](scripts/navigation.js) y [scripts/dashboard.js](scripts/dashboard.js)

## Estructura

```text
/
├── index.html
├── README.md
├── TECHNICAL_DOCS.md
├── styles/
├── scripts/
├── Almacen/
├── Caja/
├── Clientes/
├── Cocina/
├── DeliveryAfiliados/
├── Reportes/
├── MenuActual/
├── Pedidos/
└── Recetas/
```

## Cómo usar

### Local

1. Abre [index.html](index.html) en el navegador.
2. Recorre el dashboard y entra a cada módulo.
3. Usa Live Server si quieres recarga automática.

## Flujo de trabajo recomendado

### Rama principal

- [main](https://github.com/shonperez/MiRestConIAEsqueleto/tree/main) debe mantenerse estable.
- Todo cambio debe entrar por Pull Request.

### Trabajo por módulo

Cada responsable debe trabajar en su carpeta correspondiente:

- Almacén → [Almacen/](Almacen)
- Caja → [Caja/](Caja)
- Clientes → [Clientes/](Clientes)
- Cocina → [Cocina/](Cocina)
- DeliveryAfiliados → [DeliveryAfiliados/](DeliveryAfiliados)
- Reportes → [Reportes/](Reportes)
- Menú actual → [MenuActual/](MenuActual)
- Pedidos → [Pedidos/](Pedidos)
- Recetas → [Recetas/](Recetas)

### Convenciones

- Reutilizar estilos globales antes de crear CSS nuevo.
- No mover el shell global del dashboard.
- Mantener retorno al dashboard principal.
- Subir al root solo mejoras compartidas.

## Ramas sugeridas

- `feature/almacen-ui`
- `feature/caja-ui`
- `feature/clientes-ui`
- `feature/cocina-ui`
- `feature/delivery-afiliados-ui`
- `feature/reportes-ui`
- `feature/menu-actual-ui`
- `feature/pedidos-ui`
- `feature/recetas-ui`

## Protección recomendada para `main`

La protección de rama no se configuró automáticamente desde este flujo porque la integración disponible no expone esa operación.

Configuración recomendada en GitHub:

1. Ir a `Settings` del repositorio.
2. Abrir `Branches`.
3. Crear una regla para `main`.
4. Activar:
   - `Require a pull request before merging`
   - `Require approvals`
   - `Require conversation resolution before merging`
   - `Restrict pushes that create files` o al menos restringir pushes directos si lo deseas

Objetivo: que ningún compañero empuje directo a [main](https://github.com/shonperez/MiRestConIAEsqueleto/tree/main).

## Invitación de colaboradores

Cuando tengas los correos o usernames de GitHub:

1. Ir a `Settings` → `Collaborators and teams`.
2. Presionar `Add people`.
3. Invitar por correo o username de GitHub.
4. Asignarles trabajo sobre su rama o módulo correspondiente.

Recomendación operativa:

- Almacen → `feature/almacen-ui`
- Caja → `feature/caja-ui`
- Clientes → `feature/clientes-ui`
- Cocina → `feature/cocina-ui`
- DeliveryAfiliados → `feature/delivery-afiliados-ui`
- Reportes → `feature/reportes-ui`
- MenuActual → `feature/menu-actual-ui`
- Pedidos → `feature/pedidos-ui`
- Recetas → `feature/recetas-ui`

## Documentación adicional

- Guía técnica interna en [TECHNICAL_DOCS.md](TECHNICAL_DOCS.md)

## Deploy

Este proyecto puede desplegarse como sitio estático.

## PWA Android instalada

- La experiencia móvil prioriza uso tipo app instalada Android: topbar compacta, navegación inferior fija, safe areas y targets táctiles de 48px.
- El dock móvil se genera desde [scripts/navigation.js](scripts/navigation.js) y se monta en [scripts/app.js](scripts/app.js), respetando permisos por rol.
- Los estilos globales viven en [styles/mobile.css](styles/mobile.css) y reutilizan tokens de [styles/tokens.css](styles/tokens.css).
- Para probar: abrir con Live Server/hosting HTTPS, instalar desde Chrome Android y validar en modo standalone.
