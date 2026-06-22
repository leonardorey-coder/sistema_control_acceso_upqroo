import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const personStatus = pgEnum("person_status", [
  "activo",
  "inactivo",
  "suspendido",
  "egresado",
  "baja"
]);

export const qrTokenStatus = pgEnum("qr_token_status", [
  "active",
  "revoked",
  "expired",
  "rotated"
]);

export const credentialType = pgEnum("credential_type", [
  "legacy_static_qr",
  "person_qr",
  "vehicle_permit_qr",
  "hot_qr",
  "temporary_daily_qr",
  "manual_override"
]);

export const accessMode = pgEnum("access_mode", [
  "pedestrian",
  "vehicle",
  "visitor",
  "manual"
]);

export const accessSubjectType = pgEnum("access_subject_type", [
  "person",
  "vehicle_permit",
  "visitor",
  "exception"
]);

export const accessStatus = pgEnum("access_status", [
  "in_progress",
  "completed",
  "auto_closed",
  "rejected"
]);

export const attendanceStatus = pgEnum("attendance_status", [
  "in_progress",
  "confirmed",
  "partial",
  "unverified",
  "assumed"
]);

export const hotQrStatus = pgEnum("hot_qr_status", [
  "active",
  "used",
  "expired",
  "revoked",
  "disabled"
]);

export const vehicleStatus = pgEnum("vehicle_status", [
  "active",
  "inactive",
  "blocked"
]);

export const vehiclePermitStatus = pgEnum("vehicle_permit_status", [
  "active",
  "expired",
  "revoked",
  "suspended"
]);

export const adminRole = pgEnum("admin_role", [
  "admin",
  "super_admin"
]);

export const adminStatus = pgEnum("admin_status", [
  "active",
  "disabled"
]);

export const userAccountStatus = pgEnum("user_account_status", [
  "active",
  "disabled"
]);

export const personTypes = pgTable("person_types", {
  code: varchar("code", { length: 40 }).primaryKey(),
  label: varchar("label", { length: 80 }).notNull(),
  requiresCareer: boolean("requires_career").notNull().default(false),
  generatesAttendance: boolean("generates_attendance").notNull().default(false),
  canHaveUserPortal: boolean("can_have_user_portal").notNull().default(false),
  canHaveVehiclePermit: boolean("can_have_vehicle_permit").notNull().default(false),
  isTemporary: boolean("is_temporary").notNull().default(false),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const carreras = pgTable("carreras", {
  id: uuid("id").primaryKey().defaultRandom(),
  clave: varchar("clave", { length: 40 }).notNull(),
  nombre: varchar("nombre", { length: 160 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  claveUnique: uniqueIndex("carreras_clave_unique").on(table.clave),
  activeIdx: index("carreras_active_idx").on(table.active)
}));

export const storedFiles = pgTable("stored_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  driver: varchar("driver", { length: 40 }).notNull(),
  bucket: varchar("bucket", { length: 120 }),
  objectKey: text("object_key").notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  checksumSha256: varchar("checksum_sha256", { length: 64 }),
  visibility: varchar("visibility", { length: 40 }).notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  matricula: varchar("matricula", { length: 50 }).notNull(),
  nombres: varchar("nombres", { length: 120 }).notNull(),
  apellidos: varchar("apellidos", { length: 120 }).notNull().default(""),
  curp: varchar("curp", { length: 18 }),
  tipoPersona: varchar("tipo_persona", { length: 40 })
    .notNull()
    .default("estudiante")
    .references(() => personTypes.code),
  estado: personStatus("estado").notNull().default("activo"),
  carreraId: uuid("carrera_id").references(() => carreras.id),
  notas: text("notas"),
  profileFileId: uuid("profile_file_id").references(() => storedFiles.id),
  fotoPerfilLegacy: text("foto_perfil_legacy"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  matriculaUnique: uniqueIndex("personas_matricula_unique").on(table.matricula),
  tipoEstadoIdx: index("personas_tipo_estado_idx").on(table.tipoPersona, table.estado),
  carreraIdx: index("personas_carrera_idx").on(table.carreraId),
  searchIdx: index("personas_search_idx").on(table.matricula, table.nombres, table.apellidos)
}));

export const administradores = pgTable("administradores", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 80 }).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 180 }),
  passwordHash: text("password_hash").notNull(),
  role: adminRole("role").notNull().default("admin"),
  status: adminStatus("status").notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp("disabled_at", { withTimezone: true })
}, (table) => ({
  usernameUnique: uniqueIndex("administradores_username_unique").on(table.username),
  emailUnique: uniqueIndex("administradores_email_unique").on(table.email),
  statusRoleIdx: index("administradores_status_role_idx").on(table.status, table.role)
}));

