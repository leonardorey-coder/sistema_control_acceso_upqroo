import { eq } from "drizzle-orm";
import { env } from "./config/env";
import { closeDb, db } from "./db/client";
import { seedPersonTypes } from "./db/seeds/person-types.seed";
import { administradores, operationalConfig, personTypes } from "./db/schema";

async function seedPersonTypesCatalog() {
  for (const seed of seedPersonTypes) {
    await db
      .insert(personTypes)
      .values(seed)
      .onConflictDoUpdate({
        target: personTypes.code,
        set: {
          label: seed.label,
          requiresCareer: seed.requiresCareer,
          generatesAttendance: seed.generatesAttendance,
          canHaveUserPortal: seed.canHaveUserPortal,
          canHaveVehiclePermit: seed.canHaveVehiclePermit,
          isTemporary: seed.isTemporary,
          active: seed.active,
          updatedAt: new Date()
        }
      });
  }
}

async function seedOperationalConfig() {
  await db.insert(operationalConfig)
    .values({
      key: "scanner",
      value: {
        retryEnabled: true,
        retryDelayMs: 1200,
        cameraEnabled: true,
        manualEntryEnabled: true,
        soundsEnabled: true,
        autoExitEnabled: true
      },
      description: "Scanner and access operation defaults"
    })
    .onConflictDoNothing();
}

async function seedInitialAdmin() {
  const existing = await db.query.administradores.findFirst({
    where: eq(administradores.username, env.INITIAL_ADMIN_USERNAME)
  });

  if (existing) {
    return;
  }

  const passwordHash = await Bun.password.hash(env.INITIAL_ADMIN_PASSWORD, {
    algorithm: "bcrypt",
    cost: 10
  });

  await db.insert(administradores).values({
    username: env.INITIAL_ADMIN_USERNAME,
    displayName: "Super Administrador",
    passwordHash,
    role: "super_admin",
    status: "active",
    mustChangePassword: true
  });
}

async function main() {
  await seedPersonTypesCatalog();
  await seedOperationalConfig();
  await seedInitialAdmin();
  await closeDb();
  console.info("Seed completed");
}

if (import.meta.main) {
  main().catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
}
