
import { Circle } from "lucide-react";

interface StatusIndicatorProps {
  status: "good" | "warning" | "critical";
  label: string;
  value?: string;
  description?: string;
}

export function StatusIndicator({ status, label, value, description }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case "good": return "text-green-500";
      case "warning": return "text-yellow-500";
      case "critical": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusBg = () => {
    switch (status) {
      case "good": return "bg-green-50";
      case "warning": return "bg-yellow-50";
      case "critical": return "bg-red-50";
      default: return "bg-gray-50";
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getStatusBg()}`}>
      <div className="flex items-center gap-3">
        <Circle className={`h-6 w-6 ${getStatusColor()} fill-current`} />
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
