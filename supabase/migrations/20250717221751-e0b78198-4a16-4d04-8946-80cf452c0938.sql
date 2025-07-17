-- Remove the test data that was inserted
DELETE FROM public.exames_realizados 
WHERE paciente LIKE 'PACIENTE %';