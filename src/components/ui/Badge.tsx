import { type ReactNode } from "react";

type BadgeVariant = 
  | "default" 
  | "primary" 
  | "success" 
  | "warning" 
  | "error" 
  | "info"
  | "backlog"
  | "todo"
  | "in-progress"
  | "review"
  | "done"
  | "low"
  | "medium"
  | "high"
  | "critical";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  primary: "bg-indigo-50 text-indigo-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
  info: "bg-cyan-50 text-cyan-700",
  backlog: "bg-slate-100 text-slate-600",
  todo: "bg-blue-50 text-blue-700",
  "in-progress": "bg-amber-50 text-amber-700",
  review: "bg-purple-50 text-purple-700",
  done: "bg-emerald-50 text-emerald-700",
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-50 text-blue-600",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-slate-400",
  primary: "bg-indigo-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-cyan-500",
  backlog: "bg-slate-400",
  todo: "bg-blue-500",
  "in-progress": "bg-amber-500",
  review: "bg-purple-500",
  done: "bg-emerald-500",
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export function Badge({ variant = "default", size = "sm", dot = false, className = "", children }: BadgeProps) {
  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${variantStyles[variant]} ${sizes[size]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
