# Arquitectura de base de datos — MiRest con IA

Guía de cómo **cada sección del producto** se conecta entre sí a través de **Postgres (Supabase)** para armar un modelo coherente, sin duplicar datos ni romper trazabilidad.

---

## 1. Principios

| Principio | Qué implica |
|-----------|-------------|
| **Una fuente de verdad por concepto** | La carta vive en `products` (y categorías); el stock de materia prima en `insumos`; el pedido operativo en `orders` + `order_items`. Los módulos **leen** esas tablas, no copian listas en el frontend. |
| **Multi-restaurante (tenant)** | Casi todas las tablas llevan `restaurant_id` (o `org_id`). Las políticas **RLS** filtran por el tenant del JWT (`auth.uid()` → `profiles.restaurant_id`). |
| **Snapshot en ventas** | En `order_items` guarda `unit_price` (y opcionalmente `product_name`) al momento del pedido, aunque luego cambies el precio en carta. |
| **Eventos y estados** | Pedidos y cocina avanzan por **estado** (`pending`, `in_kitchen`, `ready`, …) y timestamps; la UI refleja la misma máquina de estados que la BD. |

---

## 2. Núcleo del modelo (entidades)

```
restaurants (o organizations)
    └── profiles (user_id, restaurant_id, role)
    └── product_categories
    └── products ..................... carta (Productos, líneas de pedido)
    └── recipes ...................... ficha técnica / costeo (Recetas)
            └── recipe_ingredients ... (recipe_id, insumo_id, cantidad, unidad)
    └── insumos ...................... stock (Almacén) — ya esquematizado en Almacen/migration.sql
    └── entradas_insumos / salidas_insumos / proveedores
    └── dining_tables ................ mesas físicas (Pedidos salón)
    └── customers .................... CRM (Clientes)
    └── orders ....................... pedido único (salón | delivery | takeaway)
            └── order_items .......... (product_id, qty, unit_price, notas)
    └── kitchen_tickets (opcional) ... cola cocina derivada de order_items
    └── payments ..................... cobros (Caja)
    └── invoices / credit_notes ...... comprobantes (Facturación; según normativa)
```

Las tablas `insumos`, `entradas_insumos`, `salidas_insumos` y `proveedores` pueden alinearse con lo definido en `Almacen/migration.sql`; el resto es **extensión** del mismo proyecto Supabase.

---

## 3. Cómo conecta cada sección

### 3.1 Productos (`productos/`)

| Acción | Tablas |
|--------|--------|
| Listar / CRUD carta | `products`, `product_categories` |
| Fotos / metadata | `product_images` (opcional) o `jsonb` en `products` |

**Conexión:** Pedidos, Caja y Cocina **solo consultan** `products` (activos, por categoría). No duplicar precios en otro módulo.

---

### 3.2 Pedidos — Salón (`Pedidos/`)

| Acción | Tablas |
|--------|--------|
| Mesas y estado | `dining_tables` (`number`, `zone`, `status`, `restaurant_id`) |
| Pedido activo en mesa | `orders` con `channel = 'salon'` y `table_id`; `order_items` con líneas |
| Enviar a cocina | Actualizar estado del pedido o de ítems; insertar en `kitchen_tickets` si usas cola explícita |

**Conexión:** `order_items.product_id` → `products.id`. Al abrir cuenta, totales = suma de líneas (+ cargos, propinas en tablas dedicadas o JSON estructurado).

---

### 3.3 Delivery (`Delivery/`)

| Acción | Tablas |
|--------|--------|
| Pedido delivery | `orders` con `channel = 'delivery'`; dirección y datos de contacto en `orders` o `delivery_details` (1:1) |
| Cliente | `customers.id` opcional en `orders.customer_id` |
| Canal externo | Campos `external_channel`, `external_order_id` (Rappi, etc.) |

**Conexión:** Mismas `order_items` que salón; la cocina y caja leen el mismo `orders`.

---

### 3.4 Cocina (`Cocina/`)

| Acción | Tablas |
|--------|--------|
| Cola de preparación | Vista o query sobre `order_items` + `orders` donde estado ∈ preparación |
| Marcar listo | Actualizar `order_items` o `orders`; notificación push opcional |

**Conexión:** No inventar “platos” aquí: siempre `product_id` → nombre desde `products`.

---

### 3.5 Caja (`Caja/`)

| Acción | Tablas |
|--------|--------|
| Cobrar pedido | `payments` (`order_id`, `amount`, `method`, `received_at`, `user_id`) |
| Cierre de turno | `cash_sessions` (apertura/cierre, arqueo) — tabla recomendada |
| Propinas / descuentos | `order_adjustments` o campos en `payments` según complejidad |

**Conexión:** `payments.order_id` → `orders.id`. El pedido debe estar **cerrado** o en estado “listo para cobro” según reglas de negocio.

---

### 3.6 Facturación (`Facturacion/`)

| Acción | Tablas |
|--------|--------|
| Boleta / factura | `invoices` (`order_id`, tipo, serie, número, estado SUNAT/local, xml/pdf url) |
| Notas de crédito | `credit_notes` referenciando `invoice_id` |

**Conexión:** Parte del **mismo** `order_id` que Caja; la factura es capa tributaria/documental, no duplica líneas de producto (referencia + snapshot legal si hace falta).

