import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AuthGuard from "./components/AuthGuard";
import Auth from "./pages/Auth";
import CaixaDeEntrada from "./pages/CaixaDeEntrada";
import Eventos from "./pages/Eventos";
import ImportarEvidencias from "./pages/ImportarEvidencias";
import Fornecedores from "./pages/Fornecedores";
import Produtos from "./pages/Produtos";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route path="/" element={<CaixaDeEntrada />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/importar-evidencias" element={<ImportarEvidencias />} />
            <Route path="/fornecedores" element={<Fornecedores />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/relatorios" element={<Relatorios />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
