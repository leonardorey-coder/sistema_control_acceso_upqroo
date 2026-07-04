export type ApiHealth = {
  ok: true;
  service: "control-acceso-api";
  version: string;
  checkedAt: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type PaginatedResponse<Row, Summary = Record<string, unknown>> = {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  summary?: Summary;
};

export type AdminSessionPayload = {
  sessionId: string;
  admin: {
    id: string;
    username: string;
    displayName: string;
    email?: string | null;
    role: "admin" | "super_admin";
    mustChangePassword: boolean;
  };
  expiresAt: string;
};

export type PortalSessionPayload = {
  user: {
    accountId: string;
    personId: string;
    email: string;
    matricula: string;
    fullName: string;
    personType: string;
    status: string;
    mustChangePassword: boolean;
  };
  expiresAt: string;
};

export type ScannerResultPayload = {
  accepted: boolean;
  action?: "entry" | "exit" | "rejected";
  reasonCode: string;
  registroId?: string;
  personId?: string;
  matricula?: string;
  fullName?: string;
  personType?: string;
  career?: string | null;
  vehiclePlate?: string | null;
  vehicleType?: VehicleType | string | null;
  vehicleColor?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  profilePhotoUrl?: string | null;
  credentialType?: string;
  accessMode?: string;
  timestamp: string;
};

export type AttendanceStatus = "in_progress" | "confirmed" | "partial" | "unverified" | "assumed";

export type AttendanceRowPayload = {
  id: string;
  matricula: string;
  nombres: string;
  apellidos: string;
  carrera?: string | null;
  subjectClave?: string | null;
  subjectName?: string | null;
  aula?: string | null;
  fechaClase: string;
  horaInicio: string;
  horaFin: string;
  porcentaje: number;
  minutosAsistidos: number;
  minutosTotales: number;
  estado: AttendanceStatus;
  confirmedAt?: string | null;
};

export type PersonStatus = "activo" | "inactivo" | "suspendido" | "egresado" | "baja";

export type PersonTypeRowPayload = {
  code: string;
  label: string;
  requiresCareer: boolean;
  generatesAttendance: boolean;
  canHaveUserPortal: boolean;
  canHaveVehiclePermit: boolean;
  isTemporary: boolean;
  active: boolean;
};

export type CareerRowPayload = {
  id: string;
  clave: string;
  nombre: string;
  active: boolean;
};

export type PersonRowPayload = {
  id: string;
  matricula: string;
  nombres: string;
  apellidos: string;
  curp?: string | null;
  tipoPersona: string;
  tipoPersonaLabel?: string | null;
  estado: PersonStatus;
  carreraId?: string | null;
  carrera?: string | null;
  notas?: string | null;
  profileFileId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CredentialStatus = "active" | "revoked" | "expired";

export type PersonCredentialRowPayload = {
  id: string;
  personId: string;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  tokenVersion: number;
};

export type TemporaryDailyQrRowPayload = {
  id: string;
  personId: string;
  operationalDate: string;
  missingCredentialType: string;
  reasonCode: string;
  reasonText?: string | null;
  maxUses: number;
  useCount: number;
  status: CredentialStatus | "used";
  validUntil: string;
  revokedAt?: string | null;
  createdAt: string;
};

export type HotQrStatus = "active" | "used" | "expired" | "revoked" | "disabled";

export type HotQrRowPayload = {
  id: string;
  visitorName: string;
  reason: string;
  status: HotQrStatus;
  maxUses: number;
  useCount: number;
  validFrom: string;
  validUntil: string;
  creator?: string | null;
  usedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type VehicleStatus = "active" | "inactive" | "blocked";
export type VehicleType = "car" | "motorcycle" | "bicycle" | "electric_scooter" | "truck" | "official" | "university_transport" | "visitor" | "other";
export type VehicleApprovalStatus = "pending" | "approved" | "rejected";

export type VehicleRowPayload = {
  id: string;
  ownerPersonId: string;
  plate: string;
  vehicleType: VehicleType;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  status: VehicleStatus;
  approvalStatus: VehicleApprovalStatus;
  registeredByAdminId?: string | null;
  approvedByAdminId?: string | null;
  approvedAt?: string | null;
  rejectedByAdminId?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  deletedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehiclePermitStatus = "active" | "revoked" | "expired" | "suspended";
export type VehiclePermitType = "standard" | "temporary" | "official" | "visitor" | "provider" | "event" | "emergency";

export type VehiclePermitRowPayload = {
  id: string;
  personId: string;
  vehicleId: string;
  status: VehiclePermitStatus;
  permitType: VehiclePermitType;
  validFrom: string;
  validUntil?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleVisitorPermitStatus = "active" | "expired" | "revoked";

export type VehicleVisitorPermitRowPayload = {
  id: string;
  hotQrTokenId: string;
  visitorName: string;
  plate: string;
  vehicleType: VehicleType;
  color?: string | null;
  reason: string;
  status: VehicleVisitorPermitStatus;
  validFrom: string;
  validUntil: string;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  hotQrStatus?: HotQrStatus;
};

export type OperationalConfigPayload = {
  retryEnabled: boolean;
  retryDelayMs: number;
  cameraEnabled: boolean;
  manualEntryEnabled: boolean;
  soundsEnabled: boolean;
  autoExitEnabled: boolean;
};

export type SignedQrConfigPayload = {
  enabled: boolean;
  ttlSeconds: number;
  clockToleranceSeconds: number;
  compatibilityOpaqueTokens: boolean;
  requireDeviceBinding: boolean;
};

export type ScannerDeviceStatus = "pending" | "active" | "disabled" | "revoked";

export type ScannerDeviceRowPayload = {
  id: string;
  code: string;
  label: string;
  algorithm: "ES256";
  status: ScannerDeviceStatus;
  createdBy?: string | null;
  requestedByAdminId?: string | null;
  registeredByAdminId?: string | null;
  approvedByAdminId?: string | null;
  revokedByAdminId?: string | null;
  lastSeenAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  registeredAt?: string | null;
  approvedAt?: string | null;
  revokedAt?: string | null;
};

export type ScannerDevicesConfigPayload = {
  required: boolean;
};

export type AdminRole = "admin" | "super_admin";
export type AdminStatus = "active" | "disabled";

export type AdminRowPayload = {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  role: AdminRole;
  status: AdminStatus;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  disabledAt?: string | null;
};

export type AdminSessionRowPayload = {
  id: string;
  adminId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
};

export type AuditLogRowPayload = {
  id: string;
  actorAdminId?: string | null;
  actorAccountId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};
