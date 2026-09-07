import { IMPACT_FACTORS } from '../config/impactFactors';

type Material = 'pet_clean' | 'pet_bad' | 'aluminum';
type Totals = Record<Material, number>;
const emptyTotals = (): Totals => ({ pet_clean: 0, pet_bad: 0, aluminum: 0 });
export function materialType(value: string): Material | null {
  if (value === 'plastic_bottle') return 'pet_clean';
  if (value === 'can') return 'aluminum';
  return value === 'pet_clean' || value === 'pet_bad' || value === 'aluminum' ? value : null;
}

export interface ImpactSession {
  createdAt?: Date | string;
  items: Array<{ itemType: string; quantity: number }>;
}

/** UTC creation month represents recycling activity, independent of claim time. */
export function calculateImpact(sessions: ImpactSession[]) {
  const total = emptyTotals();
  const months = new Map<string, Totals>();
  let undatedItems = 0;
  for (const session of sessions) {
    const date = session.createdAt ? new Date(session.createdAt) : null;
    const month = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 7) : null;
    for (const item of session.items) {
      const type = materialType(item.itemType);
      if (!type || !Number.isFinite(item.quantity) || item.quantity < 0) continue;
      total[type] += item.quantity;
      if (!month) { undatedItems += item.quantity; continue; }
      if (!months.has(month)) months.set(month, emptyTotals());
      months.get(month)![type] += item.quantity;
    }
  }
  const weighted = (counts: Totals, factors: Totals, digits: number) => Number(
    (counts.pet_clean * factors.pet_clean + counts.pet_bad * factors.pet_bad + counts.aluminum * factors.aluminum).toFixed(digits),
  );
  return {
    byMonth: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, counts]) => ({
      month,
      items: counts.pet_clean + counts.pet_bad + counts.aluminum,
      kgPerType: {
        pet_clean: Number((counts.pet_clean * IMPACT_FACTORS.weightKg.pet_clean).toFixed(2)),
        pet_bad: Number((counts.pet_bad * IMPACT_FACTORS.weightKg.pet_bad).toFixed(2)),
        aluminum: Number((counts.aluminum * IMPACT_FACTORS.weightKg.aluminum).toFixed(2)),
      },
    })),
    co2SavedKg: weighted(total, IMPACT_FACTORS.co2Kg, 2),
    waterSavedL: weighted(total, IMPACT_FACTORS.waterLiters, 1),
    electricityKwh: weighted(total, IMPACT_FACTORS.electricityKwh, 2),
    timeZone: 'UTC',
    periodBasis: 'createdAt',
    undatedItems,
  };
}
