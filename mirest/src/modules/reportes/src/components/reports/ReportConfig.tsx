import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { reportTypes, reportSections, savedTemplates } from "@/data/reportData";
import {
  Calendar, FileText, RotateCcw, Layers, Save, Clock, Mail,
  MessageCircle, ChevronDown, ChevronUp, Bookmark, Play,
  Mic, MicOff, ImagePlus, StickyNote,
} from "lucide-react";

interface ReportConfigProps {
  activeSections: string[];
  onToggle: (id: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onGenerate: (filters: {
    dateFrom: string;
    dateTo: string;
    reportType: string;
    reportName: string;
  }) => void;
}

export function ReportConfig({ activeSections, onToggle, notes, onNotesChange, onGenerate }: ReportConfigProps) {
  const [dateFrom, setDateFrom] = useState("2026-03-30");
  const [dateTo, setDateTo] = useState("2026-03-30");
  const [reportType, setReportType] = useState("resumen-dia");
  const [reportName, setReportName] = useState("");
  const [showAutomation, setShowAutomation] = useState(false);
  const [frequency, setFrequency] = useState("diario");
  const [sendTime, setSendTime] = useState("08:00");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = () => {
    onGenerate({ dateFrom, dateTo, reportType, reportName });
  };

  const handleReset = () => {
    setDateFrom("2026-03-30");
    setDateTo("2026-03-30");
    setReportType("resumen-dia");
    setReportName("");
    setSelectedTemplate("");
    onNotesChange("");
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = savedTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    const type = reportTypes.find((r) => r.name === tpl.tipo);
    if (type) setReportType(type.id);
    setReportName(tpl.nombre);
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-PE";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onNotesChange(notes + (notes ? " " : "") + transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onNotesChange(notes + (notes ? "\n" : "") + `[Imagen adjunta: ${file.name}]`);
    e.target.value = "";
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Configuración del Reporte</h3>
      </div>

      {/* Template selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Bookmark className="h-3 w-3" /> Usar plantilla
        </Label>
        <div className="flex gap-2">
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sin plantilla</option>
            {savedTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} — {t.tipo}
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <Button size="sm" variant="outline" className="h-9 text-xs gap-1 shrink-0">
              <Play className="h-3 w-3" /> Aplicar
            </Button>
          )}
        </div>
      </div>

      {/* Filters grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Fecha desde
          </Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Fecha hasta
          </Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> Tipo de reporte
          </Label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {reportTypes.map((r) => (
              <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nombre (opcional)</Label>
          <Input type="text" placeholder="Ej: Cierre semanal" value={reportName} onChange={(e) => setReportName(e.target.value)} className="text-sm h-9" />
        </div>
      </div>

      {/* Section toggles */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Secciones del reporte</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {reportSections.map((section) => (
            <div
              key={section.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:border-primary/30 transition-colors"
            >
              <Label className="text-xs font-medium text-foreground cursor-pointer">{section.label}</Label>
              <Switch
                checked={activeSections.includes(section.id)}
                onCheckedChange={() => onToggle(section.id)}
                className="scale-90"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Notes / Observaciones — multimodal input */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <StickyNote className="h-3 w-3" /> Notas / Observaciones (opcional)
        </Label>
        <div className="relative">
          <Textarea
            placeholder="Escribe observaciones, dicta por voz o adjunta una imagen..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="text-sm min-h-[72px] pr-20 resize-none"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={isRecording ? "default" : "ghost"}
              className={`h-7 w-7 p-0 ${isRecording ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}`}
              onClick={toggleVoiceInput}
              title={isRecording ? "Detener grabación" : "Dictar por voz"}
            >
              {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar imagen"
            >
              <ImagePlus className="h-3.5 w-3.5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        </div>
        {isRecording && (
          <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            Grabando... habla ahora
          </p>
        )}
      </div>

      {/* Automation toggle */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => setShowAutomation(!showAutomation)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Automatización de envío
          </span>
          {showAutomation ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showAutomation && (
          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Frecuencia</Label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Hora de envío
              </Label>
              <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </Label>
              <Input type="email" placeholder="gerente@mirest.com" value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </Label>
              <Input type="tel" placeholder="+51 999 999 999" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="text-sm h-9" />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" /> Limpiar
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5">
            <Save className="h-3 w-3" /> Guardar como plantilla
          </Button>
        </div>
        <Button size="sm" className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 px-5" onClick={handleGenerate}>
          Generar reporte
        </Button>
      </div>
    </div>
  );
}
