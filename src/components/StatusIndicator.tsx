
import { Circle, CheckCircle, AlertTriangle, Clock, X } from "lucide-react";

interface StatusIndicatorProps {
  status: "good" | "warning" | "critical" | "pendente" | "processando" | "concluido" | "erro";
  label: string;
  value?: string;
  description?: string;
  showIcon?: boolean;
}

export function StatusIndicator({ 
  status, 
  label, 
  value, 
  description, 
  showIcon = true 
}: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "concluido":
      case "good":
        return {
          color: "text-green-500",
          bg: "bg-green-50 border-green-200",
          icon: CheckCircle
        };
      case "processando":
        return {
          color: "text-blue-500",
          bg: "bg-blue-50 border-blue-200",
          icon: Clock
        };
      case "erro":
      case "critical":
        return {
          color: "text-red-500",
          bg: "bg-red-50 border-red-200",
          icon: X
        };
      case "pendente":
      case "warning":
      default:
        return {
          color: "text-yellow-500",
          bg: "bg-yellow-50 border-yellow-200",
          icon: AlertTriangle
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.bg}`}>
      <div className="flex items-center gap-3">
        {showIcon && (
          <IconComponent className={`h-6 w-6 ${config.color} ${status === "processando" ? "animate-pulse" : ""}`} />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">{label}</span>
            {value && <span className="text-lg font-bold text-gray-900">{value}</span>}
          </div>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
