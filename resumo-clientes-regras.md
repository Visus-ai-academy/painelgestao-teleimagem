# 📋 CLIENTES COM CONDIÇÕES E REGRAS ESPECIAIS - ANÁLISE COMPLETA

## 🚫 CLIENTES EXCLUÍDOS AUTOMATICAMENTE (Regra v032)

**Estes clientes são AUTOMATICAMENTE EXCLUÍDOS do processamento:**

1. **RADIOCOR_LOCAL**
2. **CLINICADIA_TC**
3. **CLINICA RADIOCOR**
4. **CLIRAM_LOCAL**

**Motivo:** Edge Function `aplicar-exclusao-clientes-especificos` remove todos os registros destes clientes de TODOS os arquivos de volumetria.

---

## 🔴 CLIENTES COM AGRUPAMENTO ESPECIAL

### **CEMVALENCA** (3 sub-clientes)
**Nome Mobilemed:** CEMVALENCA, P-CEMVALENCA_MG, P-CEMVALENCA_PL, P-CEMVALENCA_RX

**Separação Automática:**
- **CEMVALENCA_PL** - Exames com prioridade "PLANTÃO/PLANTAO" (qualquer modalidade exceto RX)
- **CEMVALENCA_RX** - TODOS os exames de modalidade RX (incluindo se tiverem PLANTÃO)
- **CEMVALENCA** (principal) - Demais modalidades (CT, RM, US, MG, DO) que NÃO são PLANTÃO

**Regras aplicadas:**
- ✅ v010a: P-CEMVALENCA_MG → CEMVALENCA
- ✅ v010b: Separação CEMVALENCA por tipo (PLANTÃO/RX/Principal)
- ✅ Correção legado CEMVALENCA_PLANTÃO → CEMVALENCA_PL
- ✅ PLANTÃO não-RX → CEMVALENCA_PL
- ✅ Todos RX → CEMVALENCA_RX
- ✅ Retorno de registros sem PLANTÃO → CEMVALENCA principal

---

### **DIAGNOSTICA**
**Nome Mobilemed:** DIAGNOSTICA, DIAGNOSTICA PLANTAO_*

**Agrupamento Automático:**
- ✅ v010c: Todos `DIAGNOSTICA PLANTAO_*` → agrupados como `DIAGNOSTICA`
- Exemplos: "DIAGNOSTICA PLANTAO_VILA RICA", "DIAGNOSTICA PLANTAO_UNIDADE A" → todos viram "DIAGNOSTICA"

---

## 💰 CLIENTES COM CONTRATOS ATIVOS E CONDIÇÕES ESPECIAIS

### **CBU**
- **Tipo:** CO (Cliente Oficial) - CO-FT (Com Faturamento)
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim (valores diferentes para PLANTÃO vs ROTINA)

**Características:**
- Valores diferenciados entre PLANTÃO e ROTINA
- PLANTÃO: Valores maiores (ex: CT MUSCULO ESQUELETICO = R$ 70,20)
- ROTINA: Valores menores (ex: CT MUSCULO ESQUELETICO = R$ 50,00)

---

### **CDICARDIO**
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **CEDI_RJ** (CEDIDIAG)
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **CEDI_RX**
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **CEDI_UNIMED_MG**
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **CEDI_UNIMED_PL**
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **CICOMANGRA**
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **CISP**
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **CLIRAM**
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim

---

### **GOLD** (Duplicado: GOLD e GOLD_RMX)
- **Tipo:** CO-FT
- **Modalidades:** CT, DO, MG, MR, RX
- **Especialidades:** CARDIO, MEDICINA INTERNA, MUSCULO ESQUELETICO, NEURO, D.O, MAMO, MAMA
- **Condição Volume:** MOD/ESP/CAT
- **Forma Pagamento:** Anual
- **Reajuste:** IPCA - Anual
- **Franquia:** Não
- **Considera PLANTÃO:** Sim
- **⚠️ ATENÇÃO:** Existe duplicação de cadastro (GOLD e GOLD_RMX)

