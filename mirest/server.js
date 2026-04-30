import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { APP_CONFIG } from "./config/app.config.js";
import { notFound, errorHandler } from "./api/middleware/error.middleware.js";

import productosRoutes from "./api/routes/productos.routes.js";
import recetasRoutes from "./api/routes/recetas.routes.js";
import almacenRoutes from "./api/routes/almacen.routes.js";
import clientesRoutes from "./api/routes/clientes.routes.js";
import cocinaRoutes from "./api/routes/cocina.routes.js";
import cajaRoutes from "./api/routes/caja.routes.js";
import reportesRoutes from "./api/routes/reportes.routes.js";
import pedidosRoutes from "./api/routes/pedidos.routes.js";
import configuracionRoutes from "./api/routes/configuracion.routes.js";
import accesosRoutes from "./api/routes/accesos.routes.js";
import facturacionRoutes from "./api/routes/facturacion.routes.js";
import deliveryRoutes from "./api/routes/delivery.routes.js";
import soporteRoutes from "./api/routes/soporte.routes.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

app.use(helmet());
app.use(cors({ origin: APP_CONFIG.corsOrigin }));
app.use(express.json());

app.use(
  "/api",
  rateLimit({
    windowMs: APP_CONFIG.rateLimitWindowMs,
    max: APP_CONFIG.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Sirve frontend modular y activos existentes del repo durante la transición.
app.use(express.static(repoRoot));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "mirest-core",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/productos", productosRoutes);
app.use("/api/recetas", recetasRoutes);
app.use("/api/almacen", almacenRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/cocina", cocinaRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/accesos", accesosRoutes);
app.use("/api/facturacion", facturacionRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/soporte", soporteRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(APP_CONFIG.port, () => {
  console.log(`[MiRest] running at http://localhost:${APP_CONFIG.port}`);
});
