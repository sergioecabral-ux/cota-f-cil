import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface CategoryChipProps {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}

const CategoryChip = ({ label, icon: Icon, active, onClick }: CategoryChipProps) => {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border ${
        active
          ? "gradient-accent text-accent-foreground border-transparent shadow-md"
          : "bg-card text-muted-foreground border-border hover:border-accent/40 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </motion.button>
  );
};

export default CategoryChip;
