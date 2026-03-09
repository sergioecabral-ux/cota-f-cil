import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Topbar from "@/components/Topbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const Produtos = () => {
  const { data: products, isLoading } = useQuery({
    queryKey: ["products_canonical"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products_canonical")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <Topbar title="Produtos" />
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : !products?.length ? (
            <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
              <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade Padrão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name_canonical}</TableCell>
                      <TableCell className="text-muted-foreground">{p.unit_standard || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.status_review ? "outline" : "default"}>
                          {p.status_review ? "Pendente revisão" : "Revisado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Produtos;
