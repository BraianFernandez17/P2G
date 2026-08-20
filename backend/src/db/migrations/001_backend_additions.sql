-- ============================================================
-- MIGRACIÓN DEL BACKEND (no forma parte de Code P2G/db)
-- Se aplica DESPUÉS de schema.sql y seed.sql originales, y solo
-- ajusta dos cosas para que el login y el registro funcionen de
-- verdad, sin tocar ni un archivo del frontend:
--
-- 1) courses no tenía una columna "slug": el <select> de
--    registro-estudiante.html manda valores como
--    "tecnologo-informatica", así que agregamos esa columna y la
--    completamos para que el registro pueda resolver el curso a
--    partir de ese valor.
--
-- 2) Los password_hash de seed.sql son un placeholder de mentira
--    ($2b$10$demoDemo...), no un hash real, así que ningún login
--    iba a funcionar contra esos datos. Los reemplazamos por el
--    hash real de bcrypt para la contraseña "demo1234".
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS slug VARCHAR(80) UNIQUE;

UPDATE courses SET slug = 'tecnologo-informatica' WHERE name = 'Tecnólogo en Informática';
UPDATE courses SET slug = 'tecnologo-mecanica' WHERE name = 'Tecnólogo en Mecánica';
UPDATE courses SET slug = 'tecnologo-electronica' WHERE name = 'Tecnólogo en Electrónica';
UPDATE courses SET slug = 'tecnologo-electromecanica' WHERE name = 'Tecnólogo en Electromecánica';
UPDATE courses SET slug = 'tecnologo-quimico' WHERE name = 'Tecnólogo Químico';
UPDATE courses SET slug = 'tecnologo-gestion-empresas' WHERE name = 'Tecnólogo en Gestión de Empresas';
UPDATE courses SET slug = 'tecnicatura-analisis-desarrollo-software' WHERE name = 'Tecnicatura en Análisis y Desarrollo de Software';
UPDATE courses SET slug = 'tecnicatura-administracion-contabilidad' WHERE name = 'Tecnicatura en Administración y Contabilidad';
UPDATE courses SET slug = 'bachillerato-tecnologico-agrario' WHERE name = 'Bachillerato Tecnológico Agrario';
UPDATE courses SET slug = 'bachillerato-tecnologico-turismo' WHERE name = 'Bachillerato Tecnológico en Turismo';

-- Si seed.sql trajo alguna carrera que no matcheó ningún UPDATE de
-- arriba (nombres nuevos que se agreguen a futuro), le generamos un
-- slug automático a partir del nombre para que nunca quede en NULL.
UPDATE courses
SET slug = lower(regexp_replace(unaccent(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

ALTER TABLE courses ALTER COLUMN slug SET NOT NULL;

-- Hash real de bcrypt (10 rounds) para la contraseña "demo1234",
-- para poder loguearse de verdad con cualquiera de las cuentas de
-- db/seed.sql mientras se prueba el backend.
UPDATE users
SET password_hash = '$2b$10$dwn8CaRcEbd2nJzHqfndG.0/kXswdn8usKqmFmCrP9w4l.nWmSByW'
WHERE password_hash LIKE '$2b$10$demoDemo%';