export const userAccounts = pgTable("user_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  email: varchar("email", { length: 180 }),
  passwordHash: text("password_hash").notNull(),
  status: userAccountStatus("status").notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp("disabled_at", { withTimezone: true })
}, (table) => ({
  emailUnique: uniqueIndex("user_accounts_email_unique").on(table.email),
  personIdx: index("user_accounts_person_idx").on(table.personId)
}));

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => userAccounts.id),
  sessionHash: text("session_hash").notNull(),
  ipAddress: varchar("ip_address", { length: 80 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  sessionHashUnique: uniqueIndex("user_sessions_hash_unique").on(table.sessionHash),
  accountIdx: index("user_sessions_account_idx").on(table.accountId, table.expiresAt)
}));

export const userDeviceKeys = pgTable("user_device_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => userAccounts.id),
  publicKeyJwk: jsonb("public_key_jwk").notNull(),
  algorithm: varchar("algorithm", { length: 20 }).notNull().default("ES256"),
  label: varchar("label", { length: 120 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  accountStatusIdx: index("user_device_keys_account_status_idx").on(table.accountId, table.status)
}));

export const userDeviceChallenges = pgTable("user_device_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => userDeviceKeys.id),
  accountId: uuid("account_id").notNull().references(() => userAccounts.id),
  challenge: text("challenge").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  challengeUnique: uniqueIndex("user_device_challenges_challenge_unique").on(table.challenge),
  deviceIdx: index("user_device_challenges_device_idx").on(table.deviceId, table.expiresAt)
}));

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => administradores.id),
  sessionHash: text("session_hash").notNull(),
  ipAddress: varchar("ip_address", { length: 80 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  sessionHashUnique: uniqueIndex("admin_sessions_hash_unique").on(table.sessionHash),
  adminIdx: index("admin_sessions_admin_idx").on(table.adminId, table.expiresAt)
}));

export const loginRateLimits = pgTable("login_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  firstFailedAt: timestamp("first_failed_at", { withTimezone: true }).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  lockedUntilIdx: index("login_rate_limits_locked_until_idx").on(table.lockedUntil),
  updatedAtIdx: index("login_rate_limits_updated_at_idx").on(table.updatedAt)
}));

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  clave: varchar("clave", { length: 60 }).notNull(),
  nombre: varchar("nombre", { length: 180 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  claveUnique: uniqueIndex("subjects_clave_unique").on(table.clave),
  activeIdx: index("subjects_active_idx").on(table.active)
}));

export const schedules = pgTable("schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id),
  weekday: integer("weekday").notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFin: time("hora_fin").notNull(),
  aula: varchar("aula", { length: 80 }),
  validFrom: date("valid_from").notNull(),
  validUntil: date("valid_until"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  personDayIdx: index("schedules_person_day_idx").on(table.personId, table.weekday, table.active),
  subjectIdx: index("schedules_subject_idx").on(table.subjectId)
}));

export const qrTokens = pgTable("qr_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  tokenHash: text("token_hash").notNull(),
  jti: uuid("jti").notNull().defaultRandom(),
  tokenVersion: integer("token_version").notNull().default(1),
  status: qrTokenStatus("status").notNull().default("active"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (table) => ({
  hashUnique: uniqueIndex("qr_tokens_hash_unique").on(table.tokenHash),
  personStatusIdx: index("qr_tokens_person_status_idx").on(table.personId, table.status)
}));

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerPersonId: uuid("owner_person_id").notNull().references(() => personas.id),
  plate: varchar("plate", { length: 20 }).notNull(),
  make: varchar("make", { length: 80 }),
  model: varchar("model", { length: 80 }),
  color: varchar("color", { length: 60 }),
  status: vehicleStatus("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  plateUnique: uniqueIndex("vehicles_plate_unique").on(table.plate),
  ownerStatusIdx: index("vehicles_owner_status_idx").on(table.ownerPersonId, table.status)
}));

export const vehiclePermits = pgTable("vehicle_permits", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  status: vehiclePermitStatus("status").notNull().default("active"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  reason: text("reason"),
  createdByAdminId: uuid("created_by_admin_id").references(() => administradores.id),
  revokedByAdminId: uuid("revoked_by_admin_id").references(() => administradores.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  personVehicleIdx: index("vehicle_permits_person_vehicle_idx").on(table.personId, table.vehicleId, table.status),
  vehicleStatusIdx: index("vehicle_permits_vehicle_status_idx").on(table.vehicleId, table.status)
}));

