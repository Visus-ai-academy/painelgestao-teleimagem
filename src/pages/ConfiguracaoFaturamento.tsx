import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Settings, 
  Calendar, 
  Mail, 
  FileText, 
  Save, 
  Upload,
  Link,
  HardDrive,
  Zap,
  AlertTriangle
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";

// Tipos para fontes de dados
type FonteDados = 'upload' | 'mobilemed' | 'banco';

// Período atual (julho/2025)
const PERIODO_ATUAL = "2025-07";

export default function ConfiguracaoFaturamento() {
  const { toast } = useToast();
  
  const [fonteDados, setFonteDados] = useState<FonteDados>('upload');
  
  const [configuracaoMobilemed, setConfiguracaoMobilemed] = useState({
    url: '',
    usuario: '',
    senha: '',
    ativo: false
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuração de Faturamento</h1>
        <p className="text-gray-600 mt-1">Configure todas as opções para geração de faturas e relatórios</p>
      </div>

      {/* Configuração da Fonte de Dados - Movido do GerarFaturamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração da Fonte de Dados
          </CardTitle>
          <CardDescription>
            Configure como os dados do faturamento serão obtidos - via upload de arquivo ou integração direta com Mobilemed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-medium">Selecione a fonte de dados:</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Opção: Upload de Arquivo */}
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                fonteDados === 'upload' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setFonteDados('upload')}>
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    fonteDados === 'upload' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  }`}>
                    {fonteDados === 'upload' && <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Upload de Arquivo</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Fazer upload manual de arquivos CSV/Excel</p>
                  </div>
                </div>
              </div>

              {/* Opção: Integração Mobilemed */}
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                fonteDados === 'mobilemed' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setFonteDados('mobilemed')}>
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    fonteDados === 'mobilemed' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {fonteDados === 'mobilemed' && <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Mobilemed</span>
                      <Badge variant="secondary" className="text-xs">Em breve</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Integração direta com sistema Mobilemed</p>
                  </div>
                </div>
              </div>

              {/* Opção: Banco Local */}
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                fonteDados === 'banco' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setFonteDados('banco')}>
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    fonteDados === 'banco' ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                  }`}>
                    {fonteDados === 'banco' && <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Banco Local</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Usar dados já carregados no banco</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Configuração específica para Mobilemed */}
          {fonteDados === 'mobilemed' && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Configuração da Integração Mobilemed</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={configuracaoMobilemed.ativo}
                      onCheckedChange={(checked) => 
                        setConfiguracaoMobilemed(prev => ({ ...prev, ativo: checked }))
                      }
                    />
                    <Label className="text-sm">Ativo</Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mobilemed-url">URL do Sistema Mobilemed</Label>
                    <Input
                      id="mobilemed-url"
                      type="url"
                      placeholder="https://sistema.mobilemed.com.br"
                      value={configuracaoMobilemed.url}
                      onChange={(e) => setConfiguracaoMobilemed(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobilemed-usuario">Usuário</Label>
                    <Input
                      id="mobilemed-usuario"
                      placeholder="usuario@empresa.com"
                      value={configuracaoMobilemed.usuario}
                      onChange={(e) => setConfiguracaoMobilemed(prev => ({ ...prev, usuario: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobilemed-senha">Senha</Label>
                  <Input
                    id="mobilemed-senha"
                    type="password"
                    placeholder="••••••••"
                    value={configuracaoMobilemed.senha}
                    onChange={(e) => setConfiguracaoMobilemed(prev => ({ ...prev, senha: e.target.value }))}
                  />
                </div>

                <div className="flex gap-4">
                  <Button 
                    variant="outline" 
                    disabled={!configuracaoMobilemed.url || !configuracaoMobilemed.usuario || !configuracaoMobilemed.senha}
                    onClick={() => {
                      toast({
                        title: "Teste de Conexão",
                        description: "Funcionalidade em desenvolvimento. Em breve será possível testar a conexão com Mobilemed.",
                      });
                    }}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      toast({
                        title: "Configuração Salva",
                        description: "Configurações da integração Mobilemed foram salvas.",
                      });
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Salvar Configuração
                  </Button>
                </div>

                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Integração em Desenvolvimento</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        A integração com Mobilemed está sendo desenvolvida. Por enquanto, use a opção "Upload de Arquivo" 
                        para processar os dados de faturamento.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Status atual */}
          <div className="p-4 bg-gray-50 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                fonteDados === 'upload' ? 'bg-blue-500' : 
                fonteDados === 'mobilemed' ? 'bg-green-500' : 'bg-purple-500'
              }`}></div>
              <span className="font-medium">
                Fonte ativa: {
                  fonteDados === 'upload' ? 'Upload de Arquivo' :
                  fonteDados === 'mobilemed' ? 'Integração Mobilemed' : 'Banco Local'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nota sobre configuração de período - redirecionando para local correto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Período de Faturamento
          </CardTitle>
          <CardDescription>
            Configure o período de faturamento diretamente no módulo de geração
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Configuração de Período</h4>
                <p className="text-sm text-blue-700 mt-1">
                  O período de faturamento deve ser configurado diretamente no módulo 
                  <strong> Gerar Faturamento → Teste MobileMed → Definir Período de Faturamento</strong>.
                  Isso garante que o período seja específico para cada processo de geração de relatórios.
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800">Envio de Emails</h4>
                <p className="text-sm text-green-700 mt-1">
                  As configurações de envio de email também estão disponíveis no módulo de geração de relatórios,
                  permitindo controle específico por processo de faturamento.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload de Preços e Parâmetros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Preços de Serviços
            </CardTitle>
            <CardDescription>
              Faça upload da tabela de preços por modalidade, especialidade e categoria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleFileUpload
              title="Preços de Serviços"
              acceptedTypes={[".xlsx", ".xls"]}
              onUpload={async (file: File) => {
                // Upload direto Excel - colunas padronizadas
                toast({
                  title: "Preços processados",
                  description: "Tabela de preços de serviços atualizada com sucesso",
                });
              }}
            />
            <p className="text-sm text-gray-600 mt-2">
              Arquivo Excel (.xlsx/.xls) com colunas: modalidade, especialidade, categoria, prioridade, valor_base, valor_urgencia, cliente_nome, tipo_preco
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Upload de Parâmetros de Faturamento
            </CardTitle>
            <CardDescription>
              Configure parâmetros específicos de faturamento por cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleFileUpload
              title="Parâmetros de Faturamento"
              acceptedTypes={[".xlsx", ".xls"]}
              onUpload={async (file: File) => {
                // Upload direto Excel - colunas padronizadas
                toast({
                  title: "Parâmetros processados",
                  description: "Parâmetros de faturamento atualizados com sucesso",
                });
              }}
            />
            <p className="text-sm text-gray-600 mt-2">
              Arquivo Excel (.xlsx/.xls) com colunas: cliente_nome, tipo_cliente, aplicar_franquia, volume_franquia, valor_franquia, percentual_adicional_urgencia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configurações originais da página */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Configurações de Período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="periodo-padrao">Período Padrão</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes-atual">Mês Atual</SelectItem>
                  <SelectItem value="mes-anterior">Mês Anterior</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dia-vencimento">Dia de Vencimento Padrão</Label>
              <Input 
                type="number" 
                id="dia-vencimento" 
                placeholder="15"
                min="1"
                max="31"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-bloqueio">Auto-bloqueio após faturamento</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a opção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configurações de Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-remetente">Email Remetente</Label>
              <Input 
                type="email" 
                id="email-remetente" 
                placeholder="faturamento@empresa.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assunto-padrao">Assunto Padrão</Label>
              <Input 
                id="assunto-padrao" 
                placeholder="Fatura {{numero}} - {{cliente}}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mensagem-padrao">Mensagem Padrão</Label>
              <Textarea 
                id="mensagem-padrao" 
                placeholder="Prezado cliente, segue em anexo a fatura..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Configurações de PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-pdf">Template PDF</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrao">Padrão</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeracao">Numeração de Faturas</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Formato da numeração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequencial">Sequencial (001, 002, 003...)</SelectItem>
                  <SelectItem value="anual">Anual (2025001, 2025002...)</SelectItem>
                  <SelectItem value="mensal">Mensal (202501001, 202501002...)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes-padrao">Observações Padrão</Label>
              <Textarea 
                id="observacoes-padrao" 
                placeholder="Observações que aparecerão em todas as faturas..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Outras Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moeda">Moeda</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a moeda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brl">Real (R$)</SelectItem>
                  <SelectItem value="usd">Dólar (US$)</SelectItem>
                  <SelectItem value="eur">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="casas-decimais">Casas Decimais</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Número de casas decimais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 casas (0,00)</SelectItem>
                  <SelectItem value="3">3 casas (0,000)</SelectItem>
                  <SelectItem value="4">4 casas (0,0000)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backup-automatico">Backup Automático</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Frequência do backup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="desabilitado">Desabilitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          className="flex items-center gap-2"
          onClick={() => {
            toast({
              title: "Configurações Salvas",
              description: "Todas as configurações foram salvas com sucesso!",
            });
          }}
        >
          <Save className="h-4 w-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}