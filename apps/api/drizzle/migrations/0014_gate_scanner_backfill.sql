-- Preserve the current scanner hot path after introducing mandatory gate
-- resolution. Existing active authenticated devices start in a clearly named
-- transitional gate and can be reassigned from the admin UI.
INSERT INTO gates (code, name, type, location, status, notes)
SELECT
  'acceso-legacy-sin-clasificar',
  'Acceso legacy sin clasificar',
  'mixed',
  'Pendiente de asignacion fisica',
  'active',
  'Gate transitorio creado al migrar scanners existentes. Reasignar cada dispositivo a su puerta fisica.'
WHERE EXISTS (SELECT 1 FROM scanner_devices WHERE status = 'active')
ON CONFLICT (code) DO NOTHING;--> statement-breakpoint

INSERT INTO gate_scanners (gate_id, scanner_device_id, scanner_id, label, status, metadata)
SELECT
  g.id,
  d.id,
  d.code,
  d.label,
  'active',
  jsonb_build_object('backfilled', true, 'source', '0014_gate_scanner_backfill')
FROM scanner_devices d
INNER JOIN gates g ON g.code = 'acceso-legacy-sin-clasificar'
WHERE d.status = 'active'
ON CONFLICT (scanner_id) DO NOTHING;
