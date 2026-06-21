-- Refresh homepage testimonials header copy in admin_settings (fixes legacy jerus typo and old defaults).
update public.admin_settings
set payload = jsonb_set(
  coalesce(payload, '{}'::jsonb),
  '{testimonials}',
  coalesce(payload->'testimonials', '{}'::jsonb) || jsonb_build_object(
    'eyebrow', 'Customer voices',
    'title', 'Trusted by pilots and field teams',
    'lead', 'Real feedback from operators running agriculture, mapping, and surveillance missions with Mithron hardware.',
    'linkLabel', 'Browse products',
    'linkHref', '/products'
  ),
  true
),
updated_at = timezone('utc', now())
where id = 'global'
  and (
    coalesce(payload->'testimonials'->>'title', '') ilike '%jerus%'
    or coalesce(payload->'testimonials'->>'title', '') = 'What customers say about our drones'
    or coalesce(payload->'testimonials'->>'eyebrow', '') = 'Product reviews'
    or coalesce(payload->'testimonials'->>'lead', '') = ''
  );
