export const MODULES = [
  { key: "productos", path: "/mirest/src/modules/productos/index.html", label: "Productos" },
  { key: "recetas", path: "/mirest/src/modules/recetas/index.html", label: "Recetas" },
  { key: "almacen", path: "/mirest/src/modules/almacen/index.html", label: "Almacen" },
  { key: "clientes", path: "/mirest/src/modules/clientes/index.html", label: "Clientes" },
  { key: "delivery", path: "/mirest/src/modules/delivery/index.html", label: "Delivery" },
  { key: "cocina", path: "/mirest/src/modules/cocina/index.html", label: "Cocina" },
  { key: "caja", path: "/mirest/src/modules/caja/index.html", label: "Caja" },
  { key: "reportes", path: "/mirest/src/modules/reportes/index.html", label: "Reportes" },
  { key: "pedidos", path: "/mirest/src/modules/pedidos/index.html", label: "Pedidos" },
  { key: "configuracion", path: "/mirest/src/modules/configuracion/index.html", label: "Configuracion" },
  { key: "accesos", path: "/mirest/src/modules/accesos/index.html", label: "Accesos" },
  { key: "facturacion", path: "/mirest/src/modules/facturacion/index.html", label: "Facturacion" },
  { key: "soporte", path: "/mirest/src/modules/soporte/index.html", label: "Soporte" },
];

export function getModulesByPermissions(permissions = []) {
  if (permissions.includes("*")) return MODULES;
  return MODULES.filter((m) => permissions.includes(m.key));
}
