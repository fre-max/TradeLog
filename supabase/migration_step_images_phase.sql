-- 1. Ajoute la colonne phase à la table step_images pour gérer les captures Avant et Après par étape
ALTER TABLE step_images ADD COLUMN IF NOT EXISTS phase text CHECK (phase IN ('avant', 'apres')) DEFAULT 'avant';

-- 2. Pour les images existantes, elles sont considérées comme "avant" par défaut
UPDATE step_images SET phase = 'avant' WHERE phase IS NULL;
