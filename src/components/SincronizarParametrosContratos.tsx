import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface ResultadoSincronizacao {
  sucesso: boolean;
  total_contratos: number;
  contratos_atualizados: number;
  contratos_sem_parametros: number;
  contratos_com_erro: number;
  detalhes: Array<{
    contrato_id: string;
    cliente_nome: string;
    status: 'atualizado' | 'sem_parametros' | 'erro';
    erro?: string;
  }>;
}

export function SincronizarParametrosContratos() {
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoSincronizacao | null>(null);

  const sincronizarParametros = async () => {
    if (sincronizando) return;
    
    setSincronizando(true);
    try {
      toast('🔄 Iniciando sincronização dos parâmetros nos contratos...');
      
      // 1. Buscar todos os contratos ativos
      const { data: contratos, error: contratosError } = await supabase
        .from('contratos_clientes')
        .select(`
          id,
          cliente_id,
          numero_contrato,
          tem_parametros_configurados,
          clientes (
            nome,
            nome_fantasia,
            nome_mobilemed
          )
        `)
        .eq('status', 'ativo');

      if (contratosError) {
        throw new Error(`Erro ao buscar contratos: ${contratosError.message}`);
      }

      if (!contratos || contratos.length === 0) {
        toast.error('❌ Nenhum contrato ativo encontrado');
        return;
      }

      console.log(`🔍 Encontrados ${contratos.length} contratos ativos para sincronização`);

      const resultado: ResultadoSincronizacao = {
        sucesso: true,
        total_contratos: contratos.length,
        contratos_atualizados: 0,
        contratos_sem_parametros: 0,
        contratos_com_erro: 0,
        detalhes: []
      };

      // 2. Processar cada contrato
      for (const contrato of contratos) {
        try {
          // Buscar parâmetros do cliente
          const { data: parametros, error: parametrosError } = await supabase
            .from('parametros_faturamento')
            .select('*')
            .eq('cliente_id', contrato.cliente_id)
            .eq('ativo', true)
            .maybeSingle();

          if (parametrosError && parametrosError.code !== 'PGRST116') {
            throw new Error(`Erro ao buscar parâmetros: ${parametrosError.message}`);
          }

          const nomeCliente = contrato.clientes?.nome_fantasia || contrato.clientes?.nome || 'Cliente não identificado';

          if (!parametros) {
            // Cliente sem parâmetros configurados
            resultado.contratos_sem_parametros++;
            resultado.detalhes.push({
              contrato_id: contrato.id,
              cliente_nome: nomeCliente,
              status: 'sem_parametros'
            });

            // Marcar contrato como sem parâmetros
            await supabase
              .from('contratos_clientes')
              .update({ tem_parametros_configurados: false })
              .eq('id', contrato.id);

            continue;
          }

          // 3. Preparar dados de sincronização
          const configuracoesFranquia = {
            tem_franquia: parametros.aplicar_franquia,
            valor_franquia: parametros.valor_franquia,
            volume_franquia: parametros.volume_franquia,
            valor_acima_franquia: parametros.valor_acima_franquia,
            frequencia_continua: parametros.frequencia_continua,
            frequencia_por_volume: parametros.frequencia_por_volume,
            percentual_urgencia: parametros.percentual_urgencia,
            aplicar_adicional_urgencia: parametros.aplicar_adicional_urgencia
          };

          const configuracoesIntegracao = {
            cobra_integracao: parametros.cobrar_integracao,
            valor_integracao: parametros.valor_integracao,
            portal_laudos: parametros.portal_laudos,
            incluir_medico_solicitante: parametros.incluir_medico_solicitante,
            incluir_access_number: parametros.incluir_access_number,
            incluir_empresa_origem: parametros.incluir_empresa_origem,
            data_inicio_integracao: parametros.data_inicio_integracao
          };

          const configuracoesFinanceiras = {
            periodicidade_reajuste: parametros.periodicidade_reajuste,
            data_aniversario_contrato: parametros.data_aniversario_contrato,
            indice_reajuste: parametros.indice_reajuste,
            percentual_reajuste_fixo: parametros.percentual_reajuste_fixo,
            impostos_ab_min: parametros.impostos_ab_min,
            percentual_iss: parametros.percentual_iss,
            simples: parametros.simples
          };

          // 4. Atualizar contrato com parâmetros sincronizados
          const { error: updateError } = await supabase
            .from('contratos_clientes')
            .update({
              tem_parametros_configurados: true,
              tipo_faturamento: parametros.tipo_cliente === 'CO' ? 'CO-FT' : 'NC-FT',
              forma_pagamento: parametros.periodicidade_reajuste || 'mensal',
              configuracoes_franquia: configuracoesFranquia,
              configuracoes_integracao: configuracoesIntegracao,
              observacoes_contratuais: `Parâmetros sincronizados em ${new Date().toLocaleDateString('pt-BR')} - ${parametros.indice_reajuste} - ${parametros.periodicidade_reajuste}`,
              // Adicionar configurações financeiras ao JSONB existente
              tabela_precos: {
                ...((contrato as any).tabela_precos || {}),
                configuracoes_financeiras: configuracoesFinanceiras
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', contrato.id);

          if (updateError) {
            throw new Error(`Erro ao atualizar contrato: ${updateError.message}`);
          }

          resultado.contratos_atualizados++;
          resultado.detalhes.push({
            contrato_id: contrato.id,
            cliente_nome: nomeCliente,
            status: 'atualizado'
          });

          console.log(`✅ Contrato ${contrato.numero_contrato} atualizado com parâmetros do cliente ${nomeCliente}`);

        } catch (error: any) {
          console.error(`❌ Erro ao processar contrato ${contrato.numero_contrato}:`, error);
          
          resultado.contratos_com_erro++;
          resultado.detalhes.push({
            contrato_id: contrato.id,
            cliente_nome: contrato.clientes?.nome_fantasia || contrato.clientes?.nome || 'Cliente não identificado',
            status: 'erro',
            erro: error.message
          });
        }
      }

      setUltimoResultado(resultado);
      
      toast.success(`✅ Sincronização concluída! ${resultado.contratos_atualizados} contratos atualizados`);
      
      console.log('📊 Resultado final da sincronização:', {
        'Total de contratos': resultado.total_contratos,
        'Contratos atualizados': resultado.contratos_atualizados,
        'Contratos sem parâmetros': resultado.contratos_sem_parametros,
        'Contratos com erro': resultado.contratos_com_erro
      });

    } catch (error: any) {
      console.error('❌ Erro geral na sincronização:', error);
      toast.error(`❌ Erro na sincronização: ${error.message}`);
      
      setUltimoResultado({
        sucesso: false,
        total_contratos: 0,
        contratos_atualizados: 0,
        contratos_sem_parametros: 0,
        contratos_com_erro: 0,
        detalhes: []
      });
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-blue-600" />
          Sincronizar Parâmetros com Contratos
        </CardTitle>
        <CardDescription>
          Incorpora os dados dos parâmetros de faturamento nos contratos existentes dos clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">O que será sincronizado:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Configurações de Franquia:</strong> Valores, volumes e frequências</li>
            <li>• <strong>Configurações de Integração:</strong> Portal de laudos, dados adicionais</li>
            <li>• <strong>Configurações Financeiras:</strong> Reajustes, impostos, periodicidade</li>
            <li>• <strong>Tipo de Faturamento:</strong> CO-FT ou NC-FT baseado no tipo do cliente</li>
            <li>• <strong>Observações Contratuais:</strong> Histórico de sincronização</li>
          </ul>
        </div>

        <Button 
          onClick={sincronizarParametros}
          disabled={sincronizando}
          className="w-full"
          size="lg"
        >
          {sincronizando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando Parâmetros...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar Parâmetros nos Contratos
            </>
          )}
        </Button>

        {ultimoResultado && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {ultimoResultado.sucesso ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <span className="font-semibold">
                {ultimoResultado.sucesso ? 'Sincronização Concluída' : 'Sincronização com Problemas'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-700">
                  {ultimoResultado.total_contratos}
                </div>
                <div className="text-xs text-blue-600">
                  Total Contratos
                </div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-700">
                  {ultimoResultado.contratos_atualizados}
                </div>
                <div className="text-xs text-green-600">
                  Atualizados
                </div>
              </div>
              
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-lg font-bold text-amber-700">
                  {ultimoResultado.contratos_sem_parametros}
                </div>
                <div className="text-xs text-amber-600">
                  Sem Parâmetros
                </div>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-700">
                  {ultimoResultado.contratos_com_erro}
                </div>
                <div className="text-xs text-red-600">
                  Com Erro
                </div>
              </div>
            </div>

            {ultimoResultado.detalhes.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Detalhes da Sincronização:
                </h4>
                
                <div className="max-h-60 overflow-auto space-y-2">
                  {ultimoResultado.detalhes.map((detalhe, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{detalhe.cliente_nome}</div>
                        {detalhe.erro && (
                          <div className="text-xs text-red-600 mt-1">{detalhe.erro}</div>
                        )}
                      </div>
                      <Badge 
                        variant={
                          detalhe.status === 'atualizado' ? 'default' :
                          detalhe.status === 'sem_parametros' ? 'secondary' : 'destructive'
                        }
                      >
                        {detalhe.status === 'atualizado' ? 'Atualizado' :
                         detalhe.status === 'sem_parametros' ? 'Sem Parâmetros' : 'Erro'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}