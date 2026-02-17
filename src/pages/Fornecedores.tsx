import Topbar from "@/components/Topbar";

const Fornecedores = () => (
  <>
    <Topbar title="Fornecedores" />
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
          <p className="text-muted-foreground">Nenhum fornecedor cadastrado ainda.</p>
        </div>
      </div>
    </div>
  </>
);

export default Fornecedores;
