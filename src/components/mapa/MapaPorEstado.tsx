import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ClienteVolumetria {
  id: string;
  nome: string;
  cidade?: string;
  estado?: string;
  volume_exames: number;
}

interface EstadoEstatistica {
  estado: string;
  regiao: string;
  total_clientes: number;
  volume_total: number;
  cidades: { [cidade: string]: ClienteVolumetria[] };
}

function getCorIntensidade(volume: number, maxVolume: number): string {
  if (volume === 0) return 'bg-gray-200 text-gray-600';
  const intensidade = (volume / maxVolume) * 100;
  if (intensidade < 20) return 'bg-red-400 text-white';
  if (intensidade < 40) return 'bg-red-500 text-white';
  if (intensidade < 60) return 'bg-red-600 text-white';
  if (intensidade < 80) return 'bg-red-700 text-white';
  return 'bg-red-800 text-white';
}

interface MapaPorEstadoProps {
  estados: EstadoEstatistica[];
}

export function MapaPorEstado({ estados }: MapaPorEstadoProps) {
  const total = estados.reduce((sum, e) => sum + e.volume_total, 0);
  const maxVolume = Math.max(1, ...estados.map(e => e.volume_total));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Mapa de Calor - Distribuição por Estado-UF
          <Badge variant="outline" className="text-sm">
            Total: {total.toLocaleString()} exames
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-sm text-muted-foreground">
          Estados ordenados por volume de exames (maior para menor)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {estados
            .sort((a, b) => b.volume_total - a.volume_total)
            .map((estado, index) => {
              const corClasse = getCorIntensidade(estado.volume_total, maxVolume);
              return (
                <div key={estado.estado} className={`p-3 rounded-lg ${corClasse} transition-all hover:scale-105 cursor-pointer relative`}>
                  <div className="text-center">
                    <div className="absolute top-1 right-1">
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        #{index + 1}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-base">{estado.estado}</h3>
                    <p className="text-xs opacity-80 mb-2">{estado.regiao}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{estado.total_clientes} clientes</p>
                      <p className="text-xs font-medium">{estado.volume_total.toLocaleString()} exames</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {Object.keys(estado.cidades).length} cidades
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
