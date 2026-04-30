import { useState } from "react";
import { ReportConfig } from "@/components/reports/ReportConfig";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { ReportHistory } from "@/components/reports/ReportHistory";
import { FileText } from "lucide-react";

const Index = () => {
  const [activeSections, setActiveSections] = useState(["ventas", "platos", "mesas", "caja"]);
  const [generated, setGenerated] = useState(false);
  const [notes, setNotes] = useState("");
  const [filters, setFilters] = useState({
    dateFrom: "2026-03-30",
    dateTo: "2026-03-30",
    reportType: "resumen-dia",
    reportName: "",
  });

  const toggleSection = (id: string) => {
    setActiveSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleGenerate = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setGenerated(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Reportes</h1>
            <p className="text-xs text-muted-foreground">MiRest · Generación y exportación de documentos</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <ReportConfig
          activeSections={activeSections}
          onToggle={toggleSection}
          notes={notes}
          onNotesChange={setNotes}
          onGenerate={handleGenerate}
        />

        <ReportPreview
          activeSections={activeSections}
          reportType={filters.reportType}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          generated={generated}
          notes={notes}
        />

        <ReportHistory />
      </main>
    </div>
  );
};

export default Index;
