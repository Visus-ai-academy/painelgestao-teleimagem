import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Página React para gerar NF via Edge Function (gerar-nf-omie)
export default function GerarFaturamento() {
  const { toast } = useToast();
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [periodo, setPeriodo] = useState("2025-06");
  const [valorBruto, setValorBruto] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  // SEO básico por rota
  useEffect(() => {
    document.title = "Gerar NF no Omie | Financeiro";
    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    metaDesc.setAttribute('content', 'Gerar nota fiscal no Omie para clientes no período selecionado.');
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Gerar NF no Omie</h1>
        <p className="text-muted-foreground">Informe os dados e gere a nota fiscal pelo Omie.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="clienteId">Cliente ID</Label>
              <Input id="clienteId" value={clienteId} onChange={(e) => setClienteId(e.target.value)} placeholder="UUID do cliente" />
            </div>
            <div>
              <Label htmlFor="clienteNome">Cliente Nome</Label>
              <Input id="clienteNome" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome fantasia" />
            </div>
            <div>
              <Label htmlFor="periodo">Período (YYYY-MM)</Label>
              <Input id="periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2025-06" />
            </div>
            <div>
              <Label htmlFor="valor">Valor Bruto</Label>
              <Input id="valor" type="number" value={valorBruto} onChange={(e) => setValorBruto(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.00" />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleGerarNF} disabled={loading}>
              {loading ? 'Gerando...' : 'Gerar NF no Omie'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section aria-label="Ajuda">
        <p className="text-sm text-muted-foreground">
          Dica: você pode usar os demonstrativos gerados no período para obter os valores por cliente antes de emitir a NF.
        </p>
      </section>
    </div>
  );
}