export const vehiclePermitQrTokens = pgTable("vehicle_permit_qr_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  vehiclePermitId: uuid("vehicle_permit_id").notNull().references(() => vehiclePermits.id),
  tokenHash: text("token_hash").notNull(),
  jti: uuid("jti").notNull().defaultRandom(),
  tokenVersion: integer("token_version").notNull().default(1),
  status: qrTokenStatus("status").notNull().default("active"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (table) => ({
  hashUnique: uniqueIndex("vehicle_permit_qr_hash_unique").on(table.tokenHash),
  permitStatusIdx: index("vehicle_permit_qr_permit_status_idx").on(table.vehiclePermitId, table.status)
}));

export const hotQrTokens = pgTable("hot_qr_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitorName: varchar("visitor_name", { length: 160 }).notNull(),
  reason: text("reason").notNull(),
  tokenHash: text("token_hash").notNull(),
  tokenVersion: integer("token_version").notNull().default(1),
  status: hotQrStatus("status").notNull().default("active"),
  maxUses: integer("max_uses").notNull().default(1),
  useCount: integer("use_count").notNull().default(0),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  createdByAdminId: uuid("created_by_admin_id").references(() => administradores.id),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  hashUnique: uniqueIndex("hot_qr_tokens_hash_unique").on(table.tokenHash),
  validStatusIdx: index("hot_qr_tokens_valid_status_idx").on(table.validUntil, table.status),
  visitorIdx: index("hot_qr_tokens_visitor_idx").on(table.visitorName)
}));

export const temporaryDailyQrTokens = pgTable("temporary_daily_qr_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  tokenHash: text("token_hash").notNull(),
  tokenVersion: integer("token_version").notNull().default(1),
  operationalDate: date("operational_date").notNull(),
  missingCredentialType: varchar("missing_credential_type", { length: 80 }).notNull(),
  reasonCode: varchar("reason_code", { length: 80 }).notNull(),
  reasonText: text("reason_text"),
  scope: jsonb("scope").notNull().default(sql`'{}'::jsonb`),
  maxUses: integer("max_uses").notNull().default(1),
  useCount: integer("use_count").notNull().default(0),
  status: qrTokenStatus("status").notNull().default("active"),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByAdminId: uuid("created_by_admin_id").references(() => administradores.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  oneDailyCredential: uniqueIndex("temporary_daily_qr_unique").on(
    table.personId,
    table.operationalDate
  ).where(sql`${table.status} = 'active'`),
  hashUnique: uniqueIndex("temporary_daily_qr_hash_unique").on(table.tokenHash)
}));

