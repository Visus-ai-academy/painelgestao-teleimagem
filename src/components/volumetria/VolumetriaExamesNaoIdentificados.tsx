import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, FileX, Download } from "lucide-react";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import * as XLSX from "xlsx";

interface ExameNaoIdentificado {
  estudo_descricao: string;
  quantidade: number;
  arquivo_fonte: string;
}

export function VolumetriaExamesNaoIdentificados() {
  const [examesNaoIdentificados, setExamesNaoIdentificados] = useState<ExameNaoIdentificado[]>([]);
  const [loading, setLoading] = useState(true);
  const { data } = useVolumetria();

  useEffect(() => {
    // Carregar diretamente, independente do contexto que não está funcionando
    console.log("⏳ Iniciando carregamento direto dos dados zerados");
    loadExamesNaoIdentificados();
  }, []);

  // Função para limpar termos X1-X9 e XE
  const limparTermosX = (estudo: string): string => {
    if (!estudo) return estudo;
    return estudo.replace(/\s*X[1-9E]\s*$/i, "").trim();
  };

  const loadExamesNaoIdentificados = async () => {
    try {
      console.log("🚀 INICIANDO loadExamesNaoIdentificados");

      // 1. Buscar todos os exames cadastrados em cadastro_exames
      const { data: cadastroExamesData, error: cadastroError } = await supabase
        .from("cadastro_exames")
        .select("nome")
        .eq("ativo", true)
        .limit(50000);

      if (cadastroError) {
        console.error("❌ Erro ao buscar cadastro_exames:", cadastroError);
        throw cadastroError;
      }

      const examesNoCadastro = new Set(
        cadastroExamesData?.map((item) => limparTermosX(item.nome?.toUpperCase().trim() || "")).filter(Boolean) || [],
      );
      console.log("📋 Exames no Cadastro de Exames:", examesNoCadastro.size);

      // 2. Buscar estudos no cadastro "Fora do Padrão" (valores_referencia_de_para)
      // NOTA: Este cadastro mapeia variações de nomes de exames para exames do cadastro padrão
      const { data: foraPadraoData, error: foraPadraoError } = await supabase
        .from("valores_referencia_de_para")
        .select("estudo_descricao")
        .eq("ativo", true)
        .limit(50000);

      if (foraPadraoError) {
        console.error("❌ Erro ao buscar Fora do Padrão:", foraPadraoError);
        throw foraPadraoError;
      }

      const estudosForaPadrao = new Set(
        foraPadraoData?.map((item) => limparTermosX(item.estudo_descricao?.toUpperCase().trim() || "")).filter(Boolean) || [],
      );
      console.log("📋 Estudos no Fora do Padrão:", estudosForaPadrao.size);

      // 3. Buscar TODOS os registros da volumetria
      const { data: volumetriaData, error: volumetriaError } = await supabase
        .from("volumetria_mobilemed")
        .select("ESTUDO_DESCRICAO, MODALIDADE, ESPECIALIDADE, CATEGORIA, arquivo_fonte, VALORES")
        .neq("MODALIDADE", "US")
        .limit(100000);

      if (volumetriaError) {
        console.error("❌ Erro ao buscar volumetria:", volumetriaError);
        throw volumetriaError;
      }

      console.log("📊 TOTAL DE REGISTROS NA VOLUMETRIA (exceto US):", volumetriaData?.length || 0);

      if (!volumetriaData || volumetriaData.length === 0) {
        console.log("📊 Nenhum registro encontrado na volumetria");
        setLoading(false);
        return;
      }

      // Agrupar exames NÃO IDENTIFICADOS (não estão no Cadastro NEM no Fora do Padrão)
      const agrupados: Record<string, ExameNaoIdentificado> = {};

      volumetriaData.forEach((item) => {
        let nomeEstudo = item.ESTUDO_DESCRICAO?.trim() || "";
        const arquivoFonte = item.arquivo_fonte || "Arquivo não identificado";

        if (!nomeEstudo) {
          nomeEstudo = `[ERRO: Estudo sem descrição] - ${item.MODALIDADE || "?"} / ${item.ESPECIALIDADE || "?"}`;
        }

        const estudoLimpo = limparTermosX(nomeEstudo.toUpperCase());
        
        // Verificar se está mapeado no Cadastro de Exames ou no Fora do Padrão
        const temNoCadastro = examesNoCadastro.has(estudoLimpo);
        const temForaPadrao = estudosForaPadrao.has(estudoLimpo);

        // Só incluir se NÃO está mapeado em nenhum lugar
        if (temNoCadastro || temForaPadrao) return;

        const key = `${nomeEstudo}_${arquivoFonte}`;

        if (agrupados[key]) {
          agrupados[key].quantidade += 1;
        } else {
          agrupados[key] = {
            estudo_descricao: nomeEstudo,
            arquivo_fonte: arquivoFonte,
            quantidade: 1,
          };
        }
      });

      const examesArray = Object.values(agrupados).sort((a, b) => b.quantidade - a.quantidade);

      console.log("🔍 ANÁLISE:");
      console.log("❌ Exames NÃO IDENTIFICADOS (não estão no Cadastro nem Fora do Padrão):", examesArray.length);
      console.log("❌ Lista:", examesArray.map((e) => `${e.estudo_descricao} (${e.quantidade})`));

      setExamesNaoIdentificados(examesArray);
    } catch (error) {
      console.error("Erro ao carregar exames não identificados:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalExamesNaoIdentificados = examesNaoIdentificados.reduce((total, item) => total + item.quantidade, 0);

  const exportToExcel = () => {
    const data = examesNaoIdentificados.map((exame, index) => ({
      Posição: index + 1,
      "Nome do Exame": exame.estudo_descricao,
      "Arquivo de Origem": exame.arquivo_fonte,
      "Quantidade Zerada": exame.quantidade,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exames Não Identificados");

    const fileName = `exames-nao-identificados-${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5" />
            Carregando...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (examesNaoIdentificados.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <FileX className="h-5 w-5" />
            Exames Não Identificados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            ✅ Todos os exames estão cadastrados no <strong>Cadastro de Exames</strong> ou no <strong>Fora do Padrão</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Exames Não Identificados
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-1">
              {examesNaoIdentificados.length} exame(s) não encontrado(s) no Cadastro de Exames nem no Fora do Padrão
            </div>
          </div>
          <Button onClick={exportToExcel} variant="outline" size="sm" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {examesNaoIdentificados.map((exame, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {exame.estudo_descricao || "(Sem descrição)"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Arquivo: {exame.arquivo_fonte}</div>
              </div>
              <Badge variant="destructive" className="ml-2">
                {exame.quantidade} registro(s)
              </Badge>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Ação necessária:</strong> Estes exames precisam ser cadastrados em uma das opções:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li><strong>Cadastro de Exames:</strong> Se for um exame padrão que será usado frequentemente.</li>
                <li><strong>Fora do Padrão:</strong> Se for uma variação de nome que deve ser mapeada para um exame do cadastro.</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
