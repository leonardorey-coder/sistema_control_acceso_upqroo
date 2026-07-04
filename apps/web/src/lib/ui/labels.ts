export type LabelGroup =
  | "role"
  | "status"
  | "credentialType"
  | "accessMode"
  | "reasonCode"
  | "vehicleType"
  | "permitType"
  | "boolean"
  | "adminAction";

export const roleLabels: Record<string, string> = {
  admin: "Admin",
  super_admin: "Super Admin"
};

export const statusLabels: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  disabled: "Deshabilitado",
  blocked: "Bloqueado",
  revoked: "Revocado",
  expired: "Expirado",
  rotated: "Rotado",
  used: "Usado",
  suspended: "Suspendido",
  activo: "Activo",
  inactivo: "Inactivo",
  suspendido: "Suspendido",
  egresado: "Egresado",
  baja: "Baja",
  in_progress: "En curso",
  completed: "Completado",
  auto_closed: "Salida auto",
  rejected: "Rechazado",
  pending: "Pendiente",
  approved: "Aprobado",
  confirmed: "Confirmada",
  partial: "Parcial",
  unverified: "Sin verificar",
  assumed: "Asumida",
  entry: "Entrada",
  exit: "Salida",
  true: "Si",
  false: "No"
};

export const credentialTypeLabels: Record<string, string> = {
  legacy_static_qr: "QR legacy",
  person_qr: "QR personal",
  vehicle_permit_qr: "QR vehicular",
  hot_qr: "Hot-QR",
  temporary_daily_qr: "QR temporal diario",
  manual_override: "Captura manual",
  personal_qr: "QR personal",
  physical_card: "Credencial fisica",
  vehicle_qr: "QR vehicular"
};

export const accessModeLabels: Record<string, string> = {
  pedestrian: "Peatonal",
  vehicle: "Vehicular",
  visitor: "Visitante",
  manual: "Manual",
  qr: "QR",
  signed_qr: "QR firmado"
};

export const reasonCodeLabels: Record<string, string> = {
  accepted: "Aceptado",
  rejected: "Rechazado",
  admin_exception: "Excepcion administrativa",
  credential_unavailable: "Credencial no disponible",
  credential_lost: "Credencial extraviada",
  credential_damaged: "Credencial danada",
  valid_session_actor: "Actor con sesion valida",
  integration_signed_temp: "Temporal de integracion",
  SIGNED_QR_DISABLED: "QR firmado deshabilitado",
  JTI_ALREADY_CONSUMED: "QR ya usado",
  INVALID_JSON: "JSON invalido"
};

export const vehicleTypeLabels: Record<string, string> = {
  car: "Automovil",
  motorcycle: "Motocicleta",
  bicycle: "Bicicleta",
  electric_scooter: "Scooter electrico",
  truck: "Camioneta",
  official: "Oficial",
  university_transport: "Transporte universitario",
  visitor: "Visitante",
  other: "Otro"
};

export const permitTypeLabels: Record<string, string> = {
  standard: "Estandar",
  temporary: "Temporal",
  official: "Oficial",
  visitor: "Visitante",
  provider: "Proveedor",
  event: "Evento",
  emergency: "Emergencia"
};

export const booleanLabels: Record<string, string> = {
  true: "Si",
  false: "No"
};

export const adminActionLabels: Record<string, string> = {
  "admin.created": "Admin creado",
  "admin.updated": "Admin actualizado",
  "admin.disabled": "Admin deshabilitado",
  "admin.enabled": "Admin activado",
  "admin.login_success": "Inicio de sesion",
  "admin.login_failed": "Inicio fallido",
  "admin.logout": "Cierre de sesion",
  "admin.password_changed": "Password actualizado",
  "admin.change_password_failed": "Cambio de password fallido",
  "admin.password_reset": "Password reiniciado",
  "admin.session_revoked": "Sesion revocada",
  "access.scan": "Escaneo de acceso",
  "access.auto_exits": "Salidas automaticas",
  "hot_qr.created": "Hot-QR creado",
  "hot_qr.revoked": "Hot-QR revocado",
  "credential.created": "Credencial creada",
  "credential.revoked": "Credencial revocada",
  "credential.rotated": "Credencial rotada",
  "credential.temporary_daily_qr.created": "QR temporal creado",
  "credential.temporary_daily_qr.revoked": "QR temporal revocado",
  "vehicle.created": "Vehiculo creado",
  "vehicle.updated": "Vehiculo actualizado",
  "vehicle.approved": "Vehiculo aprobado",
  "vehicle.rejected": "Vehiculo rechazado",
  "vehicle.blocked": "Vehiculo bloqueado",
  "vehicle.deleted": "Vehiculo eliminado",
  "vehicle.disabled": "Vehiculo desactivado",
  "vehicle_permit.created": "Permiso vehicular creado",
  "vehicle_permit.updated": "Permiso vehicular actualizado",
  "vehicle_permit.revoked": "Permiso vehicular revocado",
  "vehicle_visitor_permit.created": "Visitante vehicular creado",
  "vehicle_visitor_permit.revoked": "Visitante vehicular revocado",
  "vehicle_access.rejected": "Acceso vehicular rechazado",
  "attendance.adjusted": "Asistencia ajustada",
  "config.updated": "Configuracion actualizada"
};

const groups: Record<LabelGroup, Record<string, string>> = {
  role: roleLabels,
  status: statusLabels,
  credentialType: credentialTypeLabels,
  accessMode: accessModeLabels,
  reasonCode: reasonCodeLabels,
  vehicleType: vehicleTypeLabels,
  permitType: permitTypeLabels,
  boolean: booleanLabels,
  adminAction: adminActionLabels
};

export function titleizeTechnicalValue(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function labelFor(group: LabelGroup, value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const key = String(value);
  return groups[group][key] ?? titleizeTechnicalValue(key);
}

export function labelAny(value: unknown) {
  if (typeof value === "boolean") return labelFor("boolean", String(value));
  if (value === null || value === undefined || value === "") return "";
  const key = String(value);
  for (const group of Object.values(groups)) {
    if (group[key]) return group[key];
  }
  return titleizeTechnicalValue(key);
}
