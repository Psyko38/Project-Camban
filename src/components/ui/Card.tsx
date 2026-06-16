import { type ReactNode, type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "bordered";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  children: ReactNode;
}

export function Card({ 
  variant = "default", 
  padding = "md", 
  hover = false,
  children, 
  className = "",
  ...props 
}: CardProps) {
  const baseStyles = "rounded-2xl transition-all duration-200";
  
  const variants = {
    default: "bg-white border border-slate-200/60 shadow-sm",
    elevated: "bg-white shadow-md shadow-slate-200/50",
    bordered: "bg-white border-2 border-slate-200",
  };

  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-4 md:p-5",
    lg: "p-5 md:p-6",
  };

  const hoverStyles = hover ? "hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300/60" : "";

  return (
    <div 
      className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-slate-900 truncate">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
