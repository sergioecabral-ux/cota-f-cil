import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import RevisaoTab from "@/components/RevisaoTab";
import ComparacaoTab from "@/components/ComparacaoTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Upload, Play, MoreHorizontal, Eye, RefreshCw, Check, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabel: Record<string, string> = { open: "Aberto", closed: "Fechado" };
const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-highlight/15 text-highlight-foreground",
  high: "bg-destructive/15 text-destructive",
};

const severityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2 };
const severityBadge: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-highlight/15 text-highlight border-highlight/30",
  normal: "bg-muted text-muted-foreground border-border",
};

// --- Review modal types ---
interface ReviewItem {
  id: string;
  severity: string;
  reason: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  quote?: {
    id: string;
    lead_time_days: number | null;
    lead_time_notes: string | null;
    shipping_terms: string | null;
    shipping_cost: number | null;
    minimum_order_value: number | null;
    minimum_order_qty: number | null;
    minimum_order_notes: string | null;
    supplier_name: string;
  };
}

const REASON_MAP: Record<string, (q: Record<string, any>) => boolean> = {
  "Prazo de entrega ausente": (q) => q.lead_time_days != null,
  "Frete ausente": (q) => q.shipping_terms != null || q.shipping_cost != null,
  "Pedido mínimo ausente": (q) => q.minimum_order_value != null || q.minimum_order_qty != null,
};

const EventoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewEvidence, setViewEvidence] = useState<any | null>(null);
  const [showCriticasModal, setShowCriticasModal] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());

  // Auto-open modal if ?criticas=1
  useEffect(() => {
    if (searchParams.get("criticas") === "1") {
      setShowCriticasModal(true);
    }
  }, [searchParams]);

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

  // Fetch critical count
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

  // Fetch high count
  const { data: highCount = 0 } = useQuery({
    queryKey: ["event-high-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("review_queue")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id!)
        .is("resolved_at", null)
        .eq("severity", "high");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  // Fetch open review items for modal
  const { data: reviewItems = [] } = useQuery({
    queryKey: ["event-review-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_queue")
        .select("id, severity, reason, entity_type, entity_id, created_at")
        .eq("event_id", id!)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const items = (data || []).sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

      // Fetch quote+supplier data for quote-type items
      const quoteIds = [...new Set(items.filter(i => i.entity_type === 'quote').map(i => i.entity_id))];
      let quoteMap: Record<string, ReviewItem['quote']> = {};
      if (quoteIds.length > 0) {
        const { data: quotes } = await supabase
          .from("quotes")
          .select("id, supplier_id, lead_time_days, lead_time_notes, shipping_terms, shipping_cost, minimum_order_value, minimum_order_qty, minimum_order_notes")
          .in("id", quoteIds);
        if (quotes && quotes.length > 0) {
          const sIds = [...new Set(quotes.map(q => q.supplier_id))];
          const { data: suppliers } = await supabase.from("suppliers").select("id, name_raw, name_canonical").in("id", sIds);
          const sMap: Record<string, string> = {};
          suppliers?.forEach(s => { sMap[s.id] = s.name_canonical || s.name_raw; });

          quotes.forEach(q => {
            quoteMap[q.id] = {
              id: q.id,
              lead_time_days: q.lead_time_days,
              lead_time_notes: q.lead_time_notes ?? null,
              shipping_terms: q.shipping_terms,
              shipping_cost: q.shipping_cost,
              minimum_order_value: q.minimum_order_value,
              minimum_order_qty: q.minimum_order_qty,
              minimum_order_notes: q.minimum_order_notes ?? null,
              supplier_name: sMap[q.supplier_id] || "Desconhecido",
            };
          });
        }
      }

      return items.map(item => ({
        ...item,
        quote: quoteMap[item.entity_id],
      })) as ReviewItem[];
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

      const supplierIds = [...new Set(data.filter((e) => e.supplier_id).map((e) => e.supplier_id!))];
      let supplierMap: Record<string, string> = {};
      if (supplierIds.length > 0) {
        const { data: suppliers } = await supabase
          .from("suppliers")
          .select("id, name_raw")
          .in("id", supplierIds);
        if (suppliers) suppliers.forEach((s) => (supplierMap[s.id] = s.name_raw));
      }

      return data.map((e) => ({
        ...e,
        supplier_name: e.supplier_id ? supplierMap[e.supplier_id] || "—" : "—",
      }));
    },
    enabled: !!id,
  });

  // (Revisão tab moved to RevisaoTab component)

  // Reprocess single evidence via AI edge function
  const reprocessMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      // Reset status first
      await supabase
        .from("evidence")
        .update({ processing_status: "queued", processing_error: null })
        .eq("id", evidenceId);

      const { data, error } = await supabase.functions.invoke(
        "processar-cotacao",
        { body: { evidence_id: evidenceId } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-evidence", id] });
      queryClient.invalidateQueries({ queryKey: ["revisao-quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["revisao-items", id] });
      toast({ title: "Evidência processada com IA" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Real "Processar tudo" — calls edge function with AI extraction
  const processAllMutation = useMutation({
    mutationFn: async () => {
      if (!id) return 0;

      const { data: toProcess, error } = await supabase
        .from("evidence")
        .select("id")
        .eq("event_id", id)
        .in("kind", ["image", "pdf", "text"])
        .eq("functional_label", "quote")
        .in("processing_status", ["queued", "failed"]);
      if (error) throw error;
      if (!toProcess || toProcess.length === 0) return 0;

      let processed = 0;
      const errors: string[] = [];

      for (const ev of toProcess) {
        try {
          const { data, error: fnErr } = await supabase.functions.invoke(
            "processar-cotacao",
            { body: { evidence_id: ev.id } }
          );
          if (fnErr) throw fnErr;
          if (data?.error) throw new Error(data.error);
          processed++;
        } catch (err: any) {
          console.error(`Error processing evidence ${ev.id}:`, err);
          errors.push(err.message || "Erro desconhecido");
          // Mark as failed
          await supabase
            .from("evidence")
            .update({ processing_status: "failed", processing_error: err.message })
            .eq("id", ev.id);
        }
      }

      if (errors.length > 0 && processed === 0) {
        throw new Error(`Falha ao processar: ${errors[0]}`);
      }

      return processed;
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast({ title: "Nenhuma evidência pendente para processar" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["event-evidence", id] });
      queryClient.invalidateQueries({ queryKey: ["event-critical-count", id] });
      queryClient.invalidateQueries({ queryKey: ["event-high-count", id] });
      queryClient.invalidateQueries({ queryKey: ["revisao-quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["revisao-items", id] });
      queryClient.invalidateQueries({ queryKey: ["event-review-items", id] });
      toast({ title: `${count} evidência(s) processada(s)` });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
    },
  });

  // Resolve single review item
  const resolveMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("review_queue")
        .update({ resolved_at: new Date().toISOString(), resolved_by: "user" })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-review-items", id] });
      queryClient.invalidateQueries({ queryKey: ["event-critical-count", id] });
      queryClient.invalidateQueries({ queryKey: ["event-high-count", id] });
      toast({ title: "Pendência resolvida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Resolve by filling quote data
  const resolveWithDataMutation = useMutation({
    mutationFn: async ({ item, fields }: { item: ReviewItem; fields: Record<string, any> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Verify quote belongs to this event
      const { data: quoteCheck } = await supabase
        .from("quotes")
        .select("id, event_id")
        .eq("id", item.entity_id)
        .single();
      if (!quoteCheck || quoteCheck.event_id !== id) throw new Error("Quote não pertence a este evento");

      // Update quote
      const { error: updateErr } = await supabase
        .from("quotes")
        .update(fields)
        .eq("id", item.entity_id);
      if (updateErr) throw updateErr;

      // Audit log for each field
      for (const [fieldName, newValue] of Object.entries(fields)) {
        if (newValue === undefined) continue;
        const oldValue = item.quote?.[fieldName as keyof NonNullable<ReviewItem['quote']>] ?? null;
        await supabase.from("audit_log").insert({
          entity_type: "quote",
          entity_id: item.entity_id,
          field_name: fieldName,
          old_value: oldValue != null ? JSON.stringify(oldValue) : null,
          new_value: newValue != null ? JSON.stringify(newValue) : null,
          user_id: user.id,
          source_ref: { from: "criticas_modal", review_queue_id: item.id },
        });
      }

      // Resolve ALL matching open review_queue items for this quote+reason
      const { error: resolveErr } = await supabase
        .from("review_queue")
        .update({ resolved_at: new Date().toISOString(), resolved_by: "user" })
        .eq("entity_id", item.entity_id)
        .eq("entity_type", "quote")
        .eq("reason", item.reason)
        .is("resolved_at", null);
      if (resolveErr) throw resolveErr;

      return item.id;
    },
    onSuccess: (resolvedId) => {
      setResolvedItems(prev => new Set(prev).add(resolvedId));
      setExpandedItem(null);
      queryClient.invalidateQueries({ queryKey: ["event-review-items", id] });
      queryClient.invalidateQueries({ queryKey: ["event-critical-count", id] });
      queryClient.invalidateQueries({ queryKey: ["event-high-count", id] });
      queryClient.invalidateQueries({ queryKey: ["revisao-quotes", id] });
      queryClient.invalidateQueries({ queryKey: ["revisao-items", id] });
      toast({ title: "Dados salvos e pendência resolvida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  // (saveFieldMutation moved to RevisaoTab component)

  const handleView = async (ev: any) => {
    if (ev.kind === "text") {
      setViewEvidence(ev);
    } else if (ev.storage_path) {
      const { data } = await supabase.storage
        .from("evidence_vault")
        .createSignedUrl(ev.storage_path, 300);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
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
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${priorityColor[event.priority] || ""}`}>
                  {priorityLabel[event.priority] || event.priority}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 text-sm font-medium ${criticalCount > 0 ? "text-destructive hover:text-destructive" : "text-muted-foreground"}`}
                onClick={() => setShowCriticasModal(true)}
              >
                {criticalCount > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                {criticalCount} crítica{criticalCount !== 1 ? "s" : ""}
              </Button>
              {highCount > 0 && (
                <span className="text-xs font-medium text-highlight">
                  Altas: {highCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(`/importar-evidencias?eventId=${id}`)}>
                <Upload className="h-4 w-4 mr-1" /> Importar evidências
              </Button>
              <Button onClick={() => processAllMutation.mutate()} disabled={processAllMutation.isPending}>
                <Play className="h-4 w-4 mr-1" />
                {processAllMutation.isPending ? "Processando..." : "Processar tudo"}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue={searchParams.get("tab") || "dossie"}>
            <TabsList>
              <TabsTrigger value="dossie">Dossiê</TabsTrigger>
              <TabsTrigger value="revisao">Revisão</TabsTrigger>
              <TabsTrigger value="comparacao">Comparação</TabsTrigger>
            </TabsList>

            {/* Dossiê tab */}
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
                          <TableCell className="text-sm">{format(new Date(ev.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{ev.kind}</Badge></TableCell>
                          <TableCell className="text-sm">{ev.functional_label}</TableCell>
                          <TableCell>
                            <Badge variant={ev.processing_status === "done" ? "default" : ev.processing_status === "failed" ? "destructive" : "secondary"} className="text-xs">
                              {ev.processing_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-destructive max-w-[200px] truncate">{ev.processing_error || "—"}</TableCell>
                          <TableCell className="text-sm">{ev.supplier_name}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(ev)}><Eye className="h-4 w-4 mr-2" /> Ver</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => reprocessMutation.mutate(ev.id)}><RefreshCw className="h-4 w-4 mr-2" /> Reprocessar</DropdownMenuItem>
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
                  <Button variant="outline" className="mt-4" onClick={() => navigate(`/importar-evidencias?eventId=${id}`)}>
                    <Upload className="h-4 w-4 mr-1" /> Importar evidências
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Revisão tab */}
            <TabsContent value="revisao" className="mt-4">
              <RevisaoTab eventId={id!} criticalCount={criticalCount} highCount={highCount} onOpenCriticas={() => setShowCriticasModal(true)} />
            </TabsContent>

            {/* Comparação tab */}
            <TabsContent value="comparacao" className="mt-4">
              <ComparacaoTab eventId={id!} />
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

      {/* Críticas modal */}
      <Dialog open={showCriticasModal} onOpenChange={(open) => {
        setShowCriticasModal(open);
        if (!open) { setExpandedItem(null); setResolvedItems(new Set()); }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Críticas e pendências do evento
            </DialogTitle>
          </DialogHeader>
          {reviewItems.length > 0 ? (
            <ul className="divide-y divide-border">
              {reviewItems.map((item) => {
                const isResolved = resolvedItems.has(item.id);
                const isExpanded = expandedItem === item.id;
                const q = item.quote;

                return (
                  <li key={item.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${severityBadge[item.severity] || severityBadge.normal}`}>
                            {item.severity}
                          </span>
                          <span className="text-sm font-medium text-foreground">{item.reason}</span>
                          {isResolved && (
                            <Badge variant="default" className="text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Resolvida
                            </Badge>
                          )}
                        </div>
                        {q && (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <span className="font-medium text-foreground/80">{q.supplier_name}</span>
                            <span className="ml-2">· cotação {item.entity_id.slice(0, 8)}</span>
                            <div className="flex gap-3 mt-0.5 flex-wrap">
                              {item.reason.includes('Frete') && (
                                <>
                                  <span>Frete: {q.shipping_terms || '—'}</span>
                                  <span>Custo: {q.shipping_cost != null ? `R$ ${q.shipping_cost}` : '—'}</span>
                                </>
                              )}
                              {item.reason.includes('Prazo') && (
                                <span>Prazo: {q.lead_time_days != null ? `${q.lead_time_days} dias` : '—'}</span>
                              )}
                              {item.reason.includes('Pedido mínimo') && (
                                <>
                                  <span>Valor mín: {q.minimum_order_value != null ? `R$ ${q.minimum_order_value}` : '—'}</span>
                                  <span>Qtd mín: {q.minimum_order_qty != null ? String(q.minimum_order_qty) : '—'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isResolved && item.entity_type === 'quote' && q && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            Resolver
                          </Button>
                        )}
                        {!isResolved && (!q || item.entity_type !== 'quote') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => resolveMutation.mutate(item.id)}
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Marcar resolvida
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Inline resolve form */}
                    {isExpanded && !isResolved && q && (
                      <ResolveForm item={item} onSave={(fields) => resolveWithDataMutation.mutate({ item, fields })} isPending={resolveWithDataMutation.isPending} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhuma pendência aberta neste evento.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// --- Inline resolve form component ---
const ResolveForm = ({ item, onSave, isPending }: { item: ReviewItem; onSave: (fields: Record<string, any>) => void; isPending: boolean }) => {
  const reason = item.reason;
  const q = item.quote!;

  const [shippingTerms, setShippingTerms] = useState(q.shipping_terms || "");
  const [shippingCost, setShippingCost] = useState(q.shipping_cost != null ? String(q.shipping_cost) : "");
  const [leadTimeDays, setLeadTimeDays] = useState(q.lead_time_days != null ? String(q.lead_time_days) : "");
  const [leadTimeNotes, setLeadTimeNotes] = useState(q.lead_time_notes || "");
  const [minOrderValue, setMinOrderValue] = useState(q.minimum_order_value != null ? String(q.minimum_order_value) : "");
  const [minOrderQty, setMinOrderQty] = useState(q.minimum_order_qty != null ? String(q.minimum_order_qty) : "");
  const [minOrderNotes, setMinOrderNotes] = useState(q.minimum_order_notes || "");

  if (reason.includes('Frete')) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-3 border border-border">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Termos de frete</Label>
            <Input value={shippingTerms} onChange={e => setShippingTerms(e.target.value)} placeholder="CIF, FOB..." className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Custo do frete (R$)</Label>
            <Input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
          </div>
        </div>
        <Button size="sm" onClick={() => onSave({
          shipping_terms: shippingTerms || null,
          shipping_cost: shippingCost ? Number(shippingCost) : null,
        })} disabled={isPending || (!shippingTerms && !shippingCost)}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          Salvar frete
        </Button>
      </div>
    );
  }

  if (reason.includes('Prazo')) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-3 border border-border">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Prazo de entrega (dias)</Label>
            <Input type="number" value={leadTimeDays} onChange={e => setLeadTimeDays(e.target.value)} placeholder="0" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações (opcional)</Label>
            <Input value={leadTimeNotes} onChange={e => setLeadTimeNotes(e.target.value)} placeholder="Detalhes..." className="h-8 text-sm" />
          </div>
        </div>
        <Button size="sm" onClick={() => onSave({
          lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
          lead_time_notes: leadTimeNotes || null,
        })} disabled={isPending || !leadTimeDays}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          Salvar prazo
        </Button>
      </div>
    );
  }

  if (reason.includes('Pedido mínimo')) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-3 border border-border">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Valor mínimo (R$)</Label>
            <Input type="number" value={minOrderValue} onChange={e => setMinOrderValue(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantidade mínima</Label>
            <Input type="number" value={minOrderQty} onChange={e => setMinOrderQty(e.target.value)} placeholder="0" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações (opcional)</Label>
            <Input value={minOrderNotes} onChange={e => setMinOrderNotes(e.target.value)} placeholder="Detalhes..." className="h-8 text-sm" />
          </div>
        </div>
        <Button size="sm" onClick={() => onSave({
          minimum_order_value: minOrderValue ? Number(minOrderValue) : null,
          minimum_order_qty: minOrderQty ? Number(minOrderQty) : null,
          minimum_order_notes: minOrderNotes || null,
        })} disabled={isPending || (!minOrderValue && !minOrderQty)}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          Salvar pedido mínimo
        </Button>
      </div>
    );
  }

  return null;
};

export default EventoDetalhe;
