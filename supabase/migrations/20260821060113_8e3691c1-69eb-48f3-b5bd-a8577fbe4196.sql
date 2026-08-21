-- Deactivate products that don't have an image_url
UPDATE public.products 
SET active = false 
WHERE image_url IS NULL;
