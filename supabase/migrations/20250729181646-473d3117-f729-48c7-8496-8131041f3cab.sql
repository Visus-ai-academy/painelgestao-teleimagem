-- Excluir modalidades de teste inseridas anteriormente
DELETE FROM modalidades 
WHERE nome IN ('Radiografia', 'Tomografia', 'Ressonância Magnética', 'Ultrassonografia', 'Mamografia');