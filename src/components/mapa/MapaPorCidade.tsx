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

interface MapaPorCidadeProps {
  estados: EstadoEstatistica[];
}

export function MapaPorCidade({ estados }: MapaPorCidadeProps) {
  const total = estados.reduce((sum, e) => sum + e.volume_total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Mapa de Calor - Distribuição por Cidade
          <Badge variant="outline" className="text-sm">
            Total: {total.toLocaleString()} exames
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-sm text-muted-foreground">
          Cidades agrupadas por estado, ordenadas por volume de exames
        </div>
        <div className="space-y-6">
          {estados
            .filter(estado => estado.total_clientes > 0)
            .sort((a, b) => b.volume_total - a.volume_total)
            .map((estado) => (
              <div key={estado.estado} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-blue-600">
                    {estado.estado} - {estado.regiao}
                  </h3>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-600">
                      {estado.total_clientes} clientes | {estado.volume_total.toLocaleString()} exames
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(estado.cidades).length} cidades
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {Object.entries(estado.cidades)
                    .sort(([, a], [, b]) => {
                      const volumeA = a.reduce((sum, c) => sum + c.volume_exames, 0);
                      const volumeB = b.reduce((sum, c) => sum + c.volume_exames, 0);
                      return volumeB - volumeA;
                    })
                    .map(([cidade, clientesCidade], index) => {
                      const volumeCidade = clientesCidade.reduce((sum, c) => sum + c.volume_exames, 0);
                      const maxVolumeCidades = Math.max(
                        1,
                        ...Object.values(estado.cidades).map(cidades =>
                          cidades.reduce((sum, c) => sum + c.volume_exames, 0)
                        )
                      );
                      const corClasse = getCorIntensidade(volumeCidade, maxVolumeCidades);

                      return (
                        <div key={`${estado.estado}-${cidade}`} className={`p-3 rounded-lg ${corClasse} transition-all hover:scale-105 cursor-pointer relative`}>
                          <div className="text-center">
                            <div className="absolute top-1 right-1">
                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                #{index + 1}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-sm mb-1">{cidade}</h4>
                            <div className="space-y-1">
                              <p className="text-xs">{clientesCidade.length} clientes</p>
                              <p className="text-xs font-medium">{volumeCidade.toLocaleString()} exames</p>
                            </div>
                            <div className="mt-2 text-xs opacity-75">
                              {clientesCidade.slice(0, 2).map(cliente => (
                                <div key={cliente.id} className="truncate">
                                  {cliente.nome.split(' ')[0]}...
                                </div>
                              ))}
                              {clientesCidade.length > 2 && (
                                <div>+{clientesCidade.length - 2} mais</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
