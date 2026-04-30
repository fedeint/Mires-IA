-- ============================================================
-- Almacen/migration.sql
-- Migración del módulo Almacén de MiRest a Supabase
-- ============================================================

-- ============================================================
-- 1. CREAR TABLAS
-- ============================================================

CREATE TABLE insumos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text UNIQUE NOT NULL,
  nombre        text NOT NULL,
  categoria     text,
  ubicacion     text,
  stock_actual  numeric DEFAULT 0,
  unidad        text,
  stock_minimo  numeric DEFAULT 0,
  costo_unitario numeric DEFAULT 0,
  ultimo_ingreso text,
  proveedor     text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE entradas_insumos (
  id                    text PRIMARY KEY,
  fecha                 text,
  hora                  text,
  comprobante           text,
  usuario               text,
  notas                 text,
  tipo                  text,
  referencia_id         text,
  costo_total_movimiento numeric DEFAULT 0,
  ingredientes          jsonb,
  archivos              jsonb,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE salidas_insumos (
  id                    text PRIMARY KEY,
  fecha                 text,
  hora                  text,
  motivo                text,
  justificacion         text,
  comprobante           text,
  usuario               text,
  notas                 text,
  tipo                  text,
  referencia_id         text,
  costo_total_movimiento numeric DEFAULT 0,
  ingredientes          jsonb,
  archivos              jsonb,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE proveedores (
  id            bigint PRIMARY KEY,
  nombre        text NOT NULL,
  ruc           text,
  telefono      text,
  categoria     jsonb,
  ubicacion     text,
  dias_credito  integer DEFAULT 0,
  ultimo_ingreso text,
  estado        text DEFAULT 'Activo',
  distancia_km  numeric DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE insumos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE salidas_insumos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. POLÍTICAS DE ACCESO PÚBLICO (anon key)
-- ============================================================

CREATE POLICY "public_read_write_insumos"
  ON insumos
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_read_write_entradas_insumos"
  ON entradas_insumos
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_read_write_salidas_insumos"
  ON salidas_insumos
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_read_write_proveedores"
  ON proveedores
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. ÍNDICES
-- ============================================================

CREATE INDEX idx_insumos_codigo          ON insumos(codigo);
CREATE INDEX idx_entradas_insumos_created ON entradas_insumos(created_at);
CREATE INDEX idx_salidas_insumos_created  ON salidas_insumos(created_at);

-- ============================================================
-- 5. Datos iniciales
-- ============================================================
-- Sin seed de insumos: el inventario se carga desde la app / Supabase (tabla insumos vacía tras DDL).
