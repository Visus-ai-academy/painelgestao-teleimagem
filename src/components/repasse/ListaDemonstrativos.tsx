import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, AlertCircle } from "lucide-react";
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
                        <h5 className="font-semibold text-sm mb-2">Detalhes dos Exames</h5>
                        <div className="space-y-2">
                          {demo.detalhesExames.map((exame: any, idx: number) => (
                            <div key={idx} className="bg-muted/50 p-2 rounded text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="font-medium">Modalidade:</span> {exame.modalidade}
                                </div>
                                <div>
                                  <span className="font-medium">Especialidade:</span> {exame.especialidade}
                                </div>
                                <div>
                                  <span className="font-medium">Categoria:</span> {exame.categoria || '-'}
                                </div>
                                <div>
                                  <span className="font-medium">Prioridade:</span> {exame.prioridade || '-'}
                                </div>
                                <div>
                                  <span className="font-medium">Cliente:</span> {exame.cliente || '-'}
                                </div>
                                <div>
                                  <span className="font-medium">Quantidade:</span> {exame.quantidade}
                                </div>
                                <div>
                                  <span className="font-medium">Valor Unit.:</span> {formatarMoeda(exame.valor_unitario)}
                                </div>
                                <div>
                                  <span className="font-medium">Valor Total:</span> {formatarMoeda(exame.valor_total)}
                                </div>
                              </div>
                            </div>
                          ))}
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
