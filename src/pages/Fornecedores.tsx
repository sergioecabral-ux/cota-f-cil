import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Phone, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

const Fornecedores = () => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDeleteId(null);
      toast({ title: "Fornecedor excluído" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Topbar title="Fornecedores" />
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : !suppliers?.length ? (
            <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
              <p className="text-muted-foreground">Nenhum fornecedor cadastrado ainda.</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Nome Canônico</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name_raw}</TableCell>
                      <TableCell className="text-muted-foreground">{s.name_canonical || "—"}</TableCell>
                      <TableCell>
                        {s.phone ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" /> {s.phone}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status_review ? "outline" : "default"}>
                          {s.status_review ? "Pendente revisão" : "Revisado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
        description="O fornecedor será removido permanentemente. Esta ação não pode ser desfeita."
      />
    </>
  );
};

export default Fornecedores;
