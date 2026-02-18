import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Upload, Play, MoreHorizontal, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const statusLabel: Record<string, string> = { open: "Aberto", closed: "Fechado" };
const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-highlight/15 text-highlight-foreground",
  high: "bg-destructive/15 text-destructive",
};

const EventoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewEvidence, setViewEvidence] = useState<any | null>(null);

  // Fetch event
  const { data: event, isLoading } = useQuery({
    queryKey: ["event-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch critical pendencias count
  const { data: criticalCount = 0 } = useQuery({
    queryKey: ["event-critical-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("review_queue")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id!)
        .is("resolved_at", null)
        .eq("severity", "critical");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  // Fetch evidence with supplier names
  const { data: evidenceList } = useQuery({
    queryKey: ["event-evidence", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence")
        .select("*")
        .eq("event_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Lookup supplier names
      const supplierIds = [...new Set(data.filter((e) => e.supplier_id).map((e) => e.supplier_id!))];
      let supplierMap: Record<string, string> = {};
      if (supplierIds.length > 0) {
        const { data: suppliers } = await supabase
          .from("suppliers")
          .select("id, name_raw")
          .in("id", supplierIds);
        if (suppliers) {
          suppliers.forEach((s) => {
            supplierMap[s.id] = s.name_raw;
          });
        }
      }

      return data.map((e) => ({
        ...e,
        supplier_name: e.supplier_id ? supplierMap[e.supplier_id] || "—" : "—",
      }));
    },
    enabled: !!id,
  });

  // Reprocess single evidence
  const reprocessMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      const { error } = await supabase
        .from("evidence")
        .update({ processing_status: "queued", processing_error: null })
        .eq("id", evidenceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-evidence", id] });
      toast({ title: "Evidência reenfileirada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Mock "Processar tudo"
  const processAllMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      // Get queued/failed evidence
      const { data: toProcess, error } = await supabase
        .from("evidence")
        .select("id")
        .eq("event_id", id)
        .in("processing_status", ["queued", "failed"]);
      if (error) throw error;
      if (!toProcess || toProcess.length === 0) {
        toast({ title: "Nenhuma evidência pendente para processar" });
        return;
      }

      const ids = toProcess.map((e) => e.id);

      // Set to processing
      await supabase
        .from("evidence")
        .update({ processing_status: "processing" })
        .in("id", ids);

      queryClient.invalidateQueries({ queryKey: ["event-evidence", id] });

      // Wait 1 second, then set back to queued
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await supabase
        .from("evidence")
        .update({ processing_status: "queued" })
        .in("id", ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-evidence", id] });
      toast({ title: "Processamento será ligado à IA no próximo passo" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // View evidence
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

  if (isLoading) {
    return (
      <>
        <Topbar title="Carregando..." />
        <div className="flex-1 p-6">
          <p className="text-sm text-muted-foreground">Carregando evento...</p>
        </div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <Topbar title="Evento não encontrado" />
        <div className="flex-1 p-6">
          <p className="text-sm text-muted-foreground">O evento solicitado não foi encontrado.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={event.title} />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={event.status === "open" ? "default" : "secondary"}>
                {statusLabel[event.status] || event.status}
              </Badge>
              {event.priority && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${priorityColor[event.priority] || ""}`}
                >
                  {priorityLabel[event.priority] || event.priority}
                </span>
              )}
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 text-destructive text-sm font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {criticalCount} crítica{criticalCount !== 1 ? "s" : ""}
                </span>
              )}
              {criticalCount === 0 && (
                <span className="text-sm text-muted-foreground">0 críticas</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/importar-evidencias?eventId=${id}`)}
              >
                <Upload className="h-4 w-4 mr-1" /> Importar evidências
              </Button>
              <Button
                onClick={() => processAllMutation.mutate()}
                disabled={processAllMutation.isPending}
              >
                <Play className="h-4 w-4 mr-1" />
                {processAllMutation.isPending ? "Processando..." : "Processar tudo"}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="dossie">
            <TabsList>
              <TabsTrigger value="dossie">Dossiê</TabsTrigger>
              <TabsTrigger value="revisao">Revisão</TabsTrigger>
              <TabsTrigger value="comparacao">Comparação</TabsTrigger>
            </TabsList>

            <TabsContent value="dossie" className="mt-4">
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
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evidenceList.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="text-sm">
                            {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {ev.kind}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{ev.functional_label}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                ev.processing_status === "done"
                                  ? "default"
                                  : ev.processing_status === "failed"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {ev.processing_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                            {ev.processing_error || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{ev.supplier_name}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(ev)}>
                                  <Eye className="h-4 w-4 mr-2" /> Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => reprocessMutation.mutate(ev.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" /> Reprocessar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                  <p className="text-muted-foreground">Nenhuma evidência neste evento.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate(`/importar-evidencias?eventId=${id}`)}
                  >
                    <Upload className="h-4 w-4 mr-1" /> Importar evidências
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="revisao" className="mt-4">
              <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                <p className="text-muted-foreground">Aba de revisão será implementada em breve.</p>
              </div>
            </TabsContent>

            <TabsContent value="comparacao" className="mt-4">
              <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                <p className="text-muted-foreground">Aba de comparação será implementada em breve.</p>
              </div>
            </TabsContent>
          </Tabs>
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

export default EventoDetalhe;
