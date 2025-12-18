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
  temNoDePara?: boolean;
  temNasRegras?: boolean;
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

      // Criar Set com nomes do cadastro_exames
      const examesNoCadastro = new Set(
        cadastroExamesData?.map((item) => limparTermosX(item.nome?.toUpperCase().trim() || "")).filter(Boolean) || [],
      );
      console.log("📋 Exames no Cadastro de Exames:", examesNoCadastro.size);

      // 2. Buscar estudos existentes no De Para (valores_referencia_de_para)
      const { data: deParaData, error: deParaError } = await supabase
        .from("valores_referencia_de_para")
        .select("estudo_descricao")
        .eq("ativo", true)
        .limit(50000);

      if (deParaError) {
        console.error("❌ Erro ao buscar De Para:", deParaError);
        throw deParaError;
      }

      // Criar Set com estudos do De Para
      const estudosNoDePara = new Set(
        deParaData?.map((item) => limparTermosX(item.estudo_descricao?.toUpperCase().trim() || "")).filter(Boolean) ||
          [],
      );
      console.log("📋 Estudos no De Para (Fora do Padrão):", estudosNoDePara.size);

      // 3. Buscar regras de quebra
      const { data: regrasQuebra } = await supabase
        .from("regras_quebra_exames")
        .select("exame_original, exame_quebrado")
        .eq("ativo", true);

      // 4. BUSCAR TODOS OS REGISTROS DA VOLUMETRIA (não apenas zerados)
      // Para identificar exames que não estão mapeados em lugar nenhum
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

      // Agrupar por estudo_descricao e arquivo_fonte, identificando status
      const agrupados: Record<string, ExameNaoIdentificado & { 
        temNoDePara: boolean; 
        temNasRegras: boolean;
        temNoCadastro: boolean;
        semCategoria: boolean;
        valorZerado: boolean;
      }> = {};

      volumetriaData.forEach((item) => {
        let nomeEstudo;
        let arquivoFonte = item.arquivo_fonte || "Arquivo não identificado";

        if (!item.ESTUDO_DESCRICAO?.trim()) {
          nomeEstudo = `[ERRO: Estudo sem descrição] - ${item.MODALIDADE || "Modalidade?"} / ${item.ESPECIALIDADE || "Especialidade?"}`;
          console.log(`🚨 Registro sem ESTUDO_DESCRICAO encontrado:`, item);
        } else {
          nomeEstudo = item.ESTUDO_DESCRICAO;
        }

        const estudoLimpo = limparTermosX(nomeEstudo?.toUpperCase().trim() || "");
        
        // Verificar mapeamentos
        const temNoCadastro = examesNoCadastro.has(estudoLimpo);
        const temNoDePara = estudosNoDePara.has(estudoLimpo);
        const temNasRegras = regrasQuebra?.some((regra) => {
          const originalLimpo = limparTermosX(regra.exame_original?.toUpperCase().trim() || "");
          const quebradoLimpo = limparTermosX(regra.exame_quebrado?.toUpperCase().trim() || "");
          return originalLimpo === estudoLimpo || quebradoLimpo === estudoLimpo;
        }) || false;

        const valorZerado = item.VALORES === 0 || item.VALORES === null;
        const semCategoria = !item.CATEGORIA || item.CATEGORIA.trim() === "";

        // Identificar exames problemáticos:
        // 1. Valor zerado E não está em nenhum mapeamento
        // 2. OU não está em cadastro_exames NEM no de_para (não mapeado)
        const naoMapeado = !temNoCadastro && !temNoDePara && !temNasRegras;
        const problematico = valorZerado || naoMapeado || semCategoria;

        if (!problematico) return; // Ignorar exames sem problemas

        const key = `${nomeEstudo}_${arquivoFonte}`;

        if (agrupados[key]) {
          agrupados[key].quantidade += 1;
        } else {
          agrupados[key] = {
            estudo_descricao: nomeEstudo,
            arquivo_fonte: arquivoFonte,
            quantidade: 1,
            temNoDePara,
            temNasRegras,
            temNoCadastro,
            semCategoria,
            valorZerado,
          };
        }
      });

      const examesArray = Object.values(agrupados).sort((a, b) => b.quantidade - a.quantidade);

      console.log("🔍 ANÁLISE DETALHADA:");
      console.log("🔍 Total de tipos únicos de exames com problemas:", examesArray.length);

      const naoIdentificados = examesArray.filter((e) => !e.temNoCadastro && !e.temNoDePara && !e.temNasRegras);
      const noDePara = examesArray.filter((e) => e.temNoDePara);
      const noCadastro = examesArray.filter((e) => e.temNoCadastro);
      const nasRegras = examesArray.filter((e) => e.temNasRegras);
      const semCategoriaList = examesArray.filter((e) => e.semCategoria);

      console.log("🔍 CLASSIFICAÇÃO:");
      console.log("  📋 Exames que ESTÃO no Cadastro:", noCadastro.length);
      console.log("  📋 Exames que ESTÃO no De Para:", noDePara.length);
      console.log("  🔧 Exames que estão nas Regras de Quebra:", nasRegras.length);
      console.log("  ❌ Exames NÃO identificados (sem mapeamento):", naoIdentificados.length);
      console.log("  ⚠️ Exames SEM CATEGORIA:", semCategoriaList.length);
      console.log(
        "  ❌ Lista dos não identificados:",
        naoIdentificados.map((e) => `${e.estudo_descricao} (${e.quantidade})`),
      );

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
            Exames Não Identificados - Fora do Padrão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Nenhum exame fora do padrão sem quantidade encontrado (modalidade US excluída).
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
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Exames Não Identificados / Com Problemas
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-1">
              Total de {totalExamesNaoIdentificados} exames de {examesNaoIdentificados.length} tipos
              únicos (US excluído)
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
          {examesNaoIdentificados.map((exame, index) => {
            const extendedExame = exame as ExameNaoIdentificado & { 
              temNoCadastro?: boolean; 
              semCategoria?: boolean;
              valorZerado?: boolean;
            };
            const naoMapeado = !extendedExame.temNoDePara && !extendedExame.temNasRegras && !extendedExame.temNoCadastro;
            
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm flex flex-wrap items-center gap-2">
                    {exame.estudo_descricao || "(Sem descrição do estudo)"}
                    
                    {/* Status de mapeamento */}
                    {extendedExame.temNoCadastro && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">No Cadastro</span>
                    )}
                    {exame.temNoDePara && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Fora do Padrão</span>
                    )}
                    {exame.temNasRegras && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Regra de Quebra</span>
                    )}
                    {naoMapeado && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-bold">NÃO MAPEADO</span>
                    )}
                    
                    {/* Problemas identificados */}
                    {extendedExame.semCategoria && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Sem Categoria</span>
                    )}
                    {extendedExame.valorZerado && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Valor Zerado</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Arquivo: {exame.arquivo_fonte}</div>
                </div>
                <Badge variant="destructive" className="ml-2">
                  {exame.quantidade} registros
                </Badge>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Legenda e Ações:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>
                  <strong className="text-green-700">"No Cadastro":</strong> Exame existe no Cadastro de Exames.
                </li>
                <li>
                  <strong className="text-blue-700">"Fora do Padrão":</strong> Exame mapeado na tabela De-Para (valores_referencia_de_para).
                </li>
                <li>
                  <strong className="text-purple-700">"Regra de Quebra":</strong> Exame possui regra de quebra configurada.
                </li>
                <li>
                  <strong className="text-red-700">"NÃO MAPEADO":</strong> Exame não está em nenhum cadastro. Deve ser adicionado ao <strong>Cadastro de Exames</strong> ou <strong>Fora do Padrão</strong>.
                </li>
                <li>
                  <strong className="text-yellow-700">"Sem Categoria":</strong> Exame sem categoria atribuída. Execute <strong>"Aplicar Todas as Regras"</strong> no Sistema de Regras.
                </li>
                <li>
                  <strong className="text-orange-700">"Valor Zerado":</strong> Exame sem valor de referência. Verifique o mapeamento.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
