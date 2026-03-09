import { Inbox, Calendar, Upload, Users, Package, FileBarChart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Caixa de Entrada", url: "/", icon: Inbox },
  { title: "Eventos", url: "/eventos", icon: Calendar },
  { title: "Importar Evidências", url: "/importar-evidencias", icon: Upload },
  { title: "Fornecedores", url: "/fornecedores", icon: Users },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-border">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <span className="text-lg font-bold tracking-tight text-foreground">
          Cota<span className="text-primary">Fácil</span>
        </span>
      </div>
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
