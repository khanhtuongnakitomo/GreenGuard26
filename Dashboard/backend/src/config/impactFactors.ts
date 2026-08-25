/**
 * Impact conversion factors based on material recycling standards.
 * Reference: UEH Environmental & Material Recycling Sustainability Report (2025/2026).
 *
 * NOTE: Values are calibrated for 1 recycled unit of each material type.
 */

export const IMPACT_FACTORS = {
  // CO2 saved in kg per recycled item
  co2Kg: {
    pet_clean: 0.045, // Clean PET bottle recycling avoids virgin plastic synthesis
    pet_bad: 0.025,   // Uncleaned PET requires washing/sorting energy
    aluminum: 0.082   // Aluminum recycling saves ~95% energy vs bauxite extraction
  },

  // Water saved in liters per recycled item
  waterLiters: {
    pet_clean: 1.2,
    pet_bad: 0.6,
    aluminum: 2.5
  },

  // Electricity saved in kWh per recycled item
  electricityKwh: {
    pet_clean: 0.055,
    pet_bad: 0.030,
    aluminum: 0.140
  },

  // Average weight in kg per item
  weightKg: {
    pet_clean: 0.022,
    pet_bad: 0.024,
    aluminum: 0.015
  }
} as const;
