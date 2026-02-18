import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, MoreHorizontal, Pencil, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type EventRow = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  created_at: string;
  pendencias: number;
};

type FormData = {
  title: string;
  status: string;
  priority: string;
};

const STATUSES = ["open", "closed"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-highlight/15 text-highlight-foreground",
  high: "bg-destructive/15 text-destructive",
};

const statusLabel: Record<string, string> = {
  open: "Aberto",
  closed: "Fechado",
};

const priorityLabel: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const Eventos = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [form, setForm] = useState<FormData>({ title: "", status: "open", priority: "medium" });

  // Fetch events + pendencias count
  const { data: events, isLoading } = useQuery({
    queryKey: ["events-list", filterStatus, filterPriority],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("id, title, status, priority, created_at")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterPriority !== "all") query = query.eq("priority", filterPriority);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch critical pendencias counts
      const eventIds = data.map((e) => e.id);
      let pendenciasMap: Record<string, number> = {};

      if (eventIds.length > 0) {
        const { data: rqData, error: rqError } = await supabase
          .from("review_queue")
          .select("event_id")
          .in("event_id", eventIds)
          .is("resolved_at", null)
          .eq("severity", "critical");

        if (!rqError && rqData) {
          rqData.forEach((r) => {
            pendenciasMap[r.event_id] = (pendenciasMap[r.event_id] || 0) + 1;
          });
        }
      }

      return data.map((e) => ({
        ...e,
        pendencias: pendenciasMap[e.id] || 0,
      })) as EventRow[];
    },
  });

  const getUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  };

  // Create event
  const createMutation = useMutation({
    mutationFn: async (f: FormData) => {
      const userId = await getUserId();
      if (!userId) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("events")
        .insert({ user_id: userId, title: f.title, status: f.status, priority: f.priority })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events-list"] });
      setModalOpen(false);
      resetForm();
      navigate(`/eventos/${data.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar evento", description: err.message, variant: "destructive" });
    },
  });

  // Update event
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...f }: FormData & { id: string }) => {
      const { error } = await supabase
        .from("events")
        .update({ title: f.title, status: f.status, priority: f.priority })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events-list"] });
      setEditingEvent(null);
      setModalOpen(false);
      resetForm();
      toast({ title: "Evento atualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  // Close event
  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events-list"] });
      toast({ title: "Evento fechado" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => setForm({ title: "", status: "open", priority: "medium" });

  const openCreate = () => {
    setEditingEvent(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (ev: EventRow) => {
    setEditingEvent(ev);
    setForm({ title: ev.title, status: ev.status, priority: ev.priority || "medium" });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Topbar title="Eventos" />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo evento
            </Button>
          </div>

          {/* Table */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : events && events.length > 0 ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Críticas</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow
                      key={ev.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/eventos/${ev.id}`)}
                    >
                      <TableCell className="font-medium">{ev.title}</TableCell>
                      <TableCell>
                        <Badge variant={ev.status === "open" ? "default" : "secondary"}>
                          {statusLabel[ev.status] || ev.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ev.priority && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${priorityColor[ev.priority] || ""}`}>
                            {priorityLabel[ev.priority] || ev.priority}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {ev.pendencias > 0 ? (
                          <span className="flex items-center gap-1 text-destructive text-sm font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {ev.pendencias}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => openEdit(ev)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            {ev.status !== "closed" && (
                              <DropdownMenuItem onClick={() => closeMutation.mutate(ev.id)}>
                                <XCircle className="h-4 w-4 mr-2" /> Fechar
                              </DropdownMenuItem>
                            )}
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
              <p className="text-muted-foreground">Nenhum evento encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ev-title">Título *</Label>
              <Input
                id="ev-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{priorityLabel[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending || !form.title.trim()}>
                {isPending ? "Salvando..." : editingEvent ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Eventos;
