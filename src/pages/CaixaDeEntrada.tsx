import Topbar from "@/components/Topbar";
import { Inbox, Clock, CheckCircle2, AlertCircle } from "lucide-react";

const mockItems = [
  { id: 1, title: "Nota fiscal #4521 pendente de revisão", from: "Fornecedor ABC", time: "Há 2 horas", status: "pending" as const },
  { id: 2, title: "Evidência de entrega aprovada", from: "Transportadora XYZ", time: "Há 4 horas", status: "done" as const },
  { id: 3, title: "Novo evento de auditoria criado", from: "Sistema", time: "Há 5 horas", status: "info" as const },
  { id: 4, title: "Produto #892 com divergência de lote", from: "Qualidade", time: "Ontem", status: "alert" as const },
  { id: 5, title: "Relatório mensal disponível", from: "Sistema", time: "Ontem", status: "info" as const },
  { id: 6, title: "Nota fiscal #4518 aprovada", from: "Fornecedor DEF", time: "2 dias atrás", status: "done" as const },
];

const statusConfig = {
  pending: { icon: Clock, color: "text-highlight", bg: "bg-highlight/10" },
  done: { icon: CheckCircle2, color: "text-positive", bg: "bg-positive/10" },
  alert: { icon: AlertCircle, color: "text-negative", bg: "bg-negative/10" },
  info: { icon: Inbox, color: "text-accent", bg: "bg-accent/10" },
};

const CaixaDeEntrada = () => {
  return (
    <>
      <Topbar title="Caixa de Entrada" />
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Pendentes", value: 12, color: "text-highlight" },
              { label: "Resolvidos hoje", value: 5, color: "text-positive" },
              { label: "Alertas", value: 2, color: "text-negative" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card rounded-xl border border-border p-5 shadow-card">
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Itens Recentes</h2>
            </div>
            <ul className="divide-y divide-border">
              {mockItems.map((item) => {
                const cfg = statusConfig[item.status];
                const Icon = cfg.icon;
                return (
                  <li key={item.id} className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/50 transition-colors cursor-pointer">
                    <div className={`h-10 w-10 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.from}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default CaixaDeEntrada;
