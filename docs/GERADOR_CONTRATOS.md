# Gerador de Contratos de Clientes

## 📋 Funcionalidade Implementada

Foi implementado um sistema completo para **gerar contratos de clientes automaticamente** com base nos dados cadastrais e tabela de preços.

## 🚀 Como Usar

### 1. Acesso ao Gerador
- Vá para **Clientes → Cadastro de Clientes** (`/clientes/cadastro`)
- Clique no botão **"Gerar Contratos"**

### 2. Processo de Geração

#### **Passo 1: Seleção do Cliente**
- Escolha o cliente na lista suspensa
- O sistema exibe automaticamente:
  - Razão Social
  - Email
  - CNPJ
  - Telefone

#### **Passo 2: Configurações do Contrato**
- **Data de Início/Término**: Define vigência
- **Dia de Vencimento**: 1-31 (padrão: 10)
- **Desconto/Acréscimo**: Percentuais aplicados
- **Valor da Franquia**: Taxa fixa mensal
- **Valor da Integração**: Taxa de integração
- **Considera Plantão**: Para cálculos especiais

#### **Passo 3: Serviços Inclusos**
- Lista editável de serviços
- Padrão: "Laudos médicos", "Portal de laudos", "Suporte técnico"
- Botões para adicionar/remover serviços

#### **Passo 4: Preços Configurados**
- **Carregamento Automático**: Busca tabela de preços do cliente
- **Visualização Completa**: Modalidade, Especialidade, Categoria, Prioridade
- **Valores**: Base e Urgência
- **Cálculo Automático**: Valor total estimado

#### **Passo 5: Cláusulas e Observações**
- **Cláusulas Especiais**: Texto livre para condições específicas
- **Observações Contratuais**: Notas importantes

## 🔧 Tecnologia Implementada

### **Frontend Components**
- `src/components/GeradorContratos.tsx` - Interface completa
- Integração com `src/pages/CadastroClientes.tsx`

### **Backend Edge Function**
- `supabase/functions/gerar-contrato-cliente/index.ts`
- Gera HTML profissional do contrato
- Busca dados do cliente e preços automaticamente

### **Database Integration**
- **Tabelas Utilizadas**:
  - `clientes` - Dados dos clientes
  - `precos_servicos` - Tabela de preços
  - `contratos_clientes` - Contratos gerados
  - `documentos_clientes` - Registro dos documentos

## 📄 Documento Gerado

### **Seções do Contrato**
1. **Dados das Partes** - Cliente e Teleimagem
2. **Objeto do Contrato** - Serviços prestados
3. **Vigência e Prazos** - Datas e condições
4. **Tabela de Preços** - Valores detalhados por modalidade
5. **Condições Comerciais** - Faturamento e reajustes
6. **Cláusulas Especiais** - Condições específicas
7. **Observações** - Notas importantes
8. **Disposições Finais** - Aspectos legais

### **Features do Documento**
- **Design Profissional**: CSS responsivo e elegante
- **Dados Automáticos**: Preenchimento automático de todos os campos
- **Cálculos Inteligentes**: Valor total, descontos, acréscimos
- **Flexibilidade**: Cláusulas e observações customizáveis

## ⚡ Vantagens do Sistema

### **Para o Usuário**
- ✅ **Processo Rápido**: Geração em segundos
- ✅ **Dados Consistentes**: Sem erros de digitação
- ✅ **Visual Profissional**: Documento padrão empresa
- ✅ **Histórico Completo**: Todos contratos registrados

### **Para a Empresa**
- ✅ **Padronização**: Todos contratos seguem mesmo padrão
- ✅ **Auditoria**: Registro completo na base de dados
- ✅ **Eficiência**: Reduz tempo de criação de contratos
- ✅ **Integração**: Usa dados já cadastrados no sistema

## 🎯 Próximos Passos (Opcionals)

1. **Geração PDF**: Integrar biblioteca para PDF real
2. **Assinatura Digital**: Integração com ClickSign
3. **Envio Automático**: Email com contrato anexado
4. **Templates**: Múltiplos modelos de contrato
5. **Workflow**: Aprovação antes da geração

## 📊 Exemplo de Uso

```
Cliente Selecionado: Hospital ABC
Período: 01/01/2025 a 31/12/2025
Serviços: Laudos RX, CT, RM
Preços: 50 itens configurados
Valor Estimado: R$ 25.000,00/mês
```

**Resultado**: Contrato profissional de 4-6 páginas com todos os dados preenchidos automaticamente!

---

**Status**: ✅ **IMPLEMENTADO E FUNCIONANDO**  
**Localização**: Menu Clientes → Cadastro de Clientes → Botão "Gerar Contratos"