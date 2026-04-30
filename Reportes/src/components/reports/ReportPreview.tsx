import { reportPreviewData } from "@/data/reportData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Eye, FileText, StickyNote } from "lucide-react";

interface ReportPreviewProps {
  activeSections: string[];
  reportType: string;
  dateFrom: string;
  dateTo: string;
  generated: boolean;
  notes: string;
}

export function ReportPreview({ activeSections, reportType, dateFrom, dateTo, generated, notes }: ReportPreviewProps) {
  const d = reportPreviewData;

  const typeName = reportType === "resumen-dia" ? "Resumen del Día"
    : reportType === "inventario" ? "Inventario"
    : reportType === "movimientos-almacen" ? "Movimientos de Almacén"
    : "Gastos";

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const formatDatePE = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formattedDate = dateFrom === dateTo
    ? `${formatDatePE(dateFrom)} — ${timeStr}`
    : `${formatDatePE(dateFrom)} – ${formatDatePE(dateTo)} — ${timeStr}`;

  // Empty state
  if (!generated || activeSections.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
          <Eye className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Vista previa del reporte</span>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {!generated
              ? "Configura los parámetros y presiona \"Generar reporte\" para ver la vista previa"
              : "Activa al menos una sección para ver la vista previa"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            El reporte se mostrará aquí con el formato final de exportación
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Vista previa del reporte</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            <FileDown className="h-3.5 w-3.5" /> Descargar PDF
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Descargar Excel
          </Button>
        </div>
      </div>

      {/* Document — paper style */}
      <div className="bg-muted/20 p-4 sm:p-8">
        <div className="bg-white rounded-lg shadow-md max-w-3xl mx-auto border border-border/50">
          <div className="p-6 sm:p-8">
            {/* Document header */}
            <div className="border-b-2 border-primary pb-4 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{d.restaurant}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">RUC: {d.ruc || "—"}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block rounded-md bg-gradient-to-r from-primary to-primary/80 px-3 py-1">
                    <span className="text-xs font-semibold text-primary-foreground">{typeName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formattedDate}</p>
                </div>
              </div>
            </div>

            {/* Ventas del día */}
            {activeSections.includes("ventas") && (
              <section className="mb-6">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Ventas del Día
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatBox label="Total ventas" value={`S/ ${d.ventas.total.toLocaleString()}`} />
                  <StatBox label="Efectivo" value={`S/ ${d.ventas.efectivo.toLocaleString()}`} />
                  <StatBox label="Tarjeta" value={`S/ ${d.ventas.tarjeta.toLocaleString()}`} />
                  <StatBox label="Delivery" value={`S/ ${d.ventas.delivery.toLocaleString()}`} />
                  <StatBox label="Pedidos" value={d.ventas.pedidos.toString()} />
                  <StatBox label="Ticket promedio" value={`S/ ${d.ventas.ticketPromedio}`} />
                </div>
              </section>
            )}

            {/* Platos vendidos */}
            {activeSections.includes("platos") && (
              <section className="mb-6">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Platos Vendidos
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Plato</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Cant.</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Precio</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.platos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-xs text-muted-foreground py-4 text-center">
                          Sin platos en el rango. Los datos reales vienen del motor de reportes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      d.platos.map((p) => (
                      <TableRow key={p.nombre}>
                        <TableCell className="text-xs">{p.nombre}</TableCell>
                        <TableCell className="text-xs text-right">{p.cantidad}</TableCell>
                        <TableCell className="text-xs text-right">S/ {p.precio}</TableCell>
                        <TableCell className="text-xs text-right font-medium">S/ {p.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                    )}
                    {d.platos.length > 0 && (
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell className="text-xs">Total</TableCell>
                      <TableCell className="text-xs text-right">{d.platos.reduce((a, b) => a + b.cantidad, 0)}</TableCell>
                      <TableCell className="text-xs text-right" />
                      <TableCell className="text-xs text-right">S/ {d.platos.reduce((a, b) => a + b.total, 0).toLocaleString()}</TableCell>
                    </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>
            )}

            {/* Mesas atendidas */}
            {activeSections.includes("mesas") && (
              <section className="mb-6">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Mesas Atendidas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatBox label="Total atendidas" value={d.mesas.totalAtendidas.toString()} />
                  <StatBox label="Mesa mayor venta" value={`${d.mesas.mesaMayor.mesa} — S/ ${d.mesas.mesaMayor.total}`} />
                  <StatBox label="Ocupación" value={d.mesas.ocupacion} />
                </div>
              </section>
            )}

            {/* Caja */}
            {activeSections.includes("caja") && (
              <section className="mb-6">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Caja
                </h3>
                <Table>
                  <TableBody>
                    <TableRow><TableCell className="text-xs text-muted-foreground">Apertura de caja</TableCell><TableCell className="text-xs text-right">S/ {d.caja.apertura.toLocaleString()}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs text-muted-foreground">Ingreso efectivo</TableCell><TableCell className="text-xs text-right">S/ {d.caja.ingresoEfectivo.toLocaleString()}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs text-muted-foreground">Ingreso tarjeta</TableCell><TableCell className="text-xs text-right">S/ {d.caja.ingresoTarjeta.toLocaleString()}</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs text-muted-foreground">Egresos</TableCell><TableCell className="text-xs text-right text-destructive">- S/ {d.caja.egresos.toLocaleString()}</TableCell></TableRow>
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell className="text-xs">Cierre de caja</TableCell>
                      <TableCell className="text-xs text-right">S/ {d.caja.cierre.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground">Diferencia</TableCell>
                      <TableCell className={`text-xs text-right font-medium ${d.caja.diferencia === 0 ? "text-success" : "text-destructive"}`}>
                        S/ {d.caja.diferencia.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </section>
            )}

            {/* Notas / Observaciones */}
            {notes.trim() && (
              <section className="border-t border-border pt-4">
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5 text-primary" />
                  Notas / Observaciones
                </h3>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{notes}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 bg-muted/20">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}
