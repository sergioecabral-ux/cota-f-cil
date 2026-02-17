import Topbar from "@/components/Topbar";

const Relatorios = () => (
  <>
    <Topbar title="Relatórios" />
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
          <p className="text-muted-foreground">Nenhum relatório disponível ainda.</p>
        </div>
      </div>
    </div>
  </>
);

export default Relatorios;
