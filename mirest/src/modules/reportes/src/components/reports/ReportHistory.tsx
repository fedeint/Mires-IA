import { reportHistory } from "@/data/reportData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Copy, History } from "lucide-react";

export function ReportHistory() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <History className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Historial de reportes</h3>
          <p className="text-xs text-muted-foreground">Reportes generados anteriormente</p>
        </div>
      </div>

      {reportHistory.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin reportes generados aún. El historial se rellenará al conectar el servicio de exportación.</p>
      ) : (
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs font-semibold">Tipo</TableHead>
            <TableHead className="text-xs font-semibold">Fecha</TableHead>
            <TableHead className="text-xs font-semibold">Usuario</TableHead>
            <TableHead className="text-xs font-semibold">Formato</TableHead>
            <TableHead className="text-xs font-semibold text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reportHistory.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs font-medium">{r.tipo}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.fecha}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.usuario}</TableCell>
              <TableCell>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.formato === "PDF" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                  {r.formato}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Descargar">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Reutilizar configuración">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      )}
    </div>
  );
}
