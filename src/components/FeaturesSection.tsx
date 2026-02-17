import { BarChart3, TrendingUp, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: BarChart3,
    title: "Cotações em Tempo Real",
    description: "Acompanhe os preços dos ativos atualizados em tempo real.",
  },
  {
    icon: TrendingUp,
    title: "Análise de Tendências",
    description: "Visualize tendências de mercado com gráficos intuitivos.",
  },
  {
    icon: Shield,
    title: "Dados Confiáveis",
    description: "Informações verificadas de fontes oficiais do mercado.",
  },
  {
    icon: Zap,
    title: "Rápido e Simples",
    description: "Interface intuitiva para encontrar qualquer ativo em segundos.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-bold text-foreground mb-3">
            Tudo que você precisa para acompanhar o mercado
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Ferramentas simples e poderosas para investidores de todos os níveis.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-card rounded-xl border border-border p-6 shadow-card text-center hover:shadow-card-hover transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-4">
                <feature.icon className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
