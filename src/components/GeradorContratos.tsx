import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileText, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Cliente {
  id: string;
  nome: string;
  email: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  razao_social?: string;
  nome_fantasia?: string;
}

interface ConfiguracaoContrato {
  data_inicio: string;
  data_fim: string;
  considera_plantao: boolean;
  dia_vencimento: number;
  desconto_percentual: number;
  acrescimo_percentual: number;
  servicos_inclusos: string[];
  clausulas_especiais: string;
  valor_franquia: number;
  valor_integracao: number;
  observacoes: string;
}

interface GeradorContratosProps {
  clientes: Cliente[];
  onSuccess?: () => void;
}

export function GeradorContratos({ clientes, onSuccess }: GeradorContratosProps) {
  const [open, setOpen] = useState(false);
  const [gerandoContratos, setGerandoContratos] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [resultados, setResultados] = useState<{ sucesso: number; erro: number; detalhes: string[] }>({
    sucesso: 0,
    erro: 0,
    detalhes: []
  });

  const [configuracao, setConfiguracao] = useState<ConfiguracaoContrato>({
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    considera_plantao: false,
    dia_vencimento: 10,
    desconto_percentual: 0,
    acrescimo_percentual: 0,
    servicos_inclusos: ["Laudos médicos", "Portal de laudos", "Suporte técnico"],
    clausulas_especiais: "",
    valor_franquia: 0,
    valor_integracao: 0,
    observacoes: ""
  });

  // Reset resultados quando abre o dialog
  useEffect(() => {
    if (open) {
      setResultados({ sucesso: 0, erro: 0, detalhes: [] });
      setProgresso({ atual: 0, total: 0 });
    }
  }, [open]);

  const adicionarServico = () => {
    setConfiguracao(prev => ({
      ...prev,
      servicos_inclusos: [...prev.servicos_inclusos, ""]
    }));
  };

  const removerServico = (index: number) => {
    setConfiguracao(prev => ({
      ...prev,
      servicos_inclusos: prev.servicos_inclusos.filter((_, i) => i !== index)
    }));
  };

  const atualizarServico = (index: number, valor: string) => {
    setConfiguracao(prev => ({
      ...prev,
      servicos_inclusos: prev.servicos_inclusos.map((servico, i) => 
        i === index ? valor : servico
      )
    }));
  };

  const gerarContratosEmLote = async () => {
    try {
      setGerandoContratos(true);
      setProgresso({ atual: 0, total: clientes.length });
      setResultados({ sucesso: 0, erro: 0, detalhes: [] });

      // Filtrar apenas clientes que não têm contrato
      const { data: contratosExistentes } = await supabase
        .from('contratos_clientes')
        .select('cliente_id');

      const clientesComContrato = new Set(contratosExistentes?.map(c => c.cliente_id) || []);
      const clientesSemContrato = clientes.filter(cliente => !clientesComContrato.has(cliente.id));

      if (clientesSemContrato.length === 0) {
        toast({
          title: "Aviso",
          description: "Todos os clientes já possuem contratos cadastrados",
          variant: "default"
        });
        setGerandoContratos(false);
        return;
      }

      setProgresso({ atual: 0, total: clientesSemContrato.length });
      let sucessos = 0;
      let erros = 0;
      const detalhes: string[] = [];

      for (let i = 0; i < clientesSemContrato.length; i++) {
        const cliente = clientesSemContrato[i];
        
        try {
          setProgresso({ atual: i + 1, total: clientesSemContrato.length });

          const contratoData = {
            cliente_id: cliente.id,
            numero_contrato: `CT-${cliente.nome.substring(0, 3).toUpperCase()}-${Date.now()}-${i}`,
            data_inicio: configuracao.data_inicio,
            data_fim: configuracao.data_fim,
            considera_plantao: configuracao.considera_plantao,
            dia_vencimento: configuracao.dia_vencimento,
            desconto_percentual: configuracao.desconto_percentual,
            acrescimo_percentual: configuracao.acrescimo_percentual,
            status: 'ativo',
            servicos_contratados: configuracao.servicos_inclusos.filter(s => s.trim() !== ''),
            configuracoes_franquia: {
              tem_franquia: configuracao.valor_franquia > 0,
              valor_franquia: configuracao.valor_franquia
            },
            configuracoes_integracao: {
              cobra_integracao: configuracao.valor_integracao > 0,
              valor_integracao: configuracao.valor_integracao
            },
            observacoes_contratuais: configuracao.observacoes,
            clausulas_especiais: configuracao.clausulas_especiais
          };

          const { error: contratoError } = await supabase
            .from('contratos_clientes')
            .insert([contratoData]);

          if (contratoError) throw contratoError;

          sucessos++;
          detalhes.push(`✅ ${cliente.nome} - Contrato criado`);

        } catch (error: any) {
          erros++;
          detalhes.push(`❌ ${cliente.nome} - Erro: ${error.message}`);
          console.error(`Erro ao criar contrato para ${cliente.nome}:`, error);
        }
      }

      setResultados({ sucesso: sucessos, erro: erros, detalhes });
      
      toast({
        title: "Geração de contratos concluída",
        description: `${sucessos} contratos criados com sucesso. ${erros} erros encontrados.`,
        variant: sucessos > 0 ? "default" : "destructive"
      });

      if (sucessos > 0) {
        onSuccess?.();
      }

    } catch (error: any) {
      console.error('Erro na geração em lote:', error);
      toast({
        title: "Erro na geração em lote",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    } finally {
      setGerandoContratos(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Gerar Contratos
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerador de Contratos em Lote
          </DialogTitle>
          <DialogDescription>
            Crie contratos automaticamente para todos os clientes que ainda não possuem contrato
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo dos Clientes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo dos Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{clientes.length}</div>
                  <p className="text-sm text-muted-foreground">Total de Clientes</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{resultados.sucesso}</div>
                  <p className="text-sm text-muted-foreground">Contratos Criados</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{resultados.erro}</div>
                  <p className="text-sm text-muted-foreground">Erros</p>
                </div>
              </div>
              
              {progresso.total > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progresso</span>
                    <span>{progresso.atual} / {progresso.total}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações do Contrato */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurações do Contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data_inicio">Data de Início</Label>
                  <Input
                    id="data_inicio"
                    type="date"
                    value={configuracao.data_inicio}
                    onChange={(e) => setConfiguracao(prev => ({ ...prev, data_inicio: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="data_fim">Data de Término</Label>
                  <Input
                    id="data_fim"
                    type="date"
                    value={configuracao.data_fim}
                    onChange={(e) => setConfiguracao(prev => ({ ...prev, data_fim: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="dia_vencimento">Dia de Vencimento</Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={configuracao.dia_vencimento}
                    onChange={(e) => setConfiguracao(prev => ({ ...prev, dia_vencimento: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="desconto">Desconto (%)</Label>
                  <Input
                    id="desconto"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={configuracao.desconto_percentual}
                    onChange={(e) => setConfiguracao(prev => ({ ...prev, desconto_percentual: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="acrescimo">Acréscimo (%)</Label>
                  <Input
                    id="acrescimo"
                    type="number"
                    min="0"
                    step="0.01"
                    value={configuracao.acrescimo_percentual}
                    onChange={(e) => setConfiguracao(prev => ({ ...prev, acrescimo_percentual: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valor_franquia">Valor da Franquia (R$)</Label>
                  <Input
                    id="valor_franquia"
                    type="number"
                    min="0"
                    step="0.01"
                    value={configuracao.valor_franquia}
                    onChange={(e) => setConfiguracao(prev => ({ ...prev, valor_franquia: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="valor_integracao">Valor da Integração (R$)</Label>
                  <Input
                    id="valor_integracao"
                    type="number"
                    min="0"
                    step="0.01"
                    value={configuracao.valor_integracao}
                    onChange={(e) => setConfiguracao(prev => ({ ...prev, valor_integracao: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={configuracao.considera_plantao}
                  onCheckedChange={(checked) => setConfiguracao(prev => ({ ...prev, considera_plantao: checked }))}
                />
                <Label>Considera Plantão para Cálculo</Label>
              </div>
            </CardContent>
          </Card>

          {/* Serviços Inclusos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Serviços Inclusos
                <Button size="sm" onClick={adicionarServico}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {configuracao.servicos_inclusos.map((servico, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={servico}
                      onChange={(e) => atualizarServico(index, e.target.value)}
                      placeholder="Nome do serviço..."
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removerServico(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resultados da Geração */}
          {resultados.detalhes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resultados da Geração</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {resultados.detalhes.map((detalhe, index) => (
                    <div key={index} className="text-sm font-mono">
                      {detalhe}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações e Notas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Observações e Cláusulas Especiais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clausulas">Cláusulas Especiais</Label>
                <Textarea
                  id="clausulas"
                  placeholder="Digite cláusulas especiais que devem constar no contrato..."
                  value={configuracao.clausulas_especiais}
                  onChange={(e) => setConfiguracao(prev => ({ ...prev, clausulas_especiais: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>
              <div>
                <Label htmlFor="observacoes">Observações Internas</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações para controle interno..."
                  value={configuracao.observacoes}
                  onChange={(e) => setConfiguracao(prev => ({ ...prev, observacoes: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={gerandoContratos}
            >
              Cancelar
            </Button>
            <Button 
              onClick={gerarContratosEmLote}
              disabled={gerandoContratos || clientes.length === 0}
              className="flex items-center gap-2"
            >
              {gerandoContratos ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando Contratos...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Gerar Contratos para Todos ({clientes.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}