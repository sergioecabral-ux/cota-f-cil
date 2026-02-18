import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const severityBadge: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-highlight/15 text-highlight border-highlight/30",
  normal: "bg-muted text-muted-foreground border-border",
};

const CaixaDeEntrada = () => {
  const navigate = useNavigate();

  // Fetch open critical review items with event titles
  const { data: criticalItems = [], isLoading } = useQuery({
    queryKey: ["inbox-criticals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_queue")
        .select("id, severity, reason, event_id, entity_type, entity_id, created_at")
        .is("resolved_at", null)
        .eq("severity", "critical")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch event titles
      const eventIds = [...new Set(data.map((r) => r.event_id))];
      const { data: events } = await supabase
        .from("events")
        .select("id, title")
        .in("id", eventIds);
      const eventMap: Record<string, string> = {};
      events?.forEach((e) => (eventMap[e.id] = e.title));

      return data.map((r) => ({
        ...r,
        event_title: eventMap[r.event_id] || "Evento desconhecido",
      }));
    },
  });

  // Counts
  const { data: totalCritical = 0 } = useQuery({
    queryKey: ["inbox-critical-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("review_queue")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null)
        .eq("severity", "critical");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalHigh = 0 } = useQuery({
    queryKey: ["inbox-high-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("review_queue")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null)
        .eq("severity", "high");
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <>
      <Topbar title="Caixa de Entrada" />
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-5 shadow-card">
              <p className="text-sm text-muted-foreground mb-1">Críticas abertas</p>
              <p className="text-3xl font-bold text-destructive">{totalCritical}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 shadow-card">
              <p className="text-sm text-muted-foreground mb-1">Altas abertas</p>
              <p className="text-3xl font-bold text-highlight">{totalHigh}</p>
            </div>
          </div>

          {/* Critical items list */}
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <h2 className="font-semibold text-foreground">Críticas abertas</h2>
            </div>
            {isLoading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : criticalItems.length > 0 ? (
              <ul className="divide-y divide-border">
                {criticalItems.map((item) => (
                  <li
                    key={item.id}
                    className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/events/${item.event_id}?criticas=1`)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.reason}</p>
                      <p className="text-xs text-muted-foreground">{item.event_title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                Nenhuma crítica aberta. Tudo certo! 🎉
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CaixaDeEntrada;