---

### **PRN (Múltiplas Unidades Telelaudo)**
- **Tipo:** Sem contrato ativo na maioria das unidades
- **Exceções com contrato ativo:**
  - PRN TELE_MEDIMAGEM CAMBORIU (nome_fantasia: PRN_MEDIMAGEM_CAMBORIU)
  - PRN TELE_POLICLINICA BARREIRAS

**⚠️ OBSERVAÇÃO IMPORTANTE:**
- A maioria das unidades PRN TELE_* **NÃO TEM CONTRATO ATIVO**
- Registros são processados mas sem configurações de faturamento específicas
- Tipificação aplicada: "Sem informação" (cliente sem contrato)

---

### **OUTROS CLIENTES SEM CONTRATO ATIVO:**
- CEDI_RO (CEDIDIAG)
- Maioria das unidades PRN TELE_*

---

## 📊 REGRAS GERAIS APLICADAS A TODOS OS CLIENTES

### **Regras Automáticas (27 Regras Completas):**

1. **Normalização de Nomes** - 214 mapeamentos `nome_mobilemed` → `nome_fantasia`
2. **De-Para de Prioridades** - 19 conversões automáticas
3. **De-Para de Valores** - Preenche valores zerados baseado em tabela de preços
4. **Correção Modalidade RX** - Exames específicos corrigidos para modalidade RX
5. **Correção Modalidade OT→DO** - Exames OT convertidos para DO (Densitometria Óssea)
6. **Categorização Automática** - Baseada em 1.089 exames cadastrados
7. **Especialidade Automática (v023)** - Define por modalidade + nome do exame
8. **Colunas x Musculo x Neuro (v007)** - Correção baseada em lista de 43 médicos
9. **Substituição Especialidade/Categoria (v033)** - Para especialidades específicas
10. **Tipificação de Faturamento** - 174 configurações de contratos
11. **Quebra de Exames** - 91 exames originais gerando 46 tipos de quebras
12. **Exclusões por Período (v002/v003)** - Para arquivos retroativos
13. **Agrupamento de Clientes** - CEMVALENCA e DIAGNOSTICA
14. **Aplicação de Franquias** - Quando configuradas
15. **Exclusão de Clientes Específicos (v032)** - 4 clientes removidos automaticamente

---

## 🎯 CONDIÇÕES DE VOLUME

**MOD/ESP/CAT** (Padrão para maioria dos clientes):
- Faturamento calculado por combinação de:
  - **MOD** = Modalidade (CT, RM, US, RX, MG, DO)
  - **ESP** = Especialidade (CARDIO, NEURO, MUSCULO ESQUELETICO, etc.)
  - **CAT** = Categoria do exame (SC, ANGIO, ONCO, SCORE, TAVI, etc.)

---

## ⚡ CONSIDERA PLANTÃO

**Clientes que diferenciam valores entre PLANTÃO e ROTINA:**
- CBU
- CDICARDIO
- CEDI_RJ
- CEDI_RX
- CEDI_UNIMED_MG
- CEDI_UNIMED_PL
- CICOMANGRA
- CISP
- CLIRAM
- GOLD
- **E todos os demais clientes com contratos ativos**

**Impacto:**
- Exames com prioridade "PLANTÃO" têm valores DIFERENTES de "ROTINA"
- Geralmente valores de PLANTÃO são MAIORES

---

## 💡 OBSERVAÇÕES FINAIS

1. **Clientes EXCLUÍDOS** (4): Removidos automaticamente do processamento
2. **Clientes AGRUPADOS** (2): CEMVALENCA (3 divisões) e DIAGNOSTICA (múltiplas unidades)
3. **Clientes COM CONTRATO ATIVO**: Maioria tem configurações completas
4. **Clientes SEM CONTRATO**: Processados com tipificação "Sem informação"
5. **Duplicações**: GOLD aparece como GOLD e GOLD_RMX

---

**Data da Análise:** 12/11/2025
**Fonte:** Tabelas `clientes` + `contratos_clientes` + Edge Functions
