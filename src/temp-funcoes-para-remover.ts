/**
 * FUNÇÕES A REMOVER - DUPLICADAS OU SUBSTITUÍDAS 
 * 
 * A nova função 'aplicar-27-regras-completas' substitui todas estas:
 */

const FUNCOES_PARA_REMOVER = [
  // Duplicadas - mesma funcionalidade
  'aplicar-regras-tratamento', // Substituída por aplicar-27-regras-completas
  'aplicar-regras-sistema-completo', // Nunca existiu realmente
  'corrigir-todos-dados-existentes', // Substituída por aplicar-27-regras-completas
  'processar-regras-avancadas', // Substituída por aplicar-27-regras-completas
  
  // Parcialmente duplicadas - funcionalidade incluída na nova função
  'aplicar-exclusoes-periodo', // Regras v002/v003 incluídas
  'aplicar-de-para-prioridades', // Regra v008 incluída  
  'aplicar-correcao-modalidade-rx', // Regra v005 incluída
  'aplicar-correcao-modalidade-ot', // Incluída na nova função
  'aplicar-categorias-cadastro', // Regras v011/v013 incluídas
  'aplicar-especialidade-automatica', // Incluída na nova função
  'aplicar-substituicao-especialidade-categoria', // Regra v018 incluída
  'aplicar-regra-colunas-musculo-neuro', // Regra v019 incluída
  'aplicar-tipificacao-faturamento', // Regras v020-v025 incluídas
  'aplicar-validacao-cliente', // Regra v012 incluída
  'aplicar-regras-quebra-exames', // Regra v010 incluída
  'aplicar-de-para-automatico', // Regra v009 incluída
  'aplicar-exclusao-clientes-especificos', // Regra v017 incluída
  'aplicar-mapeamento-nome-cliente', // Regra v006 incluída
  'aplicar-tipificacao-retroativa', // Incluída na nova função
  'buscar-valor-onco', // Regra v014 incluída
  
  // Debug/teste - não necessárias em produção
  'teste-aplicar-regras-v002-v003',
  'testar-sistema-exclusoes',
  'mapear-status-regras' // Substituído pela nova função unificada
]

console.log('📋 FUNÇÕES PARA REMOÇÃO:')
console.log('Total de funções duplicadas identificadas:', FUNCOES_PARA_REMOVER.length)
console.log('\n🔧 AÇÃO NECESSÁRIA:')
console.log('1. Remover estas funções do diretório supabase/functions/')
console.log('2. Remover entradas correspondentes do supabase/config.toml')
console.log('3. Atualizar código que chama essas funções para usar aplicar-27-regras-completas')
console.log('\n✅ FUNÇÃO UNIFICADA: aplicar-27-regras-completas')
console.log('   - Implementa todas as 27 regras')
console.log('   - Otimizada para performance')
console.log('   - Sem duplicações')
console.log('   - Logging completo')
console.log('   - Auditoria integrada')

export { FUNCOES_PARA_REMOVER }