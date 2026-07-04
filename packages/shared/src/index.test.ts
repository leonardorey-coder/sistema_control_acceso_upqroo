import { describe, expect, it } from "bun:test";
import type {
  AdminRowPayload,
  AdminSessionPayload,
  AdminSessionRowPayload,
  ApiHealth,
  AttendanceRowPayload,
  AuditLogRowPayload,
  CareerRowPayload,
  HotQrRowPayload,
  OperationalConfigPayload,
  PaginatedResponse,
  PersonCredentialRowPayload,
  PersonRowPayload,
  PersonTypeRowPayload,
  ScannerResultPayload,
  VehiclePermitRowPayload,
  VehicleRowPayload
} from ".";

describe("shared contracts", () => {
  it("supports the health contract", () => {
    const payload: ApiHealth = {
      ok: true,
      service: "control-acceso-api",
      version: "0.1.0",
      checkedAt: new Date(0).toISOString()
    };

    expect(payload.ok).toBe(true);
  });

  it("supports paginated table contracts", () => {
    const payload: PaginatedResponse<{ id: string }> = {
      rows: [{ id: "row-1" }],
      total: 1,
      page: 1,
      pageSize: 25,
      summary: { filtered: false }
    };

    expect(payload.rows[0]?.id).toBe("row-1");
  });

  it("supports auth and scanner wire shapes", () => {
    const session: AdminSessionPayload = {
      sessionId: "session-1",
      admin: {
        id: "admin-1",
        username: "superadmin",
        displayName: "Super Admin",
        role: "super_admin",
        mustChangePassword: false
      },
      expiresAt: new Date(0).toISOString()
    };
    const scan: ScannerResultPayload = {
      accepted: true,
      action: "entry",
      reasonCode: "ACCESS_GRANTED",
      vehiclePlate: "ABC-123",
      vehicleType: "car",
      vehicleColor: "Rojo",
      vehicleMake: "Nissan",
      vehicleModel: "NP300",
      timestamp: new Date(0).toISOString()
    };

    expect(session.admin.role).toBe("super_admin");
    expect(session.sessionId).toBe("session-1");
    expect(scan.accepted).toBe(true);
    expect(scan.vehicleType).toBe("car");
  });

  it("supports attendance table rows", () => {
    const row: AttendanceRowPayload = {
      id: "attendance-1",
      matricula: "202300120",
      nombres: "Nombre",
      apellidos: "Apellido",
      fechaClase: "2026-06-20",
      horaInicio: "08:00",
      horaFin: "09:00",
      porcentaje: 100,
      minutosAsistidos: 60,
      minutosTotales: 60,
      estado: "confirmed"
    };

    expect(row.estado).toBe("confirmed");
  });

  it("supports person, career and credential row contracts", () => {
    const personType: PersonTypeRowPayload = {
      code: "estudiante",
      label: "Estudiante",
      requiresCareer: true,
      generatesAttendance: true,
      canHaveUserPortal: true,
      canHaveVehiclePermit: true,
      isTemporary: false,
      active: true
    };
    const career: CareerRowPayload = {
      id: "career-1",
      clave: "ISC",
      nombre: "Ingenieria en Software",
      active: true
    };
    const person: PersonRowPayload = {
      id: "person-1",
      matricula: "202300120",
      nombres: "Nombre",
      apellidos: "Apellido",
      tipoPersona: personType.code,
      estado: "activo",
      carreraId: career.id,
      carrera: career.nombre,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
    const credential: PersonCredentialRowPayload = {
      id: "credential-1",
      personId: person.id,
      status: "active",
      issuedAt: new Date(0).toISOString(),
      expiresAt: new Date(1).toISOString(),
      tokenVersion: 1
    };

    expect(personType.requiresCareer).toBe(true);
    expect(person.carreraId).toBe(career.id);
    expect("tokenHash" in credential).toBe(false);
  });

  it("supports Hot-QR, vehicle and operational config contracts", () => {
    const hotQr: HotQrRowPayload = {
      id: "hotqr-1",
      visitorName: "Visitante",
      reason: "Reunion",
      status: "active",
      maxUses: 1,
      useCount: 0,
      validFrom: new Date(0).toISOString(),
      validUntil: new Date(1).toISOString(),
      creator: "Admin",
      createdAt: new Date(0).toISOString()
    };
    const vehicle: VehicleRowPayload = {
      id: "vehicle-1",
      ownerPersonId: "person-1",
      plate: "ABC-123",
      vehicleType: "car",
      status: "active",
      approvalStatus: "approved",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
    const permit: VehiclePermitRowPayload = {
      id: "permit-1",
      personId: "person-1",
      vehicleId: vehicle.id,
      status: "active",
      permitType: "standard",
      validFrom: new Date(0).toISOString(),
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
    const config: OperationalConfigPayload = {
      retryEnabled: true,
      retryDelayMs: 1200,
      cameraEnabled: true,
      manualEntryEnabled: true,
      soundsEnabled: true,
      autoExitEnabled: true
    };

    expect(hotQr.status).toBe("active");
    expect(permit.vehicleId).toBe(vehicle.id);
    expect(config.retryDelayMs).toBeGreaterThanOrEqual(250);
  });

  it("supports admin portal row contracts without secrets", () => {
    const admin: AdminRowPayload = {
      id: "admin-1",
      username: "operador",
      displayName: "Operador",
      email: "operador@upqroo.edu.mx",
      role: "admin",
      status: "active",
      mustChangePassword: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
    const session: AdminSessionRowPayload = {
      id: "session-1",
      adminId: admin.id,
      ipAddress: "127.0.0.1",
      expiresAt: new Date(0).toISOString(),
      createdAt: new Date(0).toISOString()
    };
    const audit: AuditLogRowPayload = {
      id: "audit-1",
      actorAdminId: admin.id,
      actorAccountId: null,
      action: "admin.created",
      entityType: "admin",
      entityId: admin.id,
      metadata: { role: admin.role },
      createdAt: new Date(0).toISOString()
    };

    expect("passwordHash" in admin).toBe(false);
    expect("sessionHash" in session).toBe(false);
    expect("actorUserAccountId" in audit).toBe(false);
    expect(audit.action).toBe("admin.created");
  });
});