export const registrosAcceso = pgTable("registros_acceso", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").references(() => personas.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  vehiclePermitId: uuid("vehicle_permit_id").references(() => vehiclePermits.id),
  hotQrTokenId: uuid("hot_qr_token_id").references(() => hotQrTokens.id),
  matriculaLegacy: varchar("matricula_legacy", { length: 50 }),
  visitorName: varchar("visitor_name", { length: 160 }),
  entradaAt: timestamp("entrada_at", { withTimezone: true }).notNull().defaultNow(),
  salidaAt: timestamp("salida_at", { withTimezone: true }),
  salidaAutomatica: boolean("salida_automatica").notNull().default(false),
  status: accessStatus("status").notNull().default("in_progress"),
  accessMode: accessMode("access_mode").notNull().default("pedestrian"),
  subjectType: accessSubjectType("subject_type").notNull().default("person"),
  credentialType: credentialType("credential_type").notNull(),
  credentialOrigin: varchar("credential_origin", { length: 80 }).notNull(),
  qrTokenId: uuid("qr_token_id").references(() => qrTokens.id),
  vehiclePermitQrTokenId: uuid("vehicle_permit_qr_token_id").references(() => vehiclePermitQrTokens.id),
  temporaryDailyQrTokenId: uuid("temporary_daily_qr_token_id").references(() => temporaryDailyQrTokens.id),
  isExceptionAccess: boolean("is_exception_access").notNull().default(false),
  scannedTokenJti: uuid("scanned_token_jti"),
  adminEntradaId: uuid("admin_entrada_id").references(() => administradores.id),
  adminSalidaId: uuid("admin_salida_id").references(() => administradores.id),
  hashAnterior: text("hash_anterior"),
  hashRegistro: text("hash_registro"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`)
}, (table) => ({
  personEntradaIdx: index("registros_acceso_person_entrada_idx").on(table.personId, table.entradaAt),
  vehicleEntradaIdx: index("registros_acceso_vehicle_entrada_idx").on(table.vehicleId, table.entradaAt),
  statusEntradaIdx: index("registros_acceso_status_entrada_idx").on(table.status, table.entradaAt),
  modeEntradaIdx: index("registros_acceso_mode_entrada_idx").on(table.accessMode, table.entradaAt),
  openByPersonUnique: uniqueIndex("registros_acceso_open_person_unique")
    .on(table.personId)
    .where(sql`${table.salidaAt} is null and ${table.personId} is not null`),
  openByVehicleUnique: uniqueIndex("registros_acceso_open_vehicle_unique")
    .on(table.vehicleId)
    .where(sql`${table.salidaAt} is null and ${table.vehicleId} is not null`)
}));

export const accessScanEvents = pgTable("access_scan_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  registroAccesoId: uuid("registro_acceso_id").references(() => registrosAcceso.id),
  personId: uuid("person_id").references(() => personas.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  credentialType: credentialType("credential_type").notNull(),
  accessMode: accessMode("access_mode").notNull().default("pedestrian"),
  accepted: boolean("accepted").notNull(),
  reasonCode: varchar("reason_code", { length: 80 }).notNull(),
  jti: uuid("jti"),
  kid: varchar("kid", { length: 80 }),
  signatureAlg: varchar("signature_alg", { length: 20 }),
  signatureVerified: boolean("signature_verified"),
  displayPayload: jsonb("display_payload").notNull().default(sql`'{}'::jsonb`),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  scannedAtIdx: index("access_scan_events_scanned_at_idx").on(table.scannedAt),
  personScannedIdx: index("access_scan_events_person_scanned_idx").on(table.personId, table.scannedAt),
  vehicleScannedIdx: index("access_scan_events_vehicle_scanned_idx").on(table.vehicleId, table.scannedAt),
  jtiIdx: index("access_scan_events_jti_idx").on(table.jti)
}));

export const asistenciasPotenciales = pgTable("asistencias_potenciales", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  scheduleId: uuid("schedule_id").references(() => schedules.id),
  subjectId: uuid("subject_id").references(() => subjects.id),
  fechaClase: date("fecha_clase").notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFin: time("hora_fin").notNull(),
  aula: varchar("aula", { length: 80 }),
  estado: attendanceStatus("estado").notNull().default("in_progress"),
  minutosAsistidos: integer("minutos_asistidos").notNull().default(0),
  minutosTotales: integer("minutos_totales").notNull().default(0),
  porcentaje: integer("porcentaje").notNull().default(0),
  registroAccesoId: uuid("registro_acceso_id").references(() => registrosAcceso.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  asistenciaLookupIdx: index("asistencias_lookup_idx").on(table.personId, table.fechaClase, table.estado),
  subjectDateIdx: index("asistencias_subject_date_idx").on(table.subjectId, table.fechaClase)
}));

export const operationalConfig = pgTable("operational_config", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull().default(sql`'{}'::jsonb`),
  description: text("description"),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => administradores.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorAdminId: uuid("actor_admin_id").references(() => administradores.id),
  actorAccountId: uuid("actor_account_id").references(() => userAccounts.id),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  ipAddress: varchar("ip_address", { length: 80 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  auditCreatedIdx: index("audit_log_created_idx").on(table.createdAt),
  auditEntityIdx: index("audit_log_entity_idx").on(table.entityType, table.entityId)
}));

export const qrSigningKeys = pgTable("qr_signing_keys", {
  kid: varchar("kid", { length: 80 }).primaryKey(),
  algorithm: varchar("algorithm", { length: 20 }).notNull().default("ES256"),
  publicKeyJwk: jsonb("public_key_jwk").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true })
}, (table) => ({
  statusIdx: index("qr_signing_keys_status_idx").on(table.status)
}));

export const qrJtiConsumptions = pgTable("qr_jti_consumptions", {
  jti: uuid("jti").primaryKey(),
  credentialType: credentialType("credential_type").notNull(),
  personId: uuid("person_id").references(() => personas.id),
  vehiclePermitId: uuid("vehicle_permit_id").references(() => vehiclePermits.id),
  hotQrId: uuid("hot_qr_id").references(() => hotQrTokens.id),
  temporaryDailyQrId: uuid("temporary_daily_qr_id").references(() => temporaryDailyQrTokens.id),
  scannerId: varchar("scanner_id", { length: 120 }),
  accessRecordId: uuid("access_record_id").references(() => registrosAcceso.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull().defaultNow(),
  rejectedReason: varchar("rejected_reason", { length: 80 }),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`)
}, (table) => ({
  expiresIdx: index("qr_jti_expires_idx").on(table.expiresAt),
  personIdx: index("qr_jti_person_idx").on(table.personId, table.consumedAt)
}));
