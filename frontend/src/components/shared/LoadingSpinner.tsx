import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-10 h-10 border-2",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-slate-600 border-t-cyan-400 animate-spin ${className}`}
    />
  );
};
