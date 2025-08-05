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

  // Calcular clientes com atrasos usando dados detalhados
  const clientesAtrasados: ClienteAtrasado[] = [];
  
  if (data.detailedData && data.detailedData.length > 0) {
    const clienteMap = new Map<string, {
      totalExames: number;
      atrasados: number;
      tempoTotalAtraso: number;
    }>();

    data.detailedData.forEach(item => {
      const cliente = item.EMPRESA || 'Não informado';
      const exames = Number(item.VALORES) || 1;
      
      if (!clienteMap.has(cliente)) {
        clienteMap.set(cliente, {
          totalExames: 0,
          atrasados: 0,
          tempoTotalAtraso: 0
        });
      }

      const clienteData = clienteMap.get(cliente)!;
      clienteData.totalExames += exames;

      // Verificar se está atrasado
      if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          
          if (!isNaN(dataLaudo.getTime()) && !isNaN(dataPrazo.getTime()) && dataLaudo > dataPrazo) {
            const tempoAtrasoMs = dataLaudo.getTime() - dataPrazo.getTime();
            const tempoAtrasoHoras = tempoAtrasoMs / (1000 * 60 * 60);
            
            clienteData.atrasados += exames;
            clienteData.tempoTotalAtraso += tempoAtrasoHoras * exames;
          }
        } catch (error) {
          console.log('Erro ao processar data:', error);
        }
      }
    });

    // Converter para array e calcular percentuais
    clienteMap.forEach((dados, nome) => {
      if (dados.atrasados > 0) {
        clientesAtrasados.push({
          nome,
          totalExames: dados.totalExames,
          atrasados: dados.atrasados,
          percentualAtraso: (dados.atrasados / dados.totalExames) * 100,
          tempoMedioAtraso: dados.tempoTotalAtraso / dados.atrasados
        });
      }
    });
  }

  // Ordenar por quantidade de laudos atrasados (decrescente)
  const clientesOrdenados = clientesAtrasados
    .sort((a, b) => b.atrasados - a.atrasados)
    .slice(0, 10); // Top 10

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
            {clientesAtrasados.length} clientes com atrasos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clientesOrdenados.length > 0 ? (
          <div className="space-y-3">
            {clientesOrdenados.map((cliente, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
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
                    {formatarTempoMedio(cliente.tempoMedioAtraso)}
                  </div>
                  <div className="text-xs text-muted-foreground">Tempo Médio</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente com atrasos encontrado</h3>
            <p>Todos os clientes estão dentro do prazo estabelecido.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}