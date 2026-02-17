import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, User } from "lucide-react";

interface TopbarProps {
  title: string;
}

const Topbar = ({ title }: TopbarProps) => {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="lg:hidden" />
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
        </button>
        <button className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center text-accent">
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
