import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Settings, Calendar, Mail, FileText, Save } from "lucide-react";

export default function ConfiguracaoFaturamento() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuração de Faturamento</h1>
        <p className="text-gray-600 mt-1">Configure as opções gerais para geração de faturas</p>
      </div>

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
        <Button className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}