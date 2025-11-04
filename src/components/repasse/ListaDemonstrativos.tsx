import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

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

interface ListaDemonstrativosProps {
  demonstrativos: DemonstrativoItem[];
  periodo: string;
}

export function ListaDemonstrativos({ demonstrativos, periodo }: ListaDemonstrativosProps) {
  const [filtro, setFiltro] = useState("");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [expandidosEspecialidade, setExpandidosEspecialidade] = useState<Set<string>>(new Set());
  const [expandidosModalidade, setExpandidosModalidade] = useState<Set<string>>(new Set());
  const [expandidosPrioridade, setExpandidosPrioridade] = useState<Set<string>>(new Set());

  const demonstrativosFiltrados = demonstrativos.filter(d =>
    d.medicoNome.toLowerCase().includes(filtro.toLowerCase())
  );

  const toggleExpandido = (medicoId: string) => {
    setExpandido(prev => {
      const novo = new Set(prev);
      if (novo.has(medicoId)) {
        novo.delete(medicoId);
      } else {
        novo.add(medicoId);
      }
      return novo;
    });
  };

  const toggleEspecialidade = (chave: string) => {
    setExpandidosEspecialidade(prev => {
      const novo = new Set(prev);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
      }
      return novo;
    });
  };

  const toggleModalidade = (chave: string) => {
    setExpandidosModalidade(prev => {
      const novo = new Set(prev);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
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

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Demonstrativos de Repasse</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Período: {periodo} • {demonstrativosFiltrados.length} demonstrativo(s)
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar médico..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {demonstrativosFiltrados.map((demo) => (
              <div
                key={demo.medicoId}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-lg">{demo.medicoNome}</h4>
                      {demo.erro ? (
                        <Badge variant="destructive">Erro</Badge>
                      ) : (
                        <Badge className="bg-green-500">Gerado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      CRM: {demo.medicoCRM} | CPF: {demo.medicoCPF}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleExpandido(demo.medicoId)}
                  >
                    {expandido.has(demo.medicoId) ? "Ocultar" : "Ver Detalhes"}
                  </Button>
                </div>

                {demo.erro && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md mb-3">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-sm text-destructive">{demo.erro}</p>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Laudos</p>
                    <p className="font-semibold">{demo.totalLaudos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Exames</p>
                    <p className="font-semibold">{formatarMoeda(demo.valorExames)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Adicionais</p>
                    <p className="font-semibold">{formatarMoeda(demo.valorAdicionais)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <p className="font-semibold text-lg text-primary">{formatarMoeda(demo.valorTotal)}</p>
                  </div>
                </div>

                {expandido.has(demo.medicoId) && (
                  <div className="border-t pt-3 space-y-3">
                    {demo.detalhesExames && demo.detalhesExames.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-sm mb-2">Detalhes por Arranjo</h5>
                        <div className="space-y-2">
                          {(() => {
                            // Agrupar por ESPECIALIDADE -> MODALIDADE -> PRIORIDADE -> CATEGORIA
                            const especialidadesMap = new Map<string, any>();
                            
                            demo.detalhesExames.forEach((exame: any) => {
                              const especialidade = exame.especialidade || 'Sem Especialidade';
                              const modalidade = exame.modalidade || 'Sem Modalidade';
                              const prioridade = exame.prioridade || 'Sem Prioridade';
                              const categoria = exame.categoria || 'Sem Categoria';
                              
                              if (!especialidadesMap.has(especialidade)) {
                                especialidadesMap.set(especialidade, {
                                  especialidade,
                                  quantidade: 0,
                                  valor_total: 0,
                                  modalidades: new Map()
                                });
                              }

                              const esp = especialidadesMap.get(especialidade);
                              esp.quantidade += Number(exame.quantidade) || 0;
                              esp.valor_total += Number(exame.valor_total) || 0;

                              if (!esp.modalidades.has(modalidade)) {
                                esp.modalidades.set(modalidade, {
                                  modalidade,
                                  prioridades: new Map()
                                });
                              }

                              const mod = esp.modalidades.get(modalidade);

                              if (!mod.prioridades.has(prioridade)) {
                                mod.prioridades.set(prioridade, {
                                  prioridade,
                                  categorias: new Map()
                                });
                              }

                              const prior = mod.prioridades.get(prioridade);

                              if (!prior.categorias.has(categoria)) {
                                prior.categorias.set(categoria, {
                                  categoria,
                                  quantidade: 0,
                                  valor_total: 0
                                });
                              }

                              const cat = prior.categorias.get(categoria);
                              cat.quantidade += Number(exame.quantidade) || 0;
                              cat.valor_total += Number(exame.valor_total) || 0;
                            });
                            
                            const especialidades = Array.from(especialidadesMap.values());
                            
                            return especialidades.map((esp: any) => {
                              const espChave = `${demo.medicoId}|${esp.especialidade}`;
                              
                              return (
                                <div key={espChave} className="border rounded overflow-hidden">
                                  {/* Especialidade - Nível 1 */}
                                  <div 
                                    className="flex items-center justify-between p-2 bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                                    onClick={() => toggleEspecialidade(espChave)}
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      {expandidosEspecialidade.has(espChave) ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                      <div>
                                        <span className="text-xs text-muted-foreground">Especialidade: </span>
                                        <span className="font-semibold text-sm">{esp.especialidade}</span>
                                      </div>
                                    </div>
                                    <div className="flex gap-4 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">Qtd: </span>
                                        <span className="font-semibold">{esp.quantidade}</span>
                                      </div>
                                      <div className="min-w-[80px] text-right">
                                        <span className="font-semibold text-primary">{formatarMoeda(esp.valor_total)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Modalidades - Nível 2 */}
                                  {expandidosEspecialidade.has(espChave) && (
                                    <div className="border-t">
                                      {Array.from(esp.modalidades.values()).map((mod: any) => {
                                        const modChave = `${espChave}|${mod.modalidade}`;
                                        const modQtd = Array.from(mod.prioridades.values()).reduce(
                                          (sum: number, prior: any) => {
                                            const priorQtd = Array.from(prior.categorias.values()).reduce((s: number, cat: any) => s + (Number(cat.quantidade) || 0), 0) as number;
                                            return sum + priorQtd;
                                          }, 0
                                        );
                                        const modValor = Array.from(mod.prioridades.values()).reduce(
                                          (sum: number, prior: any) => {
                                            const priorValor = Array.from(prior.categorias.values()).reduce((s: number, cat: any) => s + (Number(cat.valor_total) || 0), 0) as number;
                                            return sum + priorValor;
                                          }, 0
                                        );

                                        return (
                                          <div key={modChave}>
                                            <div
                                              className="flex items-center justify-between p-2 pl-6 bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                                              onClick={() => toggleModalidade(modChave)}
                                            >
                                              <div className="flex items-center gap-2 flex-1">
                                                {expandidosModalidade.has(modChave) ? (
                                                  <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                  <ChevronRight className="h-3 w-3" />
                                                )}
                                                <div>
                                                  <span className="text-xs text-muted-foreground">Modalidade: </span>
                                                  <span className="font-medium text-sm">{mod.modalidade}</span>
                                                </div>
                                              </div>
                                              <div className="flex gap-4 text-xs">
                                                <div>
                                                  <span className="text-muted-foreground">Qtd: </span>
                                                  <span className="font-medium">{Number(modQtd)}</span>
                                                </div>
                                                <div className="min-w-[80px] text-right">
                                                  <span className="font-medium text-primary">{formatarMoeda(Number(modValor))}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Prioridades - Nível 3 */}
                                            {expandidosModalidade.has(modChave) && (
                                              <div className="border-t">
                                                {Array.from(mod.prioridades.values()).map((prior: any) => {
                                                  const priorChave = `${modChave}|${prior.prioridade}`;
                                                  const priorQtd = Array.from(prior.categorias.values()).reduce((s: number, cat: any) => s + (Number(cat.quantidade) || 0), 0);
                                                  const priorValor = Array.from(prior.categorias.values()).reduce((s: number, cat: any) => s + (Number(cat.valor_total) || 0), 0);

                                                  return (
                                                    <div key={priorChave}>
                                                      <div
                                                        className="flex items-center justify-between p-2 pl-10 bg-background hover:bg-muted/20 transition-colors cursor-pointer"
                                                        onClick={() => togglePrioridade(priorChave)}
                                                      >
                                                        <div className="flex items-center gap-2 flex-1">
                                                          {expandidosPrioridade.has(priorChave) ? (
                                                            <ChevronDown className="h-3 w-3" />
                                                          ) : (
                                                            <ChevronRight className="h-3 w-3" />
                                                          )}
                                                          <div>
                                                            <span className="text-xs text-muted-foreground">Prioridade: </span>
                                                            <span className="font-medium text-sm">{prior.prioridade}</span>
                                                          </div>
                                                        </div>
                                                        <div className="flex gap-4 text-xs">
                                                          <div>
                                                            <span className="text-muted-foreground">Qtd: </span>
                                                            <span className="font-medium">{Number(priorQtd)}</span>
                                                          </div>
                                                          <div className="min-w-[80px] text-right">
                                                            <span className="font-medium text-primary">{formatarMoeda(Number(priorValor))}</span>
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {/* Categorias - Nível 4 */}
                                                      {expandidosPrioridade.has(priorChave) && (
                                                        <div className="bg-muted/10">
                                                          {Array.from(prior.categorias.values()).map((cat: any) => (
                                                            <div
                                                              key={cat.categoria}
                                                              className="flex items-center justify-between p-2 pl-14 text-xs"
                                                            >
                                                              <div>
                                                                <span className="text-muted-foreground">Categoria: </span>
                                                                <span className="font-medium">{cat.categoria}</span>
                                                              </div>
                                                              <div className="flex gap-4">
                                                                <div>
                                                                  <span className="text-muted-foreground">Qtd: </span>
                                                                  <span className="font-medium">{Number(cat.quantidade)}</span>
                                                                </div>
                                                                <div className="min-w-[80px] text-right">
                                                                  <span className="font-medium text-primary">{formatarMoeda(Number(cat.valor_total))}</span>
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
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {demo.adicionais && demo.adicionais.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-sm mb-2">Valores Adicionais</h5>
                        <div className="space-y-2">
                          {demo.adicionais.map((adicional: any, idx: number) => (
                            <div key={idx} className="bg-muted/50 p-2 rounded text-xs flex justify-between">
                              <span>{adicional.descricao || 'Sem descrição'}</span>
                              <span className="font-medium">{formatarMoeda(adicional.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {demonstrativosFiltrados.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum demonstrativo encontrado</p>
                <p className="text-xs mt-2">
                  Gere os demonstrativos na aba "Gerar Repasse"
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
