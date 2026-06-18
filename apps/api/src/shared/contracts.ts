export const atomicBackendContracts = {
  scanAccess:
    "Debe resolverse con SQL versionado para entrada/salida, locking, hash chain y asistencia hibrida.",
  autoExits:
    "Debe resolverse con SQL versionado para cerrar estancias abiertas, marcar auto_closed y actualizar asistencias assumed.",
  attendanceHydration:
    "Debe derivar asistencias potenciales desde horarios activos y reglas del catalogo person_types.",
  integrityVerification:
    "Debe recorrer hash_anterior/hash_registro sin recalcular ni mutar registros historicos."
} as const;
