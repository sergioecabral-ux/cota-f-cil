import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActorLabel, insertAuditLog } from "@/lib/auditLog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Check, Loader2, Plus, Trash2, ShieldAlert, Pencil, ArrowRight } from "lucide-react";

interface QuoteWithDetails {
  id: string;
  display_name: string | null;
  supplier_id: string;
  supplier_name: string;
  lead_time_days: number | null;
  shipping_terms: string | null;
  shipping_cost: number | null;
  minimum_order_value: number | null;
  minimum_order_qty: number | null;
  payment_terms: string | null;
  validity_days: number | null;
}

interface QuoteItem {
  id: string;
  quote_id: string;
  description_supplier: string | null;
  qty: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
}

const QUOTE_FIELDS = [
  { key: "lead_time_days", label: "Prazo (dias)", type: "number" },
  { key: "shipping_terms", label: "Frete (termos)", type: "text" },
  { key: "shipping_cost", label: "Frete (R$)", type: "number" },
  { key: "minimum_order_value", label: "Ped. mín. (R$)", type: "number" },
  { key: "minimum_order_qty", label: "Ped. mín. (qtd)", type: "number" },
  { key: "payment_terms", label: "Pagamento", type: "text" },
  { key: "validity_days", label: "Validade (dias)", type: "number" },
] as const;

type QuoteFieldKey = (typeof QUOTE_FIELDS)[number]["key"];

type ItemFieldKey =
  | "description_supplier"
  | "qty"
  | "unit"
  | "unit_price"
  | "total_price";

type EditingTarget =
  | { kind: "quote"; quoteId: string; field: QuoteFieldKey }
  | { kind: "item"; itemId: string; field: ItemFieldKey };

const REASON_MAP: Record<string, (q: Record<string, any>) => boolean> = {
  "Prazo de entrega ausente": (q) => q.lead_time_days != null,
  "Frete ausente": (q) => q.shipping_terms != null || q.shipping_cost != null,
  "Pedido mínimo ausente": (q) => q.minimum_order_value != null || q.minimum_order_qty != null,
};

interface RevisaoTabProps {
  eventId: string;
  criticalCount: number;
  highCount: number;
  onOpenCriticas: () => void;
}

