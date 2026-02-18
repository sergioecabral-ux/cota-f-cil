import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Archive, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const ACCEPT_FILES = ".pdf,.jpg,.jpeg,.png";
const ACCEPT_ZIP = ".zip";

const ImportarEvidencias = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [eventId, setEventId] = useState<string>(searchParams.get("eventId") || "");
  const [supplierId, setSupplierId] = useState<string>("none");
  const [textContent, setTextContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [dragOverZip, setDragOverZip] = useState(false);
  const [viewEvidence, setViewEvidence] = useState<any | null>(null);

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name_raw")
        .order("name_raw");
      if (error) throw error;
      return data;
    },
  });

  // Fetch evidence for selected event
  const { data: evidenceList } = useQuery({
    queryKey: ["evidence", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("evidence")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const getSupplierIdOrNull = () => (supplierId === "none" ? null : supplierId);

  const getUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  };

  // Upload file mutation
  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");
      const timestamp = Date.now();
      const path = `${eventId}/${timestamp}_${file.name}`;
      const ext = file.name.split(".").pop()?.toLowerCase();
      const kind = ext === "pdf" ? "pdf" : "image";

      const { error: uploadError } = await supabase.storage
        .from("evidence_vault")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("evidence").insert({
        user_id: userId,
        event_id: eventId,
        supplier_id: getSupplierIdOrNull(),
        kind,
        storage_path: path,
        functional_label: "quote",
        processing_status: "queued",
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", eventId] });
      toast({ title: "Evidência enviada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  // Upload ZIP mutation
  const uploadZip = useMutation({
    mutationFn: async (file: File) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");
      const timestamp = Date.now();
      const path = `${eventId}/test_zip/${timestamp}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("evidence_vault")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("evidence").insert({
        user_id: userId,
        event_id: eventId,
        supplier_id: getSupplierIdOrNull(),
        kind: "zip",
        storage_path: path,
        functional_label: "other",
        processing_status: "queued",
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", eventId] });
      toast({ title: "ZIP enviado (modo teste)" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar ZIP", description: err.message, variant: "destructive" });
    },
  });

  // Save text mutation
  const saveText = useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");

      const { error } = await supabase.from("evidence").insert({
        user_id: userId,
        event_id: eventId,
        supplier_id: getSupplierIdOrNull(),
        kind: "text",
        text_content: textContent,
        functional_label: "quote",
        processing_status: "queued",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", eventId] });
      setTextContent("");
      toast({ title: "Texto salvo como evidência" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar texto", description: err.message, variant: "destructive" });
    },
  });

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!eventId) return;
      const files = Array.from(e.dataTransfer.files);
      files.forEach((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (["pdf", "jpg", "jpeg", "png"].includes(ext || "")) {
          uploadFile.mutate(f);
        }
      });
    },
    [eventId, uploadFile]
  );

  const handleDropZip = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverZip(false);
      if (!eventId) return;
      const files = Array.from(e.dataTransfer.files);
      files.forEach((f) => {
        if (f.name.toLowerCase().endsWith(".zip")) {
          uploadZip.mutate(f);
        }
      });
    },
    [eventId, uploadZip]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!eventId || !e.target.files) return;
    Array.from(e.target.files).forEach((f) => uploadFile.mutate(f));
    e.target.value = "";
  };

  const handleZipInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!eventId || !e.target.files) return;
    Array.from(e.target.files).forEach((f) => uploadZip.mutate(f));
    e.target.value = "";
  };

  // View evidence content
  const handleView = async (ev: any) => {
    if (ev.kind === "text") {
      setViewEvidence(ev);
    } else if (ev.storage_path) {
      const { data } = await supabase.storage
        .from("evidence_vault")
        .createSignedUrl(ev.storage_path, 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    }
  };

  const isDisabled = !eventId;

  return (
    <>
      <Topbar title="Importar Evidências" />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Evento *</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento" />
                </SelectTrigger>
                <SelectContent>
                  {events?.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fornecedor (opcional)</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Desconhecido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Desconhecido</SelectItem>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name_raw}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Block A - File Upload */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload de Arquivos (PDF / Imagem)
            </h2>
            <div
              className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              } ${isDisabled ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() =>
                !isDisabled &&
                document.getElementById("file-input")?.click()
              }
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-1">
                Arraste arquivos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, JPG, PNG — máx. 25MB
              </p>
              <input
                id="file-input"
                type="file"
                accept={ACCEPT_FILES}
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* Block B - Text paste */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Colar Texto (WhatsApp)
            </h2>
            <Textarea
              placeholder="Cole aqui o texto copiado do WhatsApp..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="min-h-[140px]"
              disabled={isDisabled}
            />
            <Button
              onClick={() => saveText.mutate()}
              disabled={isDisabled || !textContent.trim() || saveText.isPending}
            >
              Salvar texto como evidência
            </Button>
          </div>

          {/* Block C - ZIP upload */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Archive className="h-4 w-4" /> Upload ZIP (modo teste)
            </h2>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-highlight/10 border border-highlight/30">
              <AlertTriangle className="h-4 w-4 text-highlight mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">
                Modo teste. ZIP não será processado automaticamente no MVP.
              </p>
            </div>
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOverZip
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              } ${isDisabled ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZip(true);
              }}
              onDragLeave={() => setDragOverZip(false)}
              onDrop={handleDropZip}
              onClick={() =>
                !isDisabled &&
                document.getElementById("zip-input")?.click()
              }
            >
              <Archive className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Arraste um .zip ou clique</p>
              <input
                id="zip-input"
                type="file"
                accept={ACCEPT_ZIP}
                className="hidden"
                onChange={handleZipInput}
              />
            </div>
          </div>

          {/* Evidence table */}
          {eventId && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Evidências pendentes deste evento
              </h2>
              {evidenceList && evidenceList.length > 0 ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evidenceList.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="text-sm">
                            {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="text-sm">{ev.kind}</TableCell>
                          <TableCell className="text-sm">{ev.functional_label}</TableCell>
                          <TableCell className="text-sm">{ev.processing_status}</TableCell>
                          <TableCell className="text-sm text-destructive">
                            {ev.processing_error || "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(ev)}
                            >
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma evidência encontrada para este evento.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Text view dialog */}
      <Dialog open={!!viewEvidence} onOpenChange={() => setViewEvidence(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Conteúdo do Texto</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted rounded-lg p-4">
            {viewEvidence?.text_content}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImportarEvidencias;
