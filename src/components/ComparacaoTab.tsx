import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Award, ChevronDown, ChevronUp, Download, PackageOpen } from "lucide-react";
import { useState } from "react";

interface ComparacaoTabProps {
  eventId: string;
}

interface QuoteRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  shipping_cost: number | null;
  shipping_terms: string | null;
  lead_time_days: number | null;
  minimum_order_value: number | null;
  minimum_order_qty: number | null;
}

interface ItemRow {
  id: string;
  quote_id: string;
  description_supplier: string | null;
  qty: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
}

interface Offer {
  quoteId: string;
  supplierName: string;
  qty: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  effectiveUnitPrice: number | null;
}

interface Group {
  key: string;
  originalDesc: string;
  offers: Offer[];
  winner: Offer | null;
  winnerAlerts: string[];
}

function normalizeDesc(desc: string): string {
  return desc
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?'"()\-\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ComparacaoTab({ eventId }: ComparacaoTabProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Fetch quotes with supplier info
  const { data: quotes = [] } = useQuery<QuoteRow[]>({
    queryKey: ["comparacao-quotes", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, supplier_id, shipping_cost, shipping_terms, lead_time_days, minimum_order_value, minimum_order_qty")
        .eq("event_id", eventId);
      if (error) throw error;
      if (!data?.length) return [];

      const sIds = [...new Set(data.map(q => q.supplier_id))];
      const { data: suppliers } = await supabase.from("suppliers").select("id, name_raw, name_canonical").in("id", sIds);
      const sMap: Record<string, string> = {};
      suppliers?.forEach(s => { sMap[s.id] = s.name_canonical || s.name_raw; });

      return data.map(q => ({ ...q, supplier_name: sMap[q.supplier_id] || "Desconhecido" }));
    },
  });

  const quoteIds = quotes.map(q => q.id);
  const quoteMap = useMemo(() => {
    const m: Record<string, QuoteRow> = {};
    quotes.forEach(q => { m[q.id] = q; });
    return m;
  }, [quotes]);

  // Fetch all items
  const { data: items = [] } = useQuery<ItemRow[]>({
    queryKey: ["comparacao-items", eventId],
    queryFn: async () => {
      if (quoteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("quote_items")
        .select("id, quote_id, description_supplier, qty, unit, unit_price, total_price")
        .in("quote_id", quoteIds);
      if (error) throw error;
      return data || [];
    },
    enabled: quoteIds.length > 0,
  });

  // Build groups
  const groups: Group[] = useMemo(() => {
    if (items.length === 0) return [];

    const groupMap = new Map<string, { originalDesc: string; offers: Offer[] }>();

    for (const item of items) {
      if (!item.description_supplier) continue;
      const key = normalizeDesc(item.description_supplier);
      if (!key) continue;

      const quote = quoteMap[item.quote_id];
      if (!quote) continue;

      const effectiveUnitPrice =
        item.unit_price != null
          ? item.unit_price
          : item.total_price != null && item.qty != null && item.qty > 0
            ? item.total_price / item.qty
            : null;

      const offer: Offer = {
        quoteId: item.quote_id,
        supplierName: quote.supplier_name,
        qty: item.qty,
        unit: item.unit,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        effectiveUnitPrice,
      };

      if (!groupMap.has(key)) {
        groupMap.set(key, { originalDesc: item.description_supplier, offers: [] });
      }
      groupMap.get(key)!.offers.push(offer);
    }

    const result: Group[] = [];
    for (const [key, { originalDesc, offers }] of groupMap) {
      // Find winner (lowest effective unit price)
      const validOffers = offers.filter(o => o.effectiveUnitPrice != null);
      const winner = validOffers.length > 0
        ? validOffers.reduce((best, o) => o.effectiveUnitPrice! < best.effectiveUnitPrice! ? o : best)
        : null;

      // Check alerts on winner's quote
      const winnerAlerts: string[] = [];
      if (winner) {
        const q = quoteMap[winner.quoteId];
        if (q) {
          if (q.shipping_cost == null && q.shipping_terms == null) winnerAlerts.push("Frete não informado");
          if (q.lead_time_days == null) winnerAlerts.push("Prazo não informado");
          if (q.minimum_order_value == null && q.minimum_order_qty == null) winnerAlerts.push("Pedido mínimo não informado");
        }
      }

      result.push({ key, originalDesc, offers, winner, winnerAlerts });
    }

    return result.sort((a, b) => a.originalDesc.localeCompare(b.originalDesc));
  }, [items, quoteMap]);

  // Totals
  const totalRecomendado = useMemo(() => {
    return groups.reduce((sum, g) => {
      if (!g.winner) return sum;
      const val = g.winner.totalPrice ?? (g.winner.qty != null && g.winner.effectiveUnitPrice != null ? g.winner.qty * g.winner.effectiveUnitPrice : 0);
      return sum + (val || 0);
    }, 0);
  }, [groups]);

  const totalPorFornecedor = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of groups) {
      if (!g.winner) continue;
      const val = g.winner.totalPrice ?? (g.winner.qty != null && g.winner.effectiveUnitPrice != null ? g.winner.qty * g.winner.effectiveUnitPrice : 0);
      map[g.winner.supplierName] = (map[g.winner.supplierName] || 0) + (val || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [groups]);

  // CSV export
  const exportCsv = () => {
    const header = "Produto;Melhor Fornecedor;Preço Unitário;Total;Alertas\n";
    const rows = groups.map(g => {
      const sup = g.winner?.supplierName || "—";
      const up = g.winner?.effectiveUnitPrice != null ? fmt(g.winner.effectiveUnitPrice) : "—";
      const tp = g.winner ? fmt(g.winner.totalPrice ?? (g.winner.qty != null && g.winner.effectiveUnitPrice != null ? g.winner.qty * g.winner.effectiveUnitPrice : null)) : "—";
      const alerts = g.winnerAlerts.join(", ") || "—";
      return `"${g.originalDesc}";"${sup}";${up};${tp};"${alerts}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparacao-${eventId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
        <PackageOpen className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Cadastre itens na aba Revisão para comparar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-card rounded-xl border border-border shadow-card px-5 py-3">
          <p className="text-xs text-muted-foreground">Total recomendado</p>
          <p className="text-xl font-bold text-foreground">R$ {fmt(totalRecomendado)}</p>
        </div>
        {totalPorFornecedor.map(([name, total]) => (
          <div key={name} className="bg-card rounded-xl border border-border shadow-card px-5 py-3">
            <p className="text-xs text-muted-foreground">{name}</p>
            <p className="text-sm font-semibold text-foreground">R$ {fmt(total)}</p>
          </div>
        ))}
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {/* Comparison table */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Produto</TableHead>
              <TableHead>Melhor fornecedor</TableHead>
              <TableHead className="text-right">Preço unit.</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Alertas</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(g => {
              const isExpanded = expandedGroup === g.key;
              const winnerTotal = g.winner
                ? (g.winner.totalPrice ?? (g.winner.qty != null && g.winner.effectiveUnitPrice != null ? g.winner.qty * g.winner.effectiveUnitPrice : null))
                : null;
              const otherOffers = g.offers.filter(o => g.winner == null || o.quoteId !== g.winner.quoteId || o.effectiveUnitPrice !== g.winner.effectiveUnitPrice);

              return (
                <> 
                  <TableRow key={g.key} className="group">
                    <TableCell className="font-medium">{g.originalDesc}</TableCell>
                    <TableCell>
                      {g.winner ? (
                        <span className="flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-primary" />
                          {g.winner.supplierName}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.winner?.effectiveUnitPrice != null ? `R$ ${fmt(g.winner.effectiveUnitPrice)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {winnerTotal != null ? `R$ ${fmt(winnerTotal)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {g.winnerAlerts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {g.winnerAlerts.map(a => (
                            <Badge key={a} variant="outline" className="text-[10px] border-highlight/40 text-highlight-foreground bg-highlight/10">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{a}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {otherOffers.length > 0 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedGroup(isExpanded ? null : g.key)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && otherOffers.map((o, idx) => (
                    <TableRow key={`${g.key}-${idx}`} className="bg-muted/30">
                      <TableCell className="pl-8 text-muted-foreground text-sm">↳ outra oferta</TableCell>
                      <TableCell className="text-sm">{o.supplierName}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {o.effectiveUnitPrice != null ? `R$ ${fmt(o.effectiveUnitPrice)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {o.totalPrice != null ? `R$ ${fmt(o.totalPrice)}` : "—"}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
