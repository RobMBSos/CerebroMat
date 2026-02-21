import type { AgeGroup, ExerciseCategory } from '../types';

type SpeedTipInput = {
  ageGroup: AgeGroup;
  category: ExerciseCategory;
  responseMs: number;
  categoryAverageMs?: number;
};

type SpeedTipResult = {
  isSlow: boolean;
  thresholdMs: number;
  tip: string | null;
};

const BASELINE_MS_BY_CATEGORY: Record<ExerciseCategory, number> = {
  ADDITION: 6000,
  SUBTRACTION: 7000,
  MULTIPLICATION: 8500,
  DIVISION: 10000,
  WORD_PROBLEM: 14000,
};

const AGE_FACTOR: Record<AgeGroup, number> = {
  INFANT_3_5: 1.7,
  AGE_6_7: 1.4,
  AGE_8_9: 1.2,
  AGE_10_12: 1.0,
};

const SPEED_TIPS: Record<ExerciseCategory, string> = {
  ADDITION:
    'Tip de suma: forma decenas primero (8 + 7 = 8 + 2 + 5). Te hará más rápido.',
  SUBTRACTION:
    'Tip de resta: usa puente a la decena. Baja primero al número redondo y luego termina.',
  MULTIPLICATION:
    'Tip de multiplicación: separa en decenas y unidades (14×6 = 10×6 + 4×6).',
  DIVISION:
    'Tip de división: piensa en la tabla al revés y comprueba multiplicando.',
  WORD_PROBLEM:
    'Tip de problemas: subraya datos y pregunta, luego decide operación antes de calcular.',
};

const DEFAULT_SPEED_TIP =
  'Tip general: repasa el enunciado en voz baja, identifica datos y elige la operación antes de calcular.';

export function getSpeedTipForCategory(category: ExerciseCategory | string): string {
  if (category in SPEED_TIPS) {
    return SPEED_TIPS[category as ExerciseCategory];
  }

  return DEFAULT_SPEED_TIP;
}

export function evaluateSpeedTip({
  ageGroup,
  category,
  responseMs,
  categoryAverageMs,
}: SpeedTipInput): SpeedTipResult {
  const baselineMs = Math.round(BASELINE_MS_BY_CATEGORY[category] * AGE_FACTOR[ageGroup]);
  const personalThresholdMs =
    typeof categoryAverageMs === 'number' && categoryAverageMs > 0
      ? Math.round(categoryAverageMs * 1.35)
      : 0;
  const thresholdMs = Math.max(baselineMs, personalThresholdMs);

  if (responseMs <= thresholdMs) {
    return {
      isSlow: false,
      thresholdMs,
      tip: null,
    };
  }

  return {
    isSlow: true,
    thresholdMs,
    tip: getSpeedTipForCategory(category),
  };
}
