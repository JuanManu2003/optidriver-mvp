/**
 * Métricas acumuladas de la sesión de conducción simulada.
 */

const session = {
  ticks: 0,
  harshBrakes: 0,
  harshAccels: 0,
  idleTicks: 0,
  efficientTicks: 0,
  scoreSum: 0,
  distanceKm: 0,
  fuelLiters: 0,
  speedSum: 0,
  rpmSum: 0,
  fuelPer100Sum: 0,
  maxSpeed: 0,
};

export function recordTelemetryTick(telemetry, events = {}) {
  session.ticks += 1;
  session.scoreSum += telemetry.score || 0;

  if (events.harshBrake) session.harshBrakes += 1;
  if (events.harshAccel) session.harshAccels += 1;
  if (events.isIdle) session.idleTicks += 1;

  const efficient =
    telemetry.speed >= 40 &&
    telemetry.speed <= 68 &&
    telemetry.rpm >= 1400 &&
    telemetry.rpm <= 2400 &&
    telemetry.fuelPer100 <= 6.8;

  if (efficient) session.efficientTicks += 1;

  session.speedSum += telemetry.speed || 0;
  session.rpmSum += telemetry.rpm || 0;
  session.fuelPer100Sum += telemetry.fuelPer100 || 0;
  session.maxSpeed = Math.max(session.maxSpeed, telemetry.speed || 0);

  const dtHours = 1.5 / 3600;
  session.distanceKm += (telemetry.speed || 0) * dtHours;
  session.fuelLiters += ((telemetry.fuelPer100 || 7) / 100) * (telemetry.speed || 0) * dtHours;
}

export function getSessionSummary() {
  const ticks = Math.max(session.ticks, 1);
  const avgScore = Math.round(session.scoreSum / ticks);

  const brakeScore = Math.max(52, Math.min(98, 96 - session.harshBrakes * 7));
  const accelScore = Math.max(52, Math.min(98, 94 - session.harshAccels * 8));
  const steadyScore = Math.max(
    55,
    Math.min(98, Math.round((session.efficientTicks / ticks) * 100)),
  );

  return {
    ticks: session.ticks,
    avgScore,
    avgSpeed: Math.round(session.speedSum / ticks),
    maxSpeed: Math.round(session.maxSpeed),
    avgRpm: Math.round(session.rpmSum / ticks),
    avgFuelPer100: Number((session.fuelPer100Sum / ticks).toFixed(1)),
    harshBrakes: session.harshBrakes,
    harshAccels: session.harshAccels,
    idleTicks: session.idleTicks,
    distanceKm: Number(session.distanceKm.toFixed(1)),
    fuelLiters: Number(session.fuelLiters.toFixed(2)),
    habitScores: {
      braking: brakeScore,
      acceleration: accelScore,
      steadySpeed: steadyScore,
    },
  };
}

export function resetSessionAnalytics() {
  session.ticks = 0;
  session.harshBrakes = 0;
  session.harshAccels = 0;
  session.idleTicks = 0;
  session.efficientTicks = 0;
  session.scoreSum = 0;
  session.distanceKm = 0;
  session.fuelLiters = 0;
  session.speedSum = 0;
  session.rpmSum = 0;
  session.fuelPer100Sum = 0;
  session.maxSpeed = 0;
}
