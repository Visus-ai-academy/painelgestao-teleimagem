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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Volume Total</span>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {stats.total_exames.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total de exames processados
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Registros</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {stats.total_registros.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total de registros na base
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Clientes</span>
            <Users className="h-4 w-4 text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.total_clientes}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Clientes únicos ativos
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
          <div className="text-2xl font-bold text-red-600">
            {stats.percentual_atraso.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.total_atrasados.toLocaleString()} registros atrasados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}