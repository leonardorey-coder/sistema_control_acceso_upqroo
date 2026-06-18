export type SeedPersonType = {
  code: string;
  label: string;
  requiresCareer: boolean;
  generatesAttendance: boolean;
  canHaveUserPortal: boolean;
  canHaveVehiclePermit: boolean;
  isTemporary: boolean;
  active: boolean;
};

export const seedPersonTypes = [
  {
    code: "estudiante",
    label: "Estudiante",
    requiresCareer: true,
    generatesAttendance: true,
    canHaveUserPortal: true,
    canHaveVehiclePermit: true,
    isTemporary: false,
    active: true
  },
  {
    code: "aspirante",
    label: "Aspirante",
    requiresCareer: false,
    generatesAttendance: false,
    canHaveUserPortal: true,
    canHaveVehiclePermit: true,
    isTemporary: false,
    active: true
  },
  {
    code: "docente",
    label: "Docente",
    requiresCareer: false,
    generatesAttendance: false,
    canHaveUserPortal: true,
    canHaveVehiclePermit: true,
    isTemporary: false,
    active: true
  },
  {
    code: "administrativo",
    label: "Administrativo",
    requiresCareer: false,
    generatesAttendance: false,
    canHaveUserPortal: true,
    canHaveVehiclePermit: true,
    isTemporary: false,
    active: true
  },
  {
    code: "invitado",
    label: "Invitado",
    requiresCareer: false,
    generatesAttendance: false,
    canHaveUserPortal: false,
    canHaveVehiclePermit: false,
    isTemporary: true,
    active: true
  },
  {
    code: "otro",
    label: "Otro",
    requiresCareer: false,
    generatesAttendance: false,
    canHaveUserPortal: false,
    canHaveVehiclePermit: false,
    isTemporary: false,
    active: true
  }
] satisfies SeedPersonType[];
