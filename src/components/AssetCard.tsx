import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

export interface Asset {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  category: string;
}

interface AssetCardProps {
  asset: Asset;
  index: number;
}

const AssetCard = ({ asset, index }: AssetCardProps) => {
  const isPositive = asset.change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-foreground text-lg leading-tight">{asset.ticker}</h3>
          <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[140px]">{asset.name}</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
          {asset.category}
        </span>
      </div>
      <div className="flex items-end justify-between mt-4">
        <span className="text-2xl font-bold text-foreground">
          R$ {asset.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
        <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? "text-positive" : "text-negative"}`}>
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{isPositive ? "+" : ""}{asset.changePercent.toFixed(2)}%</span>
        </div>
      </div>
    </motion.div>
  );
};

export default AssetCard;
