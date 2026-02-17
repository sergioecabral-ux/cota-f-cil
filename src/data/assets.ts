import { Asset } from "@/components/AssetCard";

export const mockAssets: Asset[] = [
  { ticker: "PETR4", name: "Petrobras PN", price: 38.72, change: 0.85, changePercent: 2.24, category: "Ação" },
  { ticker: "VALE3", name: "Vale ON", price: 62.15, change: -1.30, changePercent: -2.05, category: "Ação" },
  { ticker: "ITUB4", name: "Itaú Unibanco PN", price: 34.90, change: 0.42, changePercent: 1.22, category: "Ação" },
  { ticker: "BBDC4", name: "Bradesco PN", price: 15.48, change: -0.18, changePercent: -1.15, category: "Ação" },
  { ticker: "ABEV3", name: "Ambev ON", price: 13.25, change: 0.10, changePercent: 0.76, category: "Ação" },
  { ticker: "WEGE3", name: "WEG ON", price: 42.80, change: 1.15, changePercent: 2.76, category: "Ação" },
  { ticker: "BTC", name: "Bitcoin", price: 512340.00, change: 8520.00, changePercent: 1.69, category: "Cripto" },
  { ticker: "ETH", name: "Ethereum", price: 16850.00, change: -320.00, changePercent: -1.86, category: "Cripto" },
  { ticker: "SOL", name: "Solana", price: 890.50, change: 45.20, changePercent: 5.35, category: "Cripto" },
  { ticker: "HASH11", name: "Hashdex Nasdaq Crypto", price: 48.30, change: 0.95, changePercent: 2.01, category: "FII" },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária", price: 138.50, change: -0.80, changePercent: -0.57, category: "FII" },
  { ticker: "HGLG11", name: "CSHG Logística", price: 162.40, change: 1.20, changePercent: 0.74, category: "FII" },
  { ticker: "XPML11", name: "XP Malls", price: 104.80, change: 0.30, changePercent: 0.29, category: "FII" },
  { ticker: "USD/BRL", name: "Dólar Americano", price: 5.12, change: -0.03, changePercent: -0.58, category: "Câmbio" },
  { ticker: "EUR/BRL", name: "Euro", price: 5.58, change: 0.02, changePercent: 0.36, category: "Câmbio" },
  { ticker: "IFIX", name: "Índice de FIIs", price: 3245.80, change: 12.40, changePercent: 0.38, category: "Índice" },
];
