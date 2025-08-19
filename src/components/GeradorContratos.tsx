import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Trash2, Download, Send, Loader2 } from "lucide-react";
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

interface PrecoServico {
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  valor_base: number;
  valor_urgencia?: number;
  volume_inicial?: number;
  volume_final?: number;
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
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [precosCliente, setPrecosCliente] = useState<PrecoServico[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPrecos, setLoadingPrecos] = useState(false);
  const [gerandoContrato, setGerandoContrato] = useState(false);

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

  // Carregar preços do cliente selecionado
  useEffect(() => {
    const carregarPrecos = async () => {
      if (!clienteSelecionado) {
        setPrecosCliente([]);
        return;
      }

      try {
        setLoadingPrecos(true);
        const { data, error } = await supabase
          .from('precos_servicos')
          .select('*')
          .eq('cliente_id', clienteSelecionado)
          .order('modalidade', { ascending: true });

        if (error) throw error;
        setPrecosCliente(data || []);
      } catch (error: any) {
        console.error('Erro ao carregar preços:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os preços do cliente",
          variant: "destructive"
        });
      } finally {
        setLoadingPrecos(false);
      }
    };

    carregarPrecos();
  }, [clienteSelecionado]);

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

  const gerarContrato = async () => {
    if (!clienteSelecionado) {
      toast({
        title: "Erro",
        description: "Selecione um cliente para gerar o contrato",
        variant: "destructive"
      });
      return;
    }

    const cliente = clientes.find(c => c.id === clienteSelecionado);
    if (!cliente) {
      toast({
        title: "Erro",
        description: "Cliente não encontrado",
        variant: "destructive"
      });
      return;
    }

    try {
      setGerandoContrato(true);

      // 1. Criar o contrato na base de dados
      const contratoData = {
        cliente_id: clienteSelecionado,
        numero_contrato: `CT-${cliente.nome.substring(0, 3).toUpperCase()}-${Date.now()}`,
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

      const { data: contratoInserido, error: contratoError } = await supabase
        .from('contratos_clientes')
        .insert([contratoData])
        .select()
        .single();

      if (contratoError) throw contratoError;

      // 2. Gerar documento PDF via Edge Function
      const { data: documentoData, error: documentoError } = await supabase.functions
        .invoke('gerar-contrato-cliente', {
          body: {
            contrato_id: contratoInserido.id,
            cliente_id: clienteSelecionado,
            configuracao,
            precos_cliente: precosCliente
          }
        });

      if (documentoError) throw documentoError;

      // 3. Registrar documento gerado
      if (documentoData.success) {
        const { error: docError } = await supabase
          .from('documentos_clientes')
          .insert([{
            cliente_id: clienteSelecionado,
            tipo_documento: 'contrato',
            nome_arquivo: `Contrato_${cliente.nome}_${contratoInserido.numero_contrato}.pdf`,
            url_arquivo: documentoData.documento_url,
            status_documento: 'anexado'
          }]);

        if (docError) {
          console.warn('Erro ao registrar documento:', docError);
        }
      }

      toast({
        title: "Contrato gerado com sucesso!",
        description: `Contrato ${contratoInserido.numero_contrato} criado para ${cliente.nome}`,
      });

      setOpen(false);
      onSuccess?.();

      // Reset form
      setClienteSelecionado("");
      setConfiguracao({
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

    } catch (error: any) {
      console.error('Erro ao gerar contrato:', error);
      toast({
        title: "Erro ao gerar contrato",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    } finally {
      setGerandoContrato(false);
    }
  };

  const clienteAtual = clientes.find(c => c.id === clienteSelecionado);
  const valorTotalEstimado = precosCliente.reduce((total, preco) => total + preco.valor_base, 0);

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
            Gerador de Contratos Automático
          </DialogTitle>
          <DialogDescription>
            Gere contratos automaticamente com base nos dados do cliente e tabela de preços
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seleção do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selecionar Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(cliente => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{cliente.nome}</span>
                            <span className="text-sm text-muted-foreground">
                              {cliente.cnpj && `CNPJ: ${cliente.cnpj}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Informações do Cliente Selecionado */}
                {clienteAtual && (
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Razão Social:</span>
                          <span className="ml-2">{clienteAtual.razao_social || clienteAtual.nome}</span>
                        </div>
                        <div>
                          <span className="font-medium">Email:</span>
                          <span className="ml-2">{clienteAtual.email}</span>
                        </div>
                        <div>
                          <span className="font-medium">CNPJ:</span>
                          <span className="ml-2">{clienteAtual.cnpj || 'Não informado'}</span>
                        </div>
                        <div>
                          <span className="font-medium">Telefone:</span>
                          <span className="ml-2">{clienteAtual.telefone || 'Não informado'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
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

          {/* Preços do Cliente */}
          {clienteSelecionado && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preços Configurados</CardTitle>
                <CardDescription>
                  Tabela de preços que será incluída no contrato
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPrecos ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Carregando preços...
                  </div>
                ) : precosCliente.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid gap-2 max-h-60 overflow-y-auto">
                      {precosCliente.map((preco, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex gap-4 text-sm">
                            <Badge variant="outline">{preco.modalidade}</Badge>
                            <Badge variant="outline">{preco.especialidade}</Badge>
                            <Badge variant="outline">{preco.categoria}</Badge>
                            <span className="text-muted-foreground">{preco.prioridade}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">R$ {preco.valor_base.toFixed(2)}</div>
                            {preco.valor_urgencia && (
                              <div className="text-sm text-muted-foreground">
                                Urgência: R$ {preco.valor_urgencia.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center font-medium">
                      <span>Valor Total Estimado:</span>
                      <span className="text-lg">R$ {valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum preço configurado para este cliente</p>
                    <p className="text-sm">Configure os preços primeiro para gerar o contrato</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cláusulas Especiais e Observações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cláusulas Especiais e Observações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clausulas">Cláusulas Especiais</Label>
                <Textarea
                  id="clausulas"
                  value={configuracao.clausulas_especiais}
                  onChange={(e) => setConfiguracao(prev => ({ ...prev, clausulas_especiais: e.target.value }))}
                  placeholder="Digite cláusulas específicas para este contrato..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="observacoes">Observações Contratuais</Label>
                <Textarea
                  id="observacoes"
                  value={configuracao.observacoes}
                  onChange={(e) => setConfiguracao(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações importantes sobre o contrato..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={gerarContrato} disabled={!clienteSelecionado || gerandoContrato}>
              {gerandoContrato ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Contrato...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Contrato
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}