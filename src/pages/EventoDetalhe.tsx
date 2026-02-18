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
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Upload, Play, MoreHorizontal, Eye, RefreshCw, Save, Check } from "lucide-react";
import { format } from "date-fns";

const statusLabel: Record<string, string> = { open: "Aberto", closed: "Fechado" };
const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-highlight/15 text-highlight-foreground",
  high: "bg-destructive/15 text-destructive",
};

// --- Revisão tab types ---
interface QuoteRow {
  id: string;
  supplier_id: string;
  evidence_id: string;
  lead_time_days: number | null;
  shipping_terms: string | null;
  shipping_cost: number | null;
  minimum_order_value: number | null;
  minimum_order_qty: number | null;
  payment_terms: string | null;
  validity_days: number | null;
}

interface SupplierGroup {
  supplier_id: string;
  supplier_name: string;
  quotes: QuoteRow[];
}

const EDITABLE_FIELDS = [
  { key: "lead_time_days", label: "Prazo (dias)", type: "number" },
  { key: "shipping_terms", label: "Frete (termos)", type: "text" },
  { key: "shipping_cost", label: "Frete (R$)", type: "number" },
  { key: "minimum_order_value", label: "Ped. mín. (R$)", type: "number" },
  { key: "minimum_order_qty", label: "Ped. mín. (qtd)", type: "number" },
  { key: "payment_terms", label: "Pagamento", type: "text" },
  { key: "validity_days", label: "Validade (dias)", type: "number" },
] as const;

type EditableFieldKey = (typeof EDITABLE_FIELDS)[number]["key"];

const REASON_MAP: Record<string, (q: Record<string, any>) => boolean> = {
  "Prazo de entrega ausente": (q) => q.lead_time_days != null,
  "Frete ausente": (q) => q.shipping_terms != null || q.shipping_cost != null,
  "Pedido mínimo ausente": (q) => q.minimum_order_value != null || q.minimum_order_qty != null,
};

const EventoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewEvidence, setViewEvidence] = useState<any | null>(null);
  const [editingCell, setEditingCell] = useState<{ quoteId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

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

  // Fetch quotes grouped by supplier for Revisão tab
  const { data: supplierGroups } = useQuery({
    queryKey: ["event-quotes-grouped", id],
    queryFn: async () => {
      const { data: quotes, error } = await supabase
        .from("quotes")
        .select("id, supplier_id, evidence_id, lead_time_days, shipping_terms, shipping_cost, minimum_order_value, minimum_order_qty, payment_terms, validity_days")
        .eq("event_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!quotes || quotes.length === 0) return [] as SupplierGroup[];

      const sIds = [...new Set(quotes.map((q) => q.supplier_id))];
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, name_raw")
        .in("id", sIds);
      const sMap: Record<string, string> = {};
      suppliers?.forEach((s) => (sMap[s.id] = s.name_raw));

      const groups: Record<string, SupplierGroup> = {};
      quotes.forEach((q) => {
        if (!groups[q.supplier_id]) {
          groups[q.supplier_id] = {
            supplier_id: q.supplier_id,
            supplier_name: sMap[q.supplier_id] || "Desconhecido",
            quotes: [],
          };
        }
        groups[q.supplier_id].quotes.push(q);
      });

      return Object.values(groups);
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

  // Real "Processar tudo"
  const processAllMutation = useMutation({
    mutationFn: async () => {
      if (!id) return 0;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get eligible evidence
      const { data: toProcess, error } = await supabase
        .from("evidence")
        .select("id, supplier_id")
        .eq("event_id", id)
        .in("kind", ["image", "pdf", "text"])
        .eq("functional_label", "quote")
        .in("processing_status", ["queued", "failed"]);
      if (error) throw error;
      if (!toProcess || toProcess.length === 0) return 0;

      // Ensure "Desconhecido" supplier exists
      let fallbackSupplierId: string | null = null;
      const needsFallback = toProcess.some((e) => !e.supplier_id);
      if (needsFallback) {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("name_raw", "Desconhecido")
          .eq("user_id", user.id)
          .limit(1);

        if (existing && existing.length > 0) {
          fallbackSupplierId = existing[0].id;
        } else {
          const { data: created, error: createErr } = await supabase
            .from("suppliers")
            .insert({ name_raw: "Desconhecido", user_id: user.id, status_review: false })
            .select("id")
            .single();
          if (createErr) throw createErr;
          fallbackSupplierId = created.id;
        }
      }

      let processed = 0;

      for (const ev of toProcess) {
        const supplierId = ev.supplier_id || fallbackSupplierId!;

        // Create quote
        const { data: quote, error: qErr } = await supabase
          .from("quotes")
          .insert({
            event_id: id,
            supplier_id: supplierId,
            evidence_id: ev.id,
            needs_review: true,
            confidence_overall: 0,
            user_id: user.id,
          })
          .select("id")
          .single();
        if (qErr) throw qErr;

        // Create review_queue entries
        const { error: rqErr } = await supabase.from("review_queue").insert([
          { event_id: id, entity_type: "quote", entity_id: quote.id, severity: "critical", reason: "Prazo de entrega ausente", user_id: user.id },
          { event_id: id, entity_type: "quote", entity_id: quote.id, severity: "critical", reason: "Frete ausente", user_id: user.id },
          { event_id: id, entity_type: "quote", entity_id: quote.id, severity: "high", reason: "Pedido mínimo ausente", user_id: user.id },
        ]);
        if (rqErr) throw rqErr;

        // Mark evidence as done
        await supabase
          .from("evidence")
          .update({ processing_status: "done", processing_error: null })
          .eq("id", ev.id);

        processed++;
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
      queryClient.invalidateQueries({ queryKey: ["event-quotes-grouped", id] });
      toast({ title: `${count} evidência(s) processada(s)` });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
    },
  });

  // Save quote field inline
  const saveFieldMutation = useMutation({
    mutationFn: async ({ quoteId, field, value, oldValue }: { quoteId: string; field: EditableFieldKey; value: any; oldValue: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Update quote
      const { error } = await supabase
        .from("quotes")
        .update({ [field]: value })
        .eq("id", quoteId);
      if (error) throw error;

      // Audit log
      await supabase.from("audit_log").insert({
        entity_type: "quote",
        entity_id: quoteId,
        field_name: field,
        old_value: oldValue != null ? JSON.stringify(oldValue) : null,
        new_value: value != null ? JSON.stringify(value) : null,
        user_id: user.id,
      });

      // Resolve matching review_queue entries
      // Re-fetch the updated quote to check conditions
      const { data: updatedQuote } = await supabase
        .from("quotes")
        .select("id, lead_time_days, shipping_terms, shipping_cost, minimum_order_value, minimum_order_qty")
        .eq("id", quoteId)
        .single();

      if (updatedQuote) {
        for (const [reason, check] of Object.entries(REASON_MAP)) {
          if (check(updatedQuote)) {
            await supabase
              .from("review_queue")
              .update({ resolved_at: new Date().toISOString(), resolved_by: "user" })
              .eq("entity_id", quoteId)
              .eq("entity_type", "quote")
              .eq("reason", reason)
              .is("resolved_at", null);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-quotes-grouped", id] });
      queryClient.invalidateQueries({ queryKey: ["event-critical-count", id] });
      setEditingCell(null);
      toast({ title: "Salvo" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

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

  const startEdit = (quoteId: string, field: string, currentValue: any) => {
    setEditingCell({ quoteId, field });
    setEditValue(currentValue != null ? String(currentValue) : "");
  };

  const commitEdit = (quote: QuoteRow) => {
    if (!editingCell) return;
    const fieldDef = EDITABLE_FIELDS.find((f) => f.key === editingCell.field);
    if (!fieldDef) return;

    const oldValue = quote[editingCell.field as EditableFieldKey];
    let newValue: any = editValue.trim() === "" ? null : editValue.trim();
    if (fieldDef.type === "number" && newValue != null) {
      newValue = Number(newValue);
      if (isNaN(newValue)) newValue = null;
    }

    saveFieldMutation.mutate({
      quoteId: quote.id,
      field: editingCell.field as EditableFieldKey,
      value: newValue,
      oldValue,
    });
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
              <span className={`flex items-center gap-1 text-sm font-medium ${criticalCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {criticalCount > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                {criticalCount} crítica{criticalCount !== 1 ? "s" : ""}
              </span>
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
          <Tabs defaultValue="dossie">
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
            <TabsContent value="revisao" className="mt-4 space-y-6">
              {supplierGroups && supplierGroups.length > 0 ? (
                supplierGroups.map((group) => (
                  <div key={group.supplier_id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="bg-muted/50 px-4 py-3 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground">{group.supplier_name}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {EDITABLE_FIELDS.map((f) => (
                              <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.quotes.map((quote) => (
                            <TableRow key={quote.id}>
                              {EDITABLE_FIELDS.map((f) => {
                                const isEditing = editingCell?.quoteId === quote.id && editingCell?.field === f.key;
                                const val = quote[f.key as EditableFieldKey];

                                return (
                                  <TableCell key={f.key} className="py-1 px-2">
                                    {isEditing ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type={f.type}
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(quote); if (e.key === "Escape") setEditingCell(null); }}
                                          className="h-7 text-xs w-24"
                                          autoFocus
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => commitEdit(quote)}
                                          disabled={saveFieldMutation.isPending}
                                        >
                                          <Check className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <button
                                        className="text-xs text-left w-full px-1 py-0.5 rounded hover:bg-muted/50 transition-colors min-w-[60px]"
                                        onClick={() => startEdit(quote.id, f.key, val)}
                                      >
                                        {val != null ? String(val) : <span className="text-muted-foreground italic">—</span>}
                                      </button>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
                  <p className="text-muted-foreground">Nenhuma cotação neste evento. Use "Processar tudo" para criar cotações a partir das evidências.</p>
                </div>
              )}
            </TabsContent>

            {/* Comparação tab */}
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
