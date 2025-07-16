
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface SpeedometerProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  colorThresholds?: {
    low: { threshold: number; color: string };
    medium: { threshold: number; color: string };
    high: { threshold: number; color: string };
  };
}

export function Speedometer({ 
  value, 
  max, 
  label, 
  unit = "%",
  colorThresholds = {
    low: { threshold: 30, color: "#ef4444" },
    medium: { threshold: 70, color: "#f59e0b" },
    high: { threshold: 100, color: "#10b981" }
  }
}: SpeedometerProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const getColor = () => {
    if (percentage <= colorThresholds.low.threshold) return colorThresholds.low.color;
    if (percentage <= colorThresholds.medium.threshold) return colorThresholds.medium.color;
    return colorThresholds.high.color;
  };

  const data = [
    { value: percentage, color: getColor() },
    { value: 100 - percentage, color: "#e5e7eb" }
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={40}
              outerRadius={60}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-2xl font-bold" style={{ color: getColor() }}>
            {value}{unit}
          </span>
          <span className="text-xs text-gray-500">de {max}{unit}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-center mt-2">{label}</span>
    </div>
  );
}
