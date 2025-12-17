-- Desabilitar trigger que está aplicando regras v003 incorretamente durante INSERT
-- As regras v002/v003 devem ser aplicadas APENAS pela edge function aplicar-exclusoes-periodo
-- com o período correto selecionado pelo usuário

ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_aplicar_regras_completas;

-- Comentário: Este trigger contém lógica de exclusão por período que está usando
-- datas incorretas ou hardcoded. A aplicação de regras v002/v003 deve ser feita
-- exclusivamente via edge function processar-volumetria-otimizado que recebe
-- o período selecionado pelo usuário.