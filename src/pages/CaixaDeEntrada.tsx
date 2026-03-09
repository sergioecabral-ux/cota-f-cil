import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

const severityBadge: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-highlight/15 text-highlight border-highlight/30",
  normal: "bg-muted text-muted-foreground border-border",
};

const CaixaDeEntrada = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("review_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-criticals"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-critical-count"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-high-count"] });
      setDeleteId(null);
      toast({ title: "Item excluído" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Topbar title="Caixa de Entrada" />
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
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
                    className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div
                      className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 cursor-pointer"
                      onClick={() => navigate(`/events/${item.event_id}?criticas=1`)}
                    >
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/events/${item.event_id}?criticas=1`)}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{item.reason}</p>
                      <p className="text-xs text-muted-foreground">{item.event_title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
        description="O item será removido da fila de revisão. Esta ação não pode ser desfeita."
      />
    </>
  );
};

export default CaixaDeEntrada;