---

### 3.7 Clientes (`Clientes/`)

| Acción | Tablas |
|--------|--------|
| CRM | `customers` (documento, nombre, teléfono, tags) |
| Historial | `orders` filtrados por `customer_id` o por teléfono/documento enlazado |

**Conexión:** Pedidos delivery y facturas con datos de cliente usan `customer_id` cuando exista registro.

---

### 3.8 Recetas (`Recetas/`)

| Acción | Tablas |
|--------|--------|
| Ficha técnica | `recipes` (`nombre`, `porciones`, `activo`) |
| Costeo | `recipe_ingredients` (`insumo_id`, `cantidad`, `unidad`) → costo estimado con `insumos.costo_unitario` |
| Enlace a carta (opcional) | `recipes.sale_product_id` → `products.id` (un producto vendible = una receta estándar) |

**Conexión:** **Almacén** descuenta insumos por consumo de receta (salida automática) o **Pedidos** disparan “consumo teórico” según política (MVP: salidas manuales desde receta).

---

### 3.9 Almacén (`Almacen/`)

| Acción | Tablas |
|--------|--------|
| Stock | `insumos` (ya en migración) |
| Entradas / salidas | `entradas_insumos`, `salidas_insumos` |
| Proveedores | `proveedores` |

**Conexión:** `salidas_insumos.referencia_id` puede apuntar a `order_id`, `recipe_id` o movimiento interno. Así se une **operación de restaurante** con **movimiento de inventario**.

---

### 3.10 Reportes (`Reportes/`)

| Acción | Origen |
|--------|--------|
| Ventas por plato | Agregar `order_items` join `orders` (fechas cerradas, `payments` confirmados) |
| Food cost | `recipe_ingredients` + precios de `insumos` vs ventas de `products` |
| Stock | `insumos` + movimientos |

**Conexión:** Solo lectura agregada; no nuevas tablas de “reporte” salvo caches/materialized views si hace falta rendimiento.

---

### 3.11 Configuración / Accesos / IA

| Sección | Tablas / uso |
|---------|----------------|
| **Accesos** | `profiles`, invitaciones (tablas ya alineadas con Supabase Auth en tu flujo actual) |
| **Configuración** | `restaurant_settings` (jsonb por clave: impuestos, moneda, series documento) |
| **IA / RAG** | `documents` + embeddings (`IA/supabase-setup.sql`) — independiente del operativo; opcional `metadata.restaurant_id` |

---

## 4. Matriz rápida módulo ↔ tablas

| Módulo | Lectura principal | Escritura principal |
|--------|-------------------|---------------------|
| Productos | `products`, categorías | `products` |
| Pedidos | `products`, `dining_tables`, `orders`, `order_items` | `orders`, `order_items`, estados mesa |
| Cocina | `order_items`, `orders`, `products` | estados ítem/pedido |
| Caja | `orders`, `order_items`, `payments` | `payments`, `cash_sessions` |
| Facturación | `orders`, `invoices` | `invoices`, `credit_notes` |
| Clientes | `customers`, `orders` | `customers` |
| Delivery | `orders`, `order_items`, `customers` | `orders`, detalle delivery |
| Recetas | `recipes`, `recipe_ingredients`, `insumos` | `recipes`, ingredientes |
| Almacén | `insumos`, movimientos, `proveedores` | insumos, entradas, salidas |
| Reportes | vistas sobre lo anterior | — |

---

## 5. Flujo operativo resumido (end-to-end)

1. **Administrador** carga carta en **Productos** → filas en `products`.
2. **Mesero / salón** arma pedido → `orders` + `order_items` (precios snapshot).
3. **Cocina** cambia estados hasta “listo”.
4. **Caja** registra `payments` y cierra `orders`.
5. **Facturación** emite `invoices` ligadas al mismo pedido (si aplica).
6. **Almacén** registra `salidas_insumos` (manual o enlazado a pedido/receta).
7. **Reportes** consolida ventas y márgenes.

---

## 6. Orden sugerido de implementación en Supabase

1. `restaurants` + `profiles` (tenant y roles).  
2. `product_categories` + `products`.  
3. `dining_tables` + `orders` + `order_items` (incluye canales salón/delivery/takeaway).  
4. `payments` (+ `cash_sessions` si aplica).  
5. `customers` y enlaces en `orders`.  
6. `recipes` + `recipe_ingredients` (insumos ya existentes).  
7. `invoices` / notas (según requisitos legales).  
8. Vistas o Edge Functions para reportes pesados.

---

## 7. Referencias en el repo

- Borrador en código: `scripts/domain-data-layer.js`  
- Esquema almacén (referencia legado / columnas): `Almacen/migration.sql`  
- Vector / RAG: `IA/supabase-setup.sql`  
- **Núcleo operativo Supabase (tenants, carta, pedidos, caja, recetas, inventario, delivery):** `supabase/migrations/20260428120000_mirest_operational_core.sql`  

Aplicar en local: `supabase db push` o pegar el SQL en **Supabase → SQL Editor**. El JWT debe incluir el claim `tenant_id` (uuid) para que las políticas RLS con `app.current_tenant_id()` funcionen.

Cuando el esquema crezca, conviene **versionar** migraciones SQL en `supabase/migrations/` y mantener este documento alineado con los nombres reales de tablas y columnas.
