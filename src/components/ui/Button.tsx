import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, children, className = "", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
      primary: "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm hover:shadow-md hover:from-indigo-700 hover:to-indigo-800",
      secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
      ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      danger: "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
      md: "px-4 py-2.5 text-sm rounded-xl gap-2",
      lg: "px-6 py-3 text-base rounded-xl gap-2.5",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
