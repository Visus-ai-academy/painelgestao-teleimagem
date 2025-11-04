import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface PrioridadeDetalhe {
  prioridade: string;
  categorias: Map<string, {
    categoria: string;
    modalidades: Map<string, {
      modalidade: string;
      quantidade: number;
      valorTotal: number;
    }>;
  }>;
}

interface EspecialidadeResumo {
  especialidade: string;
  quantidade: number;
  valorTotal: number;
  prioridades: Map<string, PrioridadeDetalhe>;
}

export function ResumoGeralRepasse({ demonstrativos, periodo }: ResumoGeralRepasseProps) {
  const [expandidosEspecialidade, setExpandidosEspecialidade] = useState<Set<string>>(new Set());
  const [expandidosPrioridade, setExpandidosPrioridade] = useState<Set<string>>(new Set());
  const [expandidosCategoria, setExpandidosCategoria] = useState<Set<string>>(new Set());

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const toggleEspecialidade = (especialidade: string) => {
    setExpandidosEspecialidade(prev => {
      const novo = new Set(prev);
      if (novo.has(especialidade)) {
        novo.delete(especialidade);
      } else {
        novo.add(especialidade);
      }
      return novo;
    });
  };

  const togglePrioridade = (chave: string) => {
    setExpandidosPrioridade(prev => {
      const novo = new Set(prev);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
      }
      return novo;
    });
  };

  const toggleCategoria = (chave: string) => {
    setExpandidosCategoria(prev => {
      const novo = new Set(prev);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
      }
      return novo;
    });
  };

  // Agregar por ESPECIALIDADE -> PRIORIDADE -> CATEGORIA -> MODALIDADE
  const especialidadesAgregadas = useMemo(() => {
    const map = new Map<string, EspecialidadeResumo>();

    demonstrativos.forEach(demo => {
      if (demo.detalhesExames && Array.isArray(demo.detalhesExames)) {
        demo.detalhesExames.forEach((exame: any) => {
          const especialidade = exame.especialidade || 'Sem Especialidade';
          const prioridade = exame.prioridade || 'Sem Prioridade';
          const categoria = exame.categoria || 'Sem Categoria';
          const modalidade = exame.modalidade || 'Sem Modalidade';
          const quantidade = exame.quantidade || 0;
          const valorTotal = exame.valor_total || 0;

          if (!map.has(especialidade)) {
            map.set(especialidade, {
              especialidade,
              quantidade: 0,
              valorTotal: 0,
              prioridades: new Map()
            });
          }

          const esp = map.get(especialidade)!;
          esp.quantidade += quantidade;
          esp.valorTotal += valorTotal;

          if (!esp.prioridades.has(prioridade)) {
            esp.prioridades.set(prioridade, {
              prioridade,
              categorias: new Map()
            });
          }

          const prior = esp.prioridades.get(prioridade)!;

          if (!prior.categorias.has(categoria)) {
            prior.categorias.set(categoria, {
              categoria,
              modalidades: new Map()
            });
          }

          const cat = prior.categorias.get(categoria)!;

          if (!cat.modalidades.has(modalidade)) {
            cat.modalidades.set(modalidade, {
              modalidade,
              quantidade: 0,
              valorTotal: 0
            });
          }

          const mod = cat.modalidades.get(modalidade)!;
          mod.quantidade += quantidade;
          mod.valorTotal += valorTotal;
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

        {/* Detalhamento por Arranjo - Agrupado por Especialidade */}
        {especialidadesAgregadas.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Detalhamento por Arranjo</h4>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {especialidadesAgregadas.map((esp) => (
                <div key={esp.especialidade} className="border rounded-lg overflow-hidden">
                  {/* Especialidade - Nível 1 */}
                  <div 
                    className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => toggleEspecialidade(esp.especialidade)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {expandidosEspecialidade.has(esp.especialidade) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div>
                        <span className="text-xs text-muted-foreground">Especialidade</span>
                        <p className="font-semibold">{esp.especialidade}</p>
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">Quantidade</span>
                        <p className="font-semibold">{esp.quantidade}</p>
                      </div>
                      <div className="text-right min-w-[120px]">
                        <span className="text-xs text-muted-foreground">Valor Total</span>
                        <p className="font-semibold text-primary">{formatarMoeda(esp.valorTotal)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Prioridades - Nível 2 */}
                  {expandidosEspecialidade.has(esp.especialidade) && (
                    <div className="border-t">
                      {Array.from(esp.prioridades.values()).map((prior) => {
                        const priorChave = `${esp.especialidade}|${prior.prioridade}`;
                        const priorQtd = Array.from(prior.categorias.values()).reduce(
                          (sum, cat) => sum + Array.from(cat.modalidades.values()).reduce((s, m) => s + m.quantidade, 0), 0
                        );
                        const priorValor = Array.from(prior.categorias.values()).reduce(
                          (sum, cat) => sum + Array.from(cat.modalidades.values()).reduce((s, m) => s + m.valorTotal, 0), 0
                        );

                        return (
                          <div key={priorChave}>
                            <div
                              className="flex items-center justify-between p-3 pl-8 bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => togglePrioridade(priorChave)}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                {expandidosPrioridade.has(priorChave) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <div>
                                  <span className="text-xs text-muted-foreground">Prioridade</span>
                                  <p className="font-medium">{prior.prioridade}</p>
                                </div>
                              </div>
                              <div className="flex gap-6">
                                <div className="text-right">
                                  <span className="text-xs text-muted-foreground">Quantidade</span>
                                  <p className="font-medium">{priorQtd}</p>
                                </div>
                                <div className="text-right min-w-[120px]">
                                  <span className="text-xs text-muted-foreground">Valor Total</span>
                                  <p className="font-medium text-primary">{formatarMoeda(priorValor)}</p>
                                </div>
                              </div>
                            </div>

                            {/* Categorias - Nível 3 */}
                            {expandidosPrioridade.has(priorChave) && (
                              <div className="border-t">
                                {Array.from(prior.categorias.values()).map((cat) => {
                                  const catChave = `${priorChave}|${cat.categoria}`;
                                  const catQtd = Array.from(cat.modalidades.values()).reduce((s, m) => s + m.quantidade, 0);
                                  const catValor = Array.from(cat.modalidades.values()).reduce((s, m) => s + m.valorTotal, 0);

                                  return (
                                    <div key={catChave}>
                                      <div
                                        className="flex items-center justify-between p-3 pl-12 bg-background hover:bg-muted/20 transition-colors cursor-pointer"
                                        onClick={() => toggleCategoria(catChave)}
                                      >
                                        <div className="flex items-center gap-2 flex-1">
                                          {expandidosCategoria.has(catChave) ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                          <div>
                                            <span className="text-xs text-muted-foreground">Categoria</span>
                                            <p className="font-medium text-sm">{cat.categoria}</p>
                                          </div>
                                        </div>
                                        <div className="flex gap-6">
                                          <div className="text-right">
                                            <span className="text-xs text-muted-foreground">Quantidade</span>
                                            <p className="font-medium">{catQtd}</p>
                                          </div>
                                          <div className="text-right min-w-[120px]">
                                            <span className="text-xs text-muted-foreground">Valor Total</span>
                                            <p className="font-medium text-primary">{formatarMoeda(catValor)}</p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Modalidades - Nível 4 */}
                                      {expandidosCategoria.has(catChave) && (
                                        <div className="bg-muted/10">
                                          {Array.from(cat.modalidades.values()).map((mod) => (
                                            <div
                                              key={mod.modalidade}
                                              className="flex items-center justify-between p-2 pl-16 text-sm"
                                            >
                                              <div>
                                                <span className="text-xs text-muted-foreground">Modalidade: </span>
                                                <span className="font-medium">{mod.modalidade}</span>
                                              </div>
                                              <div className="flex gap-6">
                                                <div className="text-right">
                                                  <span className="text-xs text-muted-foreground">Qtd: </span>
                                                  <span className="font-medium">{mod.quantidade}</span>
                                                </div>
                                                <div className="text-right min-w-[120px]">
                                                  <span className="text-xs text-muted-foreground">Valor: </span>
                                                  <span className="font-medium text-primary">{formatarMoeda(mod.valorTotal)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
