import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart3, Activity, Users, Clock } from "lucide-react";

interface DashboardStats {
  total_exames: number;
  total_registros: number;
  total_atrasados: number;
  percentual_atraso: number;
  total_clientes: number;
}

interface VolumetriaStatsProps {
  stats: DashboardStats;
}

export function VolumetriaStats({ stats }: VolumetriaStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Volume Total</span>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {stats.total_exames.toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Total de Laudos Processados
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Clientes Ativos</span>
            <Users className="h-4 w-4 text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {stats.total_clientes}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Clientes únicos no período
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Atrasos</span>
            <Clock className="h-4 w-4 text-red-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {stats.percentual_atraso.toFixed(1)}%
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total_atrasados.toLocaleString()} laudos atrasados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}