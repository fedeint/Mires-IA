export function notFound(_req, res) {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
}

export function errorHandler(err, _req, res, _next) {
  console.error("[API ERROR]", err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "Error interno del servidor",
  });
}
