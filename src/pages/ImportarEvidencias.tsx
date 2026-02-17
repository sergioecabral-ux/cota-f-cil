import Topbar from "@/components/Topbar";

const ImportarEvidencias = () => (
  <>
    <Topbar title="Importar Evidências" />
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-xl border-2 border-dashed border-border shadow-card p-16 text-center">
          <p className="text-muted-foreground mb-2">Arraste arquivos aqui ou clique para importar</p>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG, XML — máx. 25MB</p>
        </div>
      </div>
    </div>
  </>
);

export default ImportarEvidencias;
