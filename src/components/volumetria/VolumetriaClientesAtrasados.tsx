import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users } from "lucide-react";
import { useVolumetria } from "@/contexts/VolumetriaContext";

interface ClienteAtrasado {
  nome: string;
  totalExames: number;
  atrasados: number;
  percentualAtraso: number;
  tempoMedioAtraso: number; // em horas
}

export function VolumetriaClientesAtrasados() {
  const { data } = useVolumetria();

  // Calcular clientes com atrasos usando dados detalhados CORRIGIDO
  const { clientesAtrasados, totalAtrasadosGeral } = (() => {
    const clientesTemp: ClienteAtrasado[] = [];
    let totalGeralAtrasados = 0;
    
    if (data.detailedData && data.detailedData.length > 0) {
      const clienteMap = new Map<string, {
        totalExames: number;
        atrasados: number;
        tempoTotalAtraso: number;
        quantidadeRegistrosAtrasados: number;
      }>();

      data.detailedData.forEach(item => {
        const cliente = item.EMPRESA || 'Não informado';
        const exames = Number(item.VALORES) || 1;
        
        if (!clienteMap.has(cliente)) {
          clienteMap.set(cliente, {
            totalExames: 0,
            atrasados: 0,
            tempoTotalAtraso: 0,
            quantidadeRegistrosAtrasados: 0
          });
        }

        const clienteData = clienteMap.get(cliente)!;
        clienteData.totalExames += exames;

        // Verificar se está atrasado - MESMA LÓGICA DO DASHBOARD
        if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
          try {
            const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
            const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
            
            if (!isNaN(dataLaudo.getTime()) && !isNaN(dataPrazo.getTime()) && dataLaudo > dataPrazo) {
              const tempoAtrasoMs = dataLaudo.getTime() - dataPrazo.getTime();
              const tempoAtrasoHoras = tempoAtrasoMs / (1000 * 60 * 60);
              
              clienteData.atrasados += exames;
              clienteData.tempoTotalAtraso += tempoAtrasoHoras * exames;
              clienteData.quantidadeRegistrosAtrasados += 1;
              totalGeralAtrasados += exames;
            }
          } catch (error) {
            console.log('Erro ao processar data:', error);
          }
        }
      });

      // Converter TODOS os clientes para array (não apenas os com atrasos)
      clienteMap.forEach((dados, nome) => {
        clientesTemp.push({
          nome,
          totalExames: dados.totalExames,
          atrasados: dados.atrasados,
          percentualAtraso: dados.totalExames > 0 ? (dados.atrasados / dados.totalExames) * 100 : 0,
          tempoMedioAtraso: dados.atrasados > 0 ? dados.tempoTotalAtraso / dados.atrasados : 0
        });
      });
    }

    return { 
      clientesAtrasados: clientesTemp, 
      totalAtrasadosGeral: totalGeralAtrasados
    };
  })();

  // Ordenar por quantidade de laudos atrasados (decrescente) - Mostrar todos com atrasos + os top 10 sem atrasos
  const clientesComAtrasos = clientesAtrasados.filter(c => c.atrasados > 0)
    .sort((a, b) => b.atrasados - a.atrasados);
  
  const clientesSemAtrasos = clientesAtrasados.filter(c => c.atrasados === 0)
    .sort((a, b) => b.totalExames - a.totalExames)
    .slice(0, 5); // Top 5 sem atrasos

  const clientesParaExibir = [...clientesComAtrasos, ...clientesSemAtrasos];

  const formatarTempoMedio = (horas: number) => {
    if (horas >= 24) {
      const dias = Math.floor(horas / 24);
      const horasRestantes = Math.floor(horas % 24);
      return `${dias}d ${horasRestantes}h`;
    }
    return `${Math.floor(horas)}h ${Math.floor((horas % 1) * 60)}min`;
  };

  const getCorPercentual = (percentual: number) => {
    if (percentual > 15) return 'text-red-600 bg-red-50';
    if (percentual > 10) return 'text-orange-600 bg-orange-50';
    if (percentual > 5) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-red-500" />
          Lista Clientes - Maior quant. ou % de Atrasos
          <Badge variant="destructive" className="ml-2">
            {totalAtrasadosGeral.toLocaleString()} laudos atrasados
          </Badge>
          <Badge variant="outline" className="ml-2">
            {clientesComAtrasos.length} clientes com atrasos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clientesParaExibir.length > 0 ? (
          <div className="space-y-3">
            {/* Separador para clientes com atrasos */}
            {clientesComAtrasos.length > 0 && (
              <>
                <div className="bg-red-50 p-2 rounded-lg">
                  <h4 className="font-semibold text-red-800 text-sm">
                    Clientes com Laudos Atrasados ({clientesComAtrasos.length})
                  </h4>
                </div>
                {clientesComAtrasos.map((cliente, index) => (
                  <div key={`atrasado-${index}`} className="flex items-center justify-between p-4 border-l-4 border-red-500 bg-red-50/50 rounded-lg hover:bg-red-50">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{cliente.nome}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {cliente.totalExames.toLocaleString()} exames total
                      </div>
                    </div>
                    
                    <div className="text-center mx-4">
                      <div className="text-lg font-bold text-red-600">
                        {cliente.atrasados.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Laudos Atrasados</div>
                    </div>
                    
                    <div className="text-center mx-4">
                      <div className={`text-sm font-bold px-2 py-1 rounded ${getCorPercentual(cliente.percentualAtraso)}`}>
                        {cliente.percentualAtraso.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">% Atraso</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm font-medium text-orange-600">
                        {cliente.tempoMedioAtraso > 0 ? formatarTempoMedio(cliente.tempoMedioAtraso) : '-'}
                      </div>
                      <div className="text-xs text-muted-foreground">Tempo Médio</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {/* Separador para clientes sem atrasos */}
            {clientesSemAtrasos.length > 0 && (
              <>
                <div className="bg-green-50 p-2 rounded-lg mt-6">
                  <h4 className="font-semibold text-green-800 text-sm">
                    Top 5 Clientes Sem Atrasos (Maior Volume)
                  </h4>
                </div>
                {clientesSemAtrasos.map((cliente, index) => (
                  <div key={`sem-atraso-${index}`} className="flex items-center justify-between p-4 border-l-4 border-green-500 bg-green-50/50 rounded-lg hover:bg-green-50">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{cliente.nome}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {cliente.totalExames.toLocaleString()} exames total
                      </div>
                    </div>
                    
                    <div className="text-center mx-4">
                      <div className="text-lg font-bold text-green-600">
                        0
                      </div>
                      <div className="text-xs text-muted-foreground">Laudos Atrasados</div>
                    </div>
                    
                    <div className="text-center mx-4">
                      <div className="text-sm font-bold px-2 py-1 rounded bg-green-50 text-green-600">
                        0.0%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">% Atraso</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm font-medium text-green-600">
                        -
                      </div>
                      <div className="text-xs text-muted-foreground">Tempo Médio</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente encontrado</h3>
            <p>Não há dados de clientes disponíveis para análise.</p>
          </div>
        )}
        
        {/* Resumo Geral */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-red-600">
                {totalAtrasadosGeral.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Laudos Atrasados</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-600">
                {clientesComAtrasos.length}
              </div>
              <div className="text-sm text-muted-foreground">Clientes com Atrasos</div>
            </div>
            <div>
              <div className="text-xl font-bold text-green-600">
                {clientesSemAtrasos.length > 0 ? `${clientesAtrasados.length - clientesComAtrasos.length}` : '0'}
              </div>
              <div className="text-sm text-muted-foreground">Clientes Sem Atrasos</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}