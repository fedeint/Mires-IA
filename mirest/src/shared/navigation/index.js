export const MODULES = [
  { key: "productos", path: "/mirest/src/modules/productos/productos.html", label: "Productos" },
  { key: "recetas", path: "/mirest/src/modules/recetas/recetas.html", label: "Recetas" },
  { key: "almacen", path: "/mirest/src/modules/almacen/almacen.html", label: "Almacen" },
  { key: "clientes", path: "/mirest/src/modules/clientes/clientes.html", label: "Clientes" },
  { key: "delivery", path: "/mirest/src/modules/delivery/delivery.html", label: "Delivery" },
  { key: "cocina", path: "/mirest/src/modules/cocina/cocina.html", label: "Cocina" },
  { key: "caja", path: "/mirest/src/modules/caja/caja.html", label: "Caja" },
  { key: "reportes", path: "/mirest/src/modules/reportes/reportes.html", label: "Reportes" },
  { key: "pedidos", path: "/mirest/src/modules/pedidos/implementacion/Pedidos.html?module=pedidos", label: "Pedidos" },
  { key: "configuracion", path: "/mirest/src/modules/configuracion/configuracion.html", label: "Configuracion" },
  { key: "accesos", path: "/mirest/src/modules/accesos/accesos.html", label: "Accesos" },
  { key: "facturacion", path: "/mirest/src/modules/facturacion/facturacion.html", label: "Facturacion" },
  { key: "soporte", path: "/mirest/src/modules/soporte/soporte.html", label: "Soporte" },
];

export function getModulesByPermissions(permissions = []) {
  if (permissions.includes("*")) return MODULES;
  return MODULES.filter((m) => permissions.includes(m.key));
}
