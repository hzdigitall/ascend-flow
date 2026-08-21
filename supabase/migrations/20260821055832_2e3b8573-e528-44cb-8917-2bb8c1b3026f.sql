-- Add unique constraint to name for upserting products if not already there
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_name_key') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_name_key UNIQUE (name);
    END IF;
END $$;

-- Seed Arena Health products for the rewards store
INSERT INTO public.products (name, description, points_cost, stock, image_url, active, sku)
VALUES 
  ('Arena Glow', 'Suplemento nutricional para saúde da pele, cabelos e unhas. Contém 30 cápsulas.', 250, 100, '/__l5e/assets-v1/66391cc6-31e3-40a2-96a1-054c7fc81533/arena-glow.png', true, 'ARENA-GLOW'),
  ('Arena Shape', 'Fórmula avançada para suporte ao gerenciamento de peso e energia corporal. Contém 30 cápsulas.', 250, 100, '/__l5e/assets-v1/a61593a1-700f-4d21-ad91-1647cb2a9057/arena-shape.png', true, 'ARENA-SHAPE'),
  ('Arena Mind', 'Suporte cognitivo para foco, clareza mental e performance cerebral. Contém 30 cápsulas.', 250, 100, '/__l5e/assets-v1/d599282f-5829-4497-b065-2503c6e2c164/arena-mind.png', true, 'ARENA-MIND'),
  ('Arena Burn', 'Termogênico potente para acelerar o metabolismo e queima de gordura. Contém 30 cápsulas.', 250, 100, '/__l5e/assets-v1/463c2ae6-704f-4656-8c68-4d75b20cf651/arena-burn.png', true, 'ARENA-BURN')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  points_cost = EXCLUDED.points_cost,
  image_url = EXCLUDED.image_url,
  active = EXCLUDED.active,
  sku = EXCLUDED.sku;