export default function RevisaoTab({ eventId, criticalCount, highCount, onOpenCriticas }: RevisaoTabProps) {
  const queryClient = useQueryClient();
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");

  // Fetch quotes for this event
  const { data: quotes = [] } = useQuery({
    queryKey: ["revisao-quotes", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, display_name, supplier_id, lead_time_days, shipping_terms, shipping_cost, minimum_order_value, minimum_order_qty, payment_terms, validity_days")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [] as QuoteWithDetails[];

      const sIds = [...new Set(data.map(q => q.supplier_id))];
      const { data: suppliers } = await supabase.from("suppliers").select("id, name_raw, name_canonical").in("id", sIds);
      const sMap: Record<string, string> = {};
      suppliers?.forEach(s => { sMap[s.id] = s.name_canonical || s.name_raw; });

      return data.map(q => ({
        ...q,
        supplier_name: sMap[q.supplier_id] || "Desconhecido",
      })) as QuoteWithDetails[];
    },
  });

  // Fetch all quote_items for all quotes in this event
  const quoteIds = quotes.map(q => q.id);
  const { data: allItems = [] } = useQuery({
    queryKey: ["revisao-items", eventId],
    queryFn: async () => {
      if (quoteIds.length === 0) return [] as QuoteItem[];
      const { data, error } = await supabase
        .from("quote_items")
        .select("id, quote_id, description_supplier, qty, unit, unit_price, total_price")
        .in("quote_id", quoteIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as QuoteItem[];
    },
    enabled: quoteIds.length > 0,
  });

  const hasAnyItems = allItems.length > 0;

  // Save quote field
  const saveFieldMutation = useMutation({
    mutationFn: async ({ quoteId, field, value, oldValue }: { quoteId: string; field: string; value: any; oldValue: any }) => {
      const actor = await getActorLabel();

      const { error } = await supabase.from("quotes").update({ [field]: value }).eq("id", quoteId);
      if (error) throw error;

      await insertAuditLog({
        entityType: "quote",
        entityId: quoteId,
        fieldName: field,
        oldValue,
        newValue: value,
        sourceRef: { from: "revisao_tab" },
      });

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
              .update({ resolved_at: new Date().toISOString(), resolved_by: actor })
              .eq("entity_id", quoteId)
              .eq("entity_type", "quote")
              .eq("reason", reason)
              .is("resolved_at", null);
          }
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      setEditingTarget(null);
      toast({ title: "Salvo" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Save display_name
  const saveNameMutation = useMutation({
    mutationFn: async ({ quoteId, value }: { quoteId: string; value: string }) => {
      const { error } = await supabase.from("quotes").update({ display_name: value || null }).eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revisao-quotes", eventId] });
      setEditingName(null);
      toast({ title: "Nome atualizado" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Add quote item
  const addItemMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("quote_items").insert({
        quote_id: quoteId, user_id: user.id, description_supplier: "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revisao-items", eventId] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Update quote item
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, field, value }: { itemId: string; field: string; value: any }) => {
      const updateData: Record<string, any> = { [field]: value };

      // Auto-calc total_price
      if (field === "qty" || field === "unit_price") {
        const item = allItems.find(i => i.id === itemId);
        if (item) {
          const qty = field === "qty" ? value : item.qty;
          const unitPrice = field === "unit_price" ? value : item.unit_price;
          if (qty != null && unitPrice != null) {
            updateData.total_price = qty * unitPrice;
          }
        }
      }

      const { error } = await supabase.from("quote_items").update(updateData).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revisao-items", eventId] });
      setEditingTarget(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // Delete quote item
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("quote_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revisao-items", eventId] });
      toast({ title: "Item removido" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["revisao-quotes", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-critical-count", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-high-count", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-review-items", eventId] });
  }, [queryClient, eventId]);

  const startEditQuote = (quoteId: string, field: QuoteFieldKey, value: unknown) => {
    setEditingTarget({ kind: "quote", quoteId, field });
    setEditValue(value != null ? String(value) : "");
  };

  const startEditItem = (itemId: string, field: ItemFieldKey, value: unknown) => {
    setEditingTarget({ kind: "item", itemId, field });
    setEditValue(value != null ? String(value) : "");
  };

  const commitQuoteField = (quote: QuoteWithDetails) => {
    if (!editingTarget || editingTarget.kind !== "quote") return;
    const fieldDef = QUOTE_FIELDS.find(f => f.key === editingTarget.field);
    if (!fieldDef) return;
    const oldValue = quote[editingTarget.field];
    let newValue: any = editValue.trim() === "" ? null : editValue.trim();
    if (fieldDef.type === "number" && newValue != null) {
      newValue = Number(newValue);
      if (isNaN(newValue)) newValue = null;
    }
    saveFieldMutation.mutate({ quoteId: quote.id, field: editingTarget.field, value: newValue, oldValue });
  };

  const commitItemField = (item: QuoteItem, field: string, type: string) => {
    let newValue: any = editValue.trim() === "" ? null : editValue.trim();
    if (type === "number" && newValue != null) {
      newValue = Number(newValue);
      if (isNaN(newValue)) newValue = null;
    }
    updateItemMutation.mutate({ itemId: item.id, field, value: newValue });
  };

  const ITEM_COLUMNS = [
    { key: "description_supplier", label: "Descrição", type: "text", width: "min-w-[180px]" },
    { key: "qty", label: "Qtd", type: "number", width: "w-20" },
    { key: "unit", label: "Unid.", type: "text", width: "w-20" },
    { key: "unit_price", label: "Preço unit.", type: "number", width: "w-28" },
    { key: "total_price", label: "Total", type: "number", width: "w-28" },
  ];

  return (
    <div className="space-y-6">
      {/* Pendências card */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-destructive">Críticas: {criticalCount}</span>
              <span className="font-medium text-highlight">Altas: {highCount}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenCriticas}>Ver todas</Button>
        </div>
      )}

      {/* Comparison button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={!hasAnyItems}
          onClick={() => {/* TODO: navigate to comparação */}}
          className="gap-2"
        >
          Ir para Comparação <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {quotes.length > 0 ? (
        quotes.map(quote => {
          const items = allItems.filter(i => i.quote_id === quote.id);
          const itemsTotal = items.reduce((sum, i) => sum + (i.total_price || 0), 0);

          return (
            <div key={quote.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Quote card header */}
              <div className="bg-muted/50 px-4 py-3 border-b border-border space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {editingName === quote.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          value={nameValue}
                          onChange={e => setNameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveNameMutation.mutate({ quoteId: quote.id, value: nameValue });
                            if (e.key === "Escape") setEditingName(null);
                          }}
                          className="h-7 text-sm flex-1"
                          autoFocus
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveNameMutation.mutate({ quoteId: quote.id, value: nameValue })} disabled={saveNameMutation.isPending}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                        onClick={() => { setEditingName(quote.id); setNameValue(quote.display_name || ""); }}
                      >
                        {quote.display_name || <span className="italic text-muted-foreground">Sem nome</span>}
                        <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                      </button>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{quote.supplier_name}</Badge>
                </div>

                {/* Quote metadata fields */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {QUOTE_FIELDS.map(f => {
                    const isEditing = editingTarget?.kind === "quote" && editingTarget.quoteId === quote.id && editingTarget.field === f.key;
                    const val = quote[f.key as QuoteFieldKey];
                    return (
                      <div key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">{f.label}:</span>
                        {isEditing ? (
                          <div className="flex items-center gap-0.5">
                            <Input
                              type={f.type}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") commitQuoteField(quote); if (e.key === "Escape") setEditingTarget(null); }}
                              className="h-6 text-xs w-20"
                              autoFocus
                            />
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => commitQuoteField(quote)} disabled={saveFieldMutation.isPending}>
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button className="font-medium hover:text-primary transition-colors" onClick={() => startEditQuote(quote.id, f.key, val)}>
                            {val != null ? String(val) : <span className="text-muted-foreground italic">—</span>}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Total dos itens: <span className="font-semibold text-foreground">R$ {itemsTotal.toFixed(2)}</span></span>
                </div>
              </div>

              {/* Quote items grid */}
              <div className="p-3">
                {items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {ITEM_COLUMNS.map(col => (
                            <TableHead key={col.key} className={`text-xs whitespace-nowrap ${col.width}`}>{col.label}</TableHead>
                          ))}
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map(item => (
                          <TableRow key={item.id}>
                            {ITEM_COLUMNS.map(col => {
                              const cellId = `${item.id}:${col.key}`;
                              const isEditing = editingTarget?.kind === "item" && editingTarget.itemId === item.id && editingTarget.field === col.key;
                              const val = item[col.key as keyof QuoteItem];
                              const isComputedTotal = col.key === "total_price" && item.qty != null && item.unit_price != null;

                              return (
                                <TableCell key={col.key} className={`py-1 px-2 ${col.width}`}>
                                  {isEditing ? (
                                    <div className="flex items-center gap-0.5">
                                      <Input
                                        type={col.type}
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === "Enter") commitItemField(item, col.key, col.type);
                                          if (e.key === "Escape") setEditingTarget(null);
                                        }}
                                        className="h-7 text-xs"
                                        autoFocus
                                      />
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => commitItemField(item, col.key, col.type)} disabled={updateItemMutation.isPending}>
                                        <Check className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      className={`text-xs text-left w-full px-1 py-0.5 rounded hover:bg-muted/50 transition-colors ${isComputedTotal ? "text-muted-foreground" : ""}`}
                                      onClick={() => startEditItem(item.id, col.key as ItemFieldKey, val)}
                                      title={isComputedTotal ? "Calculado automaticamente (qty × preço unit.)" : undefined}
                                    >
                                      {val != null ? (col.type === "number" ? Number(val).toFixed(col.key.includes("price") ? 2 : 0) : String(val)) : <span className="text-muted-foreground italic">—</span>}
                                    </button>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="py-1 px-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => deleteItemMutation.mutate(item.id)} disabled={deleteItemMutation.isPending}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Nenhum item cadastrado nesta cotação.
                  </div>
                )}
                <div className="mt-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => addItemMutation.mutate(quote.id)} disabled={addItemMutation.isPending}>
                    {addItemMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {items.length === 0 ? "Adicionar primeiro item" : "Adicionar item"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
          <p className="text-muted-foreground">Nenhuma cotação neste evento. Use "Processar tudo" para criar cotações a partir das evidências.</p>
        </div>
      )}
    </div>
  );
}
