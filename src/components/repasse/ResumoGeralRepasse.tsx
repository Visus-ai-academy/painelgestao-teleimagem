import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";

interface DemonstrativoItem {
  medicoId: string;
  medicoNome: string;
  medicoCRM: string;
  medicoCPF: string;
  totalLaudos: number;
  valorExames: number;
  valorAdicionais: number;
  valorTotal: number;
  detalhesExames?: any[];
  adicionais?: any[];
  erro?: string;
}

interface ResumoGeralRepasseProps {
  demonstrativos: DemonstrativoItem[];
  periodo: string;
}

interface ArranjoResumo {
  chave: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  quantidade: number;
  valorTotal: number;
}

export function ResumoGeralRepasse({ demonstrativos, periodo }: ResumoGeralRepasseProps) {
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Agregar por arranjo (modalidade/especialidade/categoria)
  const arranjosAgregados = useMemo(() => {
    const map = new Map<string, ArranjoResumo>();

    demonstrativos.forEach(demo => {
      if (demo.detalhesExames && Array.isArray(demo.detalhesExames)) {
        demo.detalhesExames.forEach((exame: any) => {
          const chave = `${exame.modalidade}|${exame.especialidade}|${exame.categoria || 'Sem Categoria'}`;
          
          if (map.has(chave)) {
            const existente = map.get(chave)!;
            existente.quantidade += exame.quantidade || 0;
            existente.valorTotal += exame.valor_total || 0;
          } else {
            map.set(chave, {
              chave,
              modalidade: exame.modalidade || '-',
              especialidade: exame.especialidade || '-',
              categoria: exame.categoria || 'Sem Categoria',
              quantidade: exame.quantidade || 0,
              valorTotal: exame.valor_total || 0
            });
          }
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [demonstrativos]);

  const totais = useMemo(() => {
    return {
      totalLaudos: demonstrativos.reduce((sum, d) => sum + d.totalLaudos, 0),
      valorExames: demonstrativos.reduce((sum, d) => sum + d.valorExames, 0),
      valorAdicionais: demonstrativos.reduce((sum, d) => sum + d.valorAdicionais, 0),
      valorTotal: demonstrativos.reduce((sum, d) => sum + d.valorTotal, 0),
      totalMedicos: demonstrativos.length
    };
  }, [demonstrativos]);

  if (demonstrativos.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo Geral - {periodo}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Informações agregadas do período
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Totais Gerais */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {totais.totalMedicos}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Médicos</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {totais.totalLaudos}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Laudos</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {formatarMoeda(totais.valorExames)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Valor Exames</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {formatarMoeda(totais.valorAdicionais)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Adicionais</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {formatarMoeda(totais.valorTotal)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Total</div>
          </div>
        </div>

        {/* Detalhamento por Arranjo */}
        {arranjosAgregados.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Detalhamento por Arranjo</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {arranjosAgregados.map((arranjo) => (
                <div
                  key={arranjo.chave}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Modalidade</span>
                      <p className="font-medium text-sm">{arranjo.modalidade}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Especialidade</span>
                      <p className="font-medium text-sm">{arranjo.especialidade}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Categoria</span>
                      <p className="font-medium text-sm">{arranjo.categoria}</p>
                    </div>
                  </div>
                  <div className="flex gap-6 ml-4">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Quantidade</span>
                      <p className="font-semibold">{arranjo.quantidade}</p>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <span className="text-xs text-muted-foreground">Valor Total</span>
                      <p className="font-semibold text-primary">{formatarMoeda(arranjo.valorTotal)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
