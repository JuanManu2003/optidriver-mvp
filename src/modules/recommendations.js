const TIPS = [
  {
    id: 'accel',
    title: 'Reduce aceleraciones bruscas',
    body: 'Mantén las RPM entre 1.500 y 2.500 cuando sea posible. Esto puede disminuir el consumo en ciudad y mejorar tu margen por viaje.',
    when: (s) => s.habitScores.acceleration < 80 || s.harshAccels > 2,
  },
  {
    id: 'brake',
    title: 'Anticipa las frenadas',
    body: 'Soltar el acelerador antes de frenar reduce desgaste y consumo. En apps de transporte, cada frenada brusca puede costar $35–$50 CLP.',
    when: (s) => s.habitScores.braking < 80 || s.harshBrakes > 2,
  },
  {
    id: 'idle',
    title: 'Evita ralentí prolongado',
    body: 'En semáforos largos, apagar el motor más de 60 s puede ahorrar combustible en turnos de hora punta.',
    when: (s) => s.idleTicks > 3,
  },
  {
    id: 'steady',
    title: 'Velocidad constante en autopista',
    body: 'Entre 60 y 75 km/h suele ser el rango más eficiente para hatchback en apps de transporte en Chile.',
    when: (s) => s.habitScores.steadySpeed >= 85,
  },
];

export function getRecommendation(sessionSummary) {
  const match = TIPS.find((t) => t.when(sessionSummary));
  return match || TIPS[0];
}
