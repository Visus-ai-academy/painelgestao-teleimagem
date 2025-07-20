import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Calculator, 
  Users, 
  DollarSign, 
  Clock, 
  Shield, 
  Database, 
  Cpu, 
  Cloud, 
  Zap,
  TrendingUp,
  FileText,
  Download
} from "lucide-react";
import jsPDF from "jspdf";

export default function EstruturaVendas() {
  const [usuarios, setUsuarios] = useState(10);
  const [configuracao, setConfiguracao] = useState({
    horasDesenvolvimento: 2400,
    valorHoraDev: 85,
    knowHowMultiplier: 1.5,
    economiaHorasMes: 40,
    valorHoraCliente: 35,
    custosInfraestrutura: {
      ai: 89,
      banco: 125,
      armazenamento: 45,
      processamento: 67,
      seguranca: 156,
      realtime: 34
    }
  });

  // Cálculos baseados no número de usuários
  const calcularCustos = () => {
    const { horasDesenvolvimento, valorHoraDev, knowHowMultiplier, economiaHorasMes, valorHoraCliente, custosInfraestrutura } = configuracao;
    
    // Custo de desenvolvimento base
    const custoDesenvolvimento = horasDesenvolvimento * valorHoraDev;
    const valorKnowHow = custoDesenvolvimento * (knowHowMultiplier - 1);
    
    // Economia mensal do cliente
    const economiaMensal = usuarios * economiaHorasMes * valorHoraCliente;
    
    // Custos mensais de infraestrutura (escalam com usuários)
    const fatorEscala = Math.max(1, usuarios / 10); // Base 10 usuários
    const custoMensalInfra = Object.values(custosInfraestrutura).reduce((sum, custo) => sum + (custo * fatorEscala), 0);
    
    // Aplicar margem de 150% sobre custos
    const custoTotal = custoDesenvolvimento + valorKnowHow;
    const margemLucro = custoTotal * 1.5; // 150% de margem
    const valorComMargem = custoTotal + margemLucro;
    
    // Aplicar impostos de 20%
    const impostos = valorComMargem * 0.20;
    const valorImplantacao = valorComMargem + impostos;
    
    // Manutenção mensal = 20% do valor de implantação
    const valorManutencao = valorImplantacao * 0.20;
    
    // Valor mensal (infraestrutura + manutenção)
    const valorMensal = custoMensalInfra + valorManutencao;
    
    // ROI do cliente
    const roiMensal = economiaMensal - valorMensal;
    const paybackMeses = valorImplantacao / roiMensal;
    
    return {
      custoDesenvolvimento,
      valorKnowHow,
      custoTotal,
      margemLucro,
      valorComMargem,
      impostos,
      valorImplantacao,
      custoMensalInfra,
      valorManutencao,
      valorMensal,
      economiaMensal,
      roiMensal,
      paybackMeses,
      fatorEscala
    };
  };

  const custos = calcularCustos();

  const gerarPropostaPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PROPOSTA COMERCIAL", pageWidth / 2, 30, { align: "center" });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Sistema de Gestão Médica TeleImagem", pageWidth / 2, 45, { align: "center" });
    
    // Informações do cliente
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO CLIENTE:", 20, 70);
    doc.setFont("helvetica", "normal");
    doc.text(`Número de Usuários: ${usuarios}`, 20, 85);
    doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 95);
    
    // Valores
    doc.setFont("helvetica", "bold");
    doc.text("VALORES DA PROPOSTA:", 20, 120);
    doc.setFont("helvetica", "normal");
    
    let yPos = 135;
    doc.text("IMPLANTAÇÃO (Valor Único):", 20, yPos);
    yPos += 10;
    doc.text(`• Desenvolvimento: R$ ${custos.custoDesenvolvimento.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 10;
    doc.text(`• Know-how: R$ ${custos.valorKnowHow.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 10;
    doc.text(`• Margem (150%): R$ ${custos.margemLucro.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 10;
    doc.text(`• Impostos (20%): R$ ${custos.impostos.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 15;
    
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL IMPLANTAÇÃO: R$ ${custos.valorImplantacao.toLocaleString('pt-BR')}`, 20, yPos);
    yPos += 20;
    
    doc.setFont("helvetica", "normal");
    doc.text("MANUTENÇÃO MENSAL:", 20, yPos);
    yPos += 10;
    doc.text(`• Infraestrutura: R$ ${custos.custoMensalInfra.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 10;
    doc.text(`• Suporte (20% implantação): R$ ${custos.valorManutencao.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 15;
    
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL MENSAL: R$ ${custos.valorMensal.toLocaleString('pt-BR')}`, 20, yPos);
    yPos += 20;
    
    // ROI
    doc.setFont("helvetica", "bold");
    doc.text("RETORNO SOBRE INVESTIMENTO:", 20, yPos);
    yPos += 10;
    doc.setFont("helvetica", "normal");
    doc.text(`• Economia mensal: R$ ${custos.economiaMensal.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 10;
    doc.text(`• ROI mensal: R$ ${custos.roiMensal.toLocaleString('pt-BR')}`, 25, yPos);
    yPos += 10;
    doc.text(`• Payback: ${custos.paybackMeses.toFixed(1)} meses`, 25, yPos);
    yPos += 10;
    doc.text(`• ROI anual: ${((custos.roiMensal * 12 / custos.valorImplantacao) * 100).toFixed(0)}%`, 25, yPos);
    
    // Rodapé
    doc.setFontSize(10);
    doc.text("Esta proposta é válida por 30 dias.", 20, 270);
    doc.text("Valores não incluem customizações específicas.", 20, 280);
    
    doc.save(`proposta-comercial-${usuarios}-usuarios.pdf`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Calculator className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Estrutura Comercial</h1>
          <p className="text-muted-foreground">Calculadora de preços e estrutura de vendas</p>
        </div>
      </div>

      {/* Configuração de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Configuração do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="usuarios">Número de Usuários</Label>
              <Input
                id="usuarios"
                type="number"
                value={usuarios}
                onChange={(e) => setUsuarios(Number(e.target.value))}
                min="1"
                max="1000"
              />
            </div>
            <div className="flex items-end">
              <Badge variant="outline" className="text-lg p-2">
                Fator de Escala: {custos.fatorEscala.toFixed(1)}x
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Implantação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {custos.valorImplantacao.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">Valor único</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mensalidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {custos.valorMensal.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">Por mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Economia Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {custos.economiaMensal.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">Por mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ROI Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {custos.roiMensal.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">Payback: {custos.paybackMeses.toFixed(1)} meses</p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento de Custos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Custos de Desenvolvimento
            </CardTitle>
            <CardDescription>Investimento inicial em desenvolvimento e know-how</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Horas de Desenvolvimento ({configuracao.horasDesenvolvimento}h)</span>
              <span className="font-bold">R$ {custos.custoDesenvolvimento.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span>Know-how e Propriedade Intelectual</span>
              <span className="font-bold">R$ {custos.valorKnowHow.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span>Margem de Lucro (150%)</span>
              <span className="font-bold">R$ {custos.margemLucro.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span>Impostos (20%)</span>
              <span className="font-bold">R$ {custos.impostos.toLocaleString('pt-BR')}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total Implantação</span>
              <span>R$ {custos.valorImplantacao.toLocaleString('pt-BR')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Custos Mensais de Infraestrutura
            </CardTitle>
            <CardDescription>Custos operacionais escaláveis por usuário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                <span>IA/Processamento</span>
              </div>
              <span className="text-right font-mono">R$ {(configuracao.custosInfraestrutura.ai * custos.fatorEscala).toFixed(0)}</span>
              
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Banco de Dados</span>
              </div>
              <span className="text-right font-mono">R$ {(configuracao.custosInfraestrutura.banco * custos.fatorEscala).toFixed(0)}</span>
              
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Segurança</span>
              </div>
              <span className="text-right font-mono">R$ {(configuracao.custosInfraestrutura.seguranca * custos.fatorEscala).toFixed(0)}</span>
              
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                <span>Armazenamento</span>
              </div>
              <span className="text-right font-mono">R$ {(configuracao.custosInfraestrutura.armazenamento * custos.fatorEscala).toFixed(0)}</span>
              
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Tempo Real</span>
              </div>
              <span className="text-right font-mono">R$ {(configuracao.custosInfraestrutura.realtime * custos.fatorEscala).toFixed(0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span>Infraestrutura Total</span>
              <span className="font-bold">R$ {custos.custoMensalInfra.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span>Manutenção (20% da Implantação)</span>
              <span className="font-bold">R$ {custos.valorManutencao.toLocaleString('pt-BR')}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total Mensal</span>
              <span>R$ {custos.valorMensal.toLocaleString('pt-BR')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Valor para o Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análise de Valor para o Cliente
          </CardTitle>
          <CardDescription>Demonstração do retorno sobre investimento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold">Economia de Tempo</h4>
              <p className="text-2xl font-bold text-green-600">{usuarios * configuracao.economiaHorasMes}h/mês</p>
              <p className="text-sm text-muted-foreground">
                {configuracao.economiaHorasMes} horas economizadas por usuário
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Valor da Economia</h4>
              <p className="text-2xl font-bold text-green-600">R$ {custos.economiaMensal.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground">
                Baseado em R$ {configuracao.valorHoraCliente}/hora
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">ROI Anual</h4>
              <p className="text-2xl font-bold text-green-600">
                {((custos.roiMensal * 12 / custos.valorImplantacao) * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground">
                Retorno sobre investimento
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações Avançadas */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Precificação</CardTitle>
          <CardDescription>Ajuste os parâmetros de cálculo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Horas de Desenvolvimento</Label>
              <Input
                type="number"
                value={configuracao.horasDesenvolvimento}
                onChange={(e) => setConfiguracao(prev => ({
                  ...prev,
                  horasDesenvolvimento: Number(e.target.value)
                }))}
              />
            </div>
            
            <div>
              <Label>Valor Hora Desenvolvedor (R$)</Label>
              <Input
                type="number"
                value={configuracao.valorHoraDev}
                onChange={(e) => setConfiguracao(prev => ({
                  ...prev,
                  valorHoraDev: Number(e.target.value)
                }))}
              />
            </div>
            
            <div>
              <Label>Multiplicador Know-how</Label>
              <Input
                type="number"
                step="0.1"
                value={configuracao.knowHowMultiplier}
                onChange={(e) => setConfiguracao(prev => ({
                  ...prev,
                  knowHowMultiplier: Number(e.target.value)
                }))}
              />
            </div>
            
            <div>
              <Label>Economia Horas/Usuário/Mês</Label>
              <Input
                type="number"
                value={configuracao.economiaHorasMes}
                onChange={(e) => setConfiguracao(prev => ({
                  ...prev,
                  economiaHorasMes: Number(e.target.value)
                }))}
              />
            </div>
            
            <div>
              <Label>Valor Hora Cliente (R$)</Label>
              <Input
                type="number"
                value={configuracao.valorHoraCliente}
                onChange={(e) => setConfiguracao(prev => ({
                  ...prev,
                  valorHoraCliente: Number(e.target.value)
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-4">
        <Button onClick={gerarPropostaPDF} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Gerar Proposta PDF
        </Button>
        
        <Button variant="outline" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Visualizar Contrato
        </Button>
      </div>
    </div>
  );
}