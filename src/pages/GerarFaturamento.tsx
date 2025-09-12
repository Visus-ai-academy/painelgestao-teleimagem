import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileSpreadsheet, 
  DollarSign, 
  BarChart3, 
  TrendingUp, 
  Download,
  Calendar,
  CreditCard,
  CheckCircle
} from "lucide-react";
import DemonstrativoFaturamento from "@/components/DemonstrativoFaturamento";
import { DemonstrativoFaturamentoCompleto } from "@/components/DemonstrativoFaturamentoCompleto";

export default function GerarFaturamento() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("gerar");
  
  // Estados para "Gerar NF no Omie"
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [periodo, setPeriodo] = useState("2025-06");
  const [valorBruto, setValorBruto] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  // SEO básico
  useEffect(() => {
    document.title = "Gerar Faturamento | Sistema Financeiro";
    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    metaDesc.setAttribute('content', 'Sistema completo de faturamento com geração de demonstrativos, relatórios e integração com Omie ERP.');
    if (!metaDesc.parentNode) document.head.appendChild(metaDesc);

    const linkCanonical = document.querySelector('link[rel="canonical"]') || document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    linkCanonical.setAttribute('href', window.location.href);
    if (!linkCanonical.parentNode) document.head.appendChild(linkCanonical);
  }, []);

  const handleGerarNF = async () => {
    if (!clienteId || !clienteNome || !periodo || !valorBruto) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Cliente ID, Nome, Período e Valor Bruto.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('gerar-nf-omie', {
        body: {
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          periodo,
          valor_bruto: Number(valorBruto),
        }
      });

      if (error) throw error;

      toast({
        title: data?.success ? "NF gerada com sucesso" : "Processo concluído",
        description: data?.message || "Verifique os detalhes retornados.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao gerar NF",
        description: err?.message || "Falha ao chamar a função do Omie.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGerarDemonstrativoPeriodo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-faturamento', {
        body: { periodo }
      });

      if (error) throw error;

      toast({
        title: "Demonstrativos gerados",
        description: `Demonstrativos para o período ${periodo} gerados com sucesso.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao gerar demonstrativos",
        description: err?.message || "Falha ao gerar demonstrativos.",
        variant: "destructive",
      });
    }
  };

  const handleProcessarFaturamento = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('processar-faturamento', {
        body: { periodo }
      });

      if (error) throw error;

      toast({
        title: "Faturamento processado",
        description: `Faturamento do período ${periodo} processado com sucesso.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao processar faturamento",
        description: err?.message || "Falha ao processar faturamento.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Gerar Faturamento</h1>
        <p className="text-muted-foreground">Sistema completo de faturamento e geração de demonstrativos</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="gerar" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Gerar
          </TabsTrigger>
          <TabsTrigger value="demonstrativo" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Demonstrativo
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Análise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Etapa 1: Processar Faturamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Etapa 1: Processar Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="periodo-processar">Período (YYYY-MM)</Label>
                  <Input
                    id="periodo-processar"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    placeholder="2025-06"
                  />
                </div>
                <Button onClick={handleProcessarFaturamento} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Processar Faturamento
                </Button>
                <p className="text-sm text-muted-foreground">
                  Processa os dados de volumetria e gera registros de faturamento por cliente.
                </p>
              </CardContent>
            </Card>

            {/* Etapa 2: Gerar Demonstrativos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Etapa 2: Gerar Demonstrativos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="periodo-demo">Período (YYYY-MM)</Label>
                  <Input
                    id="periodo-demo"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    placeholder="2025-06"
                  />
                </div>
                <Button onClick={handleGerarDemonstrativoPeriodo} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Gerar Demonstrativos
                </Button>
                <p className="text-sm text-muted-foreground">
                  Gera demonstrativos completos de faturamento por cliente com impostos.
                </p>
              </CardContent>
            </Card>

            {/* Etapa 3: Gerar Relatórios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Etapa 3: Gerar Relatórios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full" variant="outline">
                  <Calendar className="h-4 w-4 mr-2" />
                  Relatório de Faturamento
                </Button>
                <p className="text-sm text-muted-foreground">
                  Gera relatórios detalhados em PDF com análises por período.
                </p>
              </CardContent>
            </Card>

            {/* Etapa 4: Gerar NF no Omie */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Etapa 4: Gerar NF no Omie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="clienteId">Cliente ID</Label>
                    <Input
                      id="clienteId"
                      value={clienteId}
                      onChange={(e) => setClienteId(e.target.value)}
                      placeholder="UUID do cliente"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clienteNome">Cliente Nome</Label>
                    <Input
                      id="clienteNome"
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      placeholder="Nome fantasia"
                    />
                  </div>
                  <div>
                    <Label htmlFor="valor">Valor Bruto</Label>
                    <Input
                      id="valor"
                      type="number"
                      value={valorBruto}
                      onChange={(e) => setValorBruto(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <Button onClick={handleGerarNF} disabled={loading} className="w-full">
                  {loading ? 'Gerando...' : 'Gerar NF no Omie'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Gera nota fiscal diretamente no sistema Omie ERP.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Processo de Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>1. Processar Faturamento:</strong> Analisa dados de volumetria e cria registros de faturamento agrupados por cliente.</p>
                <p><strong>2. Gerar Demonstrativos:</strong> Cria demonstrativos detalhados com cálculos de impostos e valores líquidos.</p>
                <p><strong>3. Gerar Relatórios:</strong> Produz relatórios em PDF para análise e envio aos clientes.</p>
                <p><strong>4. Gerar NF no Omie:</strong> Integra com o ERP Omie para emissão oficial da nota fiscal.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demonstrativo" className="space-y-6">
          <DemonstrativoFaturamento />
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Completos</CardTitle>
            </CardHeader>
            <CardContent>
              <DemonstrativoFaturamentoCompleto 
                periodo={periodo} 
                onDemonstrativosGerados={(dados) => {
                  toast({
                    title: "Relatórios gerados",
                    description: `${dados.demonstrativos.length} demonstrativos completos gerados.`,
                  });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analise" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Faturamento Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">R$ —</div>
                <p className="text-sm text-muted-foreground">Aguardando processamento</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clientes Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">—</div>
                <p className="text-sm text-muted-foreground">No período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Margem Líquida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">—%</div>
                <p className="text-sm text-muted-foreground">Após impostos e descontos</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Análise Temporal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-muted-foreground">
                Gráficos de análise temporal do faturamento serão exibidos aqui após o processamento dos dados.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-muted-foreground">
                Ranking dos principais clientes por faturamento será exibido após o processamento.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}