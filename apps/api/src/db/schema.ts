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
import { sql } from "drizzle-orm";

export const personType = pgEnum("person_type", [
  "estudiante",
  "docente",
  "administrativo",
  "invitado",
  "aspirante",
  "otro"
]);

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
  "expired"
]);

export const credentialType = pgEnum("credential_type", [
  "legacy_static_qr",
  "dynamic_qr",
  "hot_qr",
  "temporary_qr",
  "manual"
]);

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  matricula: varchar("matricula", { length: 50 }).notNull(),
  nombre: varchar("nombre", { length: 160 }).notNull(),
  curp: varchar("curp", { length: 18 }),
  tipoPersona: personType("tipo_persona").notNull().default("estudiante"),
  estado: personStatus("estado").notNull().default("activo"),
  profileFileId: uuid("profile_file_id"),
  fotoPerfilLegacy: text("foto_perfil_legacy"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  matriculaUnique: uniqueIndex("personas_matricula_unique").on(table.matricula),
  tipoEstadoIdx: index("personas_tipo_estado_idx").on(table.tipoPersona, table.estado)
}));

export const userAccounts = pgTable("user_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  email: varchar("email", { length: 180 }),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp("disabled_at", { withTimezone: true })
}, (table) => ({
  emailUnique: uniqueIndex("user_accounts_email_unique").on(table.email)
}));

export const adminSessions = pgTable("admin_sessions", {
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
  sessionHashUnique: uniqueIndex("admin_sessions_hash_unique").on(table.sessionHash)
}));

export const qrTokens = pgTable("qr_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  tokenHash: text("token_hash").notNull(),
  jti: uuid("jti").notNull().defaultRandom(),
  status: qrTokenStatus("status").notNull().default("active"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (table) => ({
  hashUnique: uniqueIndex("qr_tokens_hash_unique").on(table.tokenHash),
  personStatusIdx: index("qr_tokens_person_status_idx").on(table.personId, table.status)
}));

export const temporaryAccessCredentials = pgTable("temporary_access_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  tokenHash: text("token_hash").notNull(),
  operationalDate: date("operational_date").notNull(),
  missingCredentialType: varchar("missing_credential_type", { length: 80 }).notNull(),
  reasonCode: varchar("reason_code", { length: 80 }).notNull(),
  reasonText: text("reason_text"),
  scope: jsonb("scope").notNull().default(sql`'{}'::jsonb`),
  maxUses: integer("max_uses").notNull().default(1),
  useCount: integer("use_count").notNull().default(0),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  oneDailyCredential: uniqueIndex("temporary_access_daily_unique").on(
    table.personId,
    table.operationalDate
  )
}));

export const registrosAcceso = pgTable("registros_acceso", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  matriculaLegacy: varchar("matricula_legacy", { length: 50 }),
  entradaAt: timestamp("entrada_at", { withTimezone: true }).notNull().defaultNow(),
  salidaAt: timestamp("salida_at", { withTimezone: true }),
  salidaAutomatica: boolean("salida_automatica").notNull().default(false),
  credentialType: credentialType("credential_type").notNull(),
  credentialOrigin: varchar("credential_origin", { length: 80 }).notNull(),
  qrTokenId: uuid("qr_token_id").references(() => qrTokens.id),
  temporaryCredentialId: uuid("temporary_credential_id").references(() => temporaryAccessCredentials.id),
  isExceptionAccess: boolean("is_exception_access").notNull().default(false),
  scannedTokenJti: uuid("scanned_token_jti"),
  integrityHash: text("integrity_hash")
}, (table) => ({
  personEntradaIdx: index("registros_acceso_person_entrada_idx").on(table.personId, table.entradaAt),
  openByPersonUnique: uniqueIndex("registros_acceso_open_person_unique")
    .on(table.personId)
    .where(sql`${table.salidaAt} is null`)
}));

export const accessScanEvents = pgTable("access_scan_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").references(() => personas.id),
  credentialType: credentialType("credential_type").notNull(),
  accepted: boolean("accepted").notNull(),
  reasonCode: varchar("reason_code", { length: 80 }).notNull(),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  scannedAtIdx: index("access_scan_events_scanned_at_idx").on(table.scannedAt),
  personScannedIdx: index("access_scan_events_person_scanned_idx").on(table.personId, table.scannedAt)
}));

export const asistenciasPotenciales = pgTable("asistencias_potenciales", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id").notNull().references(() => personas.id),
  fechaClase: date("fecha_clase").notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFin: time("hora_fin").notNull(),
  estado: varchar("estado", { length: 40 }).notNull(),
  registroAccesoId: uuid("registro_acceso_id").references(() => registrosAcceso.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  asistenciaLookupIdx: index("asistencias_lookup_idx").on(table.personId, table.fechaClase, table.estado)
}));

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorAccountId: uuid("actor_account_id").references(() => userAccounts.id),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  auditCreatedIdx: index("audit_log_created_idx").on(table.createdAt)
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
  ownerPersonId: uuid("owner_person_id").references(() => personas.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
