CREATE TYPE "public"."access_mode" AS ENUM('pedestrian', 'vehicle', 'visitor', 'manual');--> statement-breakpoint
CREATE TYPE "public"."access_status" AS ENUM('in_progress', 'completed', 'auto_closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."access_subject_type" AS ENUM('person', 'vehicle_permit', 'visitor', 'exception');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."admin_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('in_progress', 'confirmed', 'partial', 'unverified', 'assumed');--> statement-breakpoint
CREATE TYPE "public"."credential_type" AS ENUM('legacy_static_qr', 'person_qr', 'vehicle_permit_qr', 'hot_qr', 'temporary_daily_qr', 'manual_override');--> statement-breakpoint
CREATE TYPE "public"."hot_qr_status" AS ENUM('active', 'used', 'expired', 'revoked', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('activo', 'inactivo', 'suspendido', 'egresado', 'baja');--> statement-breakpoint
CREATE TYPE "public"."qr_token_status" AS ENUM('active', 'revoked', 'expired', 'rotated');--> statement-breakpoint
CREATE TYPE "public"."vehicle_permit_status" AS ENUM('active', 'expired', 'revoked', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
CREATE TABLE "access_scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registro_acceso_id" uuid,
	"person_id" uuid,
	"vehicle_id" uuid,
	"credential_type" "credential_type" NOT NULL,
	"access_mode" "access_mode" DEFAULT 'pedestrian' NOT NULL,
	"accepted" boolean NOT NULL,
	"reason_code" varchar(80) NOT NULL,
	"display_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"session_hash" text NOT NULL,
	"ip_address" varchar(80),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "administradores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(80) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"email" varchar(180),
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"status" "admin_status" DEFAULT 'active' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "asistencias_potenciales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"schedule_id" uuid,
	"subject_id" uuid,
	"fecha_clase" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"aula" varchar(80),
	"estado" "attendance_status" DEFAULT 'in_progress' NOT NULL,
	"minutos_asistidos" integer DEFAULT 0 NOT NULL,
	"minutos_totales" integer DEFAULT 0 NOT NULL,
	"porcentaje" integer DEFAULT 0 NOT NULL,
	"registro_acceso_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_id" uuid,
	"actor_account_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carreras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clave" varchar(40) NOT NULL,
	"nombre" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hot_qr_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_name" varchar(160) NOT NULL,
	"reason" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "hot_qr_status" DEFAULT 'active' NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"created_by_admin_id" uuid,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_config" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"updated_by_admin_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_types" (
	"code" varchar(40) PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"requires_career" boolean DEFAULT false NOT NULL,
	"generates_attendance" boolean DEFAULT false NOT NULL,
	"can_have_user_portal" boolean DEFAULT false NOT NULL,
	"can_have_vehicle_permit" boolean DEFAULT false NOT NULL,
	"is_temporary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matricula" varchar(50) NOT NULL,
	"nombres" varchar(120) NOT NULL,
	"apellidos" varchar(120) DEFAULT '' NOT NULL,
	"curp" varchar(18),
	"tipo_persona" varchar(40) DEFAULT 'estudiante' NOT NULL,
	"estado" "person_status" DEFAULT 'activo' NOT NULL,
	"carrera_id" uuid,
	"notas" text,
	"profile_file_id" uuid,
	"foto_perfil_legacy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"jti" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" "qr_token_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "registros_acceso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"vehicle_id" uuid,
	"vehicle_permit_id" uuid,
	"hot_qr_token_id" uuid,
	"matricula_legacy" varchar(50),
	"visitor_name" varchar(160),
	"entrada_at" timestamp with time zone DEFAULT now() NOT NULL,
	"salida_at" timestamp with time zone,
	"salida_automatica" boolean DEFAULT false NOT NULL,
	"status" "access_status" DEFAULT 'in_progress' NOT NULL,
	"access_mode" "access_mode" DEFAULT 'pedestrian' NOT NULL,
	"subject_type" "access_subject_type" DEFAULT 'person' NOT NULL,
	"credential_type" "credential_type" NOT NULL,
	"credential_origin" varchar(80) NOT NULL,
	"qr_token_id" uuid,
	"vehicle_permit_qr_token_id" uuid,
	"temporary_daily_qr_token_id" uuid,
	"is_exception_access" boolean DEFAULT false NOT NULL,
	"scanned_token_jti" uuid,
	"admin_entrada_id" uuid,
	"admin_salida_id" uuid,
	"hash_anterior" text,
	"hash_registro" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"aula" varchar(80),
	"valid_from" date NOT NULL,
	"valid_until" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver" varchar(40) NOT NULL,
	"bucket" varchar(120),
	"object_key" text NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" varchar(64),
	"visibility" varchar(40) DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clave" varchar(60) NOT NULL,
	"nombre" varchar(180) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temporary_daily_qr_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"operational_date" date NOT NULL,
	"missing_credential_type" varchar(80) NOT NULL,
	"reason_code" varchar(80) NOT NULL,
	"reason_text" text,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"status" "qr_token_status" DEFAULT 'active' NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"email" varchar(180),
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicle_permit_qr_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_permit_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"jti" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" "qr_token_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicle_permits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"status" "vehicle_permit_status" DEFAULT 'active' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"reason" text,
	"created_by_admin_id" uuid,
	"revoked_by_admin_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_person_id" uuid NOT NULL,
	"plate" varchar(20) NOT NULL,
	"make" varchar(80),
	"model" varchar(80),
	"color" varchar(60),
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_scan_events" ADD CONSTRAINT "access_scan_events_registro_acceso_id_registros_acceso_id_fk" FOREIGN KEY ("registro_acceso_id") REFERENCES "public"."registros_acceso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_scan_events" ADD CONSTRAINT "access_scan_events_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_scan_events" ADD CONSTRAINT "access_scan_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_administradores_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias_potenciales" ADD CONSTRAINT "asistencias_potenciales_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias_potenciales" ADD CONSTRAINT "asistencias_potenciales_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias_potenciales" ADD CONSTRAINT "asistencias_potenciales_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias_potenciales" ADD CONSTRAINT "asistencias_potenciales_registro_acceso_id_registros_acceso_id_fk" FOREIGN KEY ("registro_acceso_id") REFERENCES "public"."registros_acceso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_admin_id_administradores_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hot_qr_tokens" ADD CONSTRAINT "hot_qr_tokens_created_by_admin_id_administradores_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_config" ADD CONSTRAINT "operational_config_updated_by_admin_id_administradores_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_tipo_persona_person_types_code_fk" FOREIGN KEY ("tipo_persona") REFERENCES "public"."person_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_carrera_id_carreras_id_fk" FOREIGN KEY ("carrera_id") REFERENCES "public"."carreras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_profile_file_id_stored_files_id_fk" FOREIGN KEY ("profile_file_id") REFERENCES "public"."stored_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_vehicle_permit_id_vehicle_permits_id_fk" FOREIGN KEY ("vehicle_permit_id") REFERENCES "public"."vehicle_permits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_hot_qr_token_id_hot_qr_tokens_id_fk" FOREIGN KEY ("hot_qr_token_id") REFERENCES "public"."hot_qr_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_qr_token_id_qr_tokens_id_fk" FOREIGN KEY ("qr_token_id") REFERENCES "public"."qr_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_vehicle_permit_qr_token_id_vehicle_permit_qr_tokens_id_fk" FOREIGN KEY ("vehicle_permit_qr_token_id") REFERENCES "public"."vehicle_permit_qr_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_temporary_daily_qr_token_id_temporary_daily_qr_tokens_id_fk" FOREIGN KEY ("temporary_daily_qr_token_id") REFERENCES "public"."temporary_daily_qr_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_admin_entrada_id_administradores_id_fk" FOREIGN KEY ("admin_entrada_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_acceso" ADD CONSTRAINT "registros_acceso_admin_salida_id_administradores_id_fk" FOREIGN KEY ("admin_salida_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_daily_qr_tokens" ADD CONSTRAINT "temporary_daily_qr_tokens_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_daily_qr_tokens" ADD CONSTRAINT "temporary_daily_qr_tokens_created_by_admin_id_administradores_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_permit_qr_tokens" ADD CONSTRAINT "vehicle_permit_qr_tokens_vehicle_permit_id_vehicle_permits_id_fk" FOREIGN KEY ("vehicle_permit_id") REFERENCES "public"."vehicle_permits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_permits" ADD CONSTRAINT "vehicle_permits_person_id_personas_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_permits" ADD CONSTRAINT "vehicle_permits_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_permits" ADD CONSTRAINT "vehicle_permits_created_by_admin_id_administradores_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_permits" ADD CONSTRAINT "vehicle_permits_revoked_by_admin_id_administradores_id_fk" FOREIGN KEY ("revoked_by_admin_id") REFERENCES "public"."administradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_person_id_personas_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_scan_events_scanned_at_idx" ON "access_scan_events" USING btree ("scanned_at");--> statement-breakpoint
CREATE INDEX "access_scan_events_person_scanned_idx" ON "access_scan_events" USING btree ("person_id","scanned_at");--> statement-breakpoint
CREATE INDEX "access_scan_events_vehicle_scanned_idx" ON "access_scan_events" USING btree ("vehicle_id","scanned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_hash_unique" ON "admin_sessions" USING btree ("session_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "administradores_username_unique" ON "administradores" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "administradores_email_unique" ON "administradores" USING btree ("email");--> statement-breakpoint
CREATE INDEX "administradores_status_role_idx" ON "administradores" USING btree ("status","role");--> statement-breakpoint
CREATE INDEX "asistencias_lookup_idx" ON "asistencias_potenciales" USING btree ("person_id","fecha_clase","estado");--> statement-breakpoint
CREATE INDEX "asistencias_subject_date_idx" ON "asistencias_potenciales" USING btree ("subject_id","fecha_clase");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carreras_clave_unique" ON "carreras" USING btree ("clave");--> statement-breakpoint
CREATE INDEX "carreras_active_idx" ON "carreras" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "hot_qr_tokens_hash_unique" ON "hot_qr_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "hot_qr_tokens_valid_status_idx" ON "hot_qr_tokens" USING btree ("valid_until","status");--> statement-breakpoint
CREATE INDEX "hot_qr_tokens_visitor_idx" ON "hot_qr_tokens" USING btree ("visitor_name");--> statement-breakpoint
CREATE UNIQUE INDEX "personas_matricula_unique" ON "personas" USING btree ("matricula");--> statement-breakpoint
CREATE INDEX "personas_tipo_estado_idx" ON "personas" USING btree ("tipo_persona","estado");--> statement-breakpoint
CREATE INDEX "personas_carrera_idx" ON "personas" USING btree ("carrera_id");--> statement-breakpoint
CREATE INDEX "personas_search_idx" ON "personas" USING btree ("matricula","nombres","apellidos");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_tokens_hash_unique" ON "qr_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "qr_tokens_person_status_idx" ON "qr_tokens" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX "registros_acceso_person_entrada_idx" ON "registros_acceso" USING btree ("person_id","entrada_at");--> statement-breakpoint
CREATE INDEX "registros_acceso_vehicle_entrada_idx" ON "registros_acceso" USING btree ("vehicle_id","entrada_at");--> statement-breakpoint
CREATE INDEX "registros_acceso_status_entrada_idx" ON "registros_acceso" USING btree ("status","entrada_at");--> statement-breakpoint
CREATE INDEX "registros_acceso_mode_entrada_idx" ON "registros_acceso" USING btree ("access_mode","entrada_at");--> statement-breakpoint
CREATE UNIQUE INDEX "registros_acceso_open_person_unique" ON "registros_acceso" USING btree ("person_id") WHERE "registros_acceso"."salida_at" is null and "registros_acceso"."person_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "registros_acceso_open_vehicle_unique" ON "registros_acceso" USING btree ("vehicle_id") WHERE "registros_acceso"."salida_at" is null and "registros_acceso"."vehicle_id" is not null;--> statement-breakpoint
CREATE INDEX "schedules_person_day_idx" ON "schedules" USING btree ("person_id","weekday","active");--> statement-breakpoint
CREATE INDEX "schedules_subject_idx" ON "schedules" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_clave_unique" ON "subjects" USING btree ("clave");--> statement-breakpoint
CREATE INDEX "subjects_active_idx" ON "subjects" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "temporary_daily_qr_unique" ON "temporary_daily_qr_tokens" USING btree ("person_id","operational_date");--> statement-breakpoint
CREATE UNIQUE INDEX "temporary_daily_qr_hash_unique" ON "temporary_daily_qr_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_email_unique" ON "user_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_accounts_person_idx" ON "user_accounts" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_permit_qr_hash_unique" ON "vehicle_permit_qr_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "vehicle_permit_qr_permit_status_idx" ON "vehicle_permit_qr_tokens" USING btree ("vehicle_permit_id","status");--> statement-breakpoint
CREATE INDEX "vehicle_permits_person_vehicle_idx" ON "vehicle_permits" USING btree ("person_id","vehicle_id","status");--> statement-breakpoint
CREATE INDEX "vehicle_permits_vehicle_status_idx" ON "vehicle_permits" USING btree ("vehicle_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_plate_unique" ON "vehicles" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "vehicles_owner_status_idx" ON "vehicles" USING btree ("owner_person_id","status");--> statement-breakpoint
INSERT INTO "person_types" (
	"code",
	"label",
	"requires_career",
	"generates_attendance",
	"can_have_user_portal",
	"can_have_vehicle_permit",
	"is_temporary",
	"active"
) VALUES
	('estudiante', 'Estudiante', true, true, true, true, false, true),
	('aspirante', 'Aspirante', false, false, true, true, false, true),
	('docente', 'Docente', false, false, true, true, false, true),
	('administrativo', 'Administrativo', false, false, true, true, false, true),
	('invitado', 'Invitado', false, false, false, false, true, true),
	('otro', 'Otro', false, false, false, false, false, true)
ON CONFLICT ("code") DO UPDATE SET
	"label" = EXCLUDED."label",
	"requires_career" = EXCLUDED."requires_career",
	"generates_attendance" = EXCLUDED."generates_attendance",
	"can_have_user_portal" = EXCLUDED."can_have_user_portal",
	"can_have_vehicle_permit" = EXCLUDED."can_have_vehicle_permit",
	"is_temporary" = EXCLUDED."is_temporary",
	"active" = EXCLUDED."active",
	"updated_at" = now();
