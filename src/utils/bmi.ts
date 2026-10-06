import { BMICalculation } from '../types';

export function calculateBMI(heightStr: string, weightStr: string): BMICalculation | null {
  if (!heightStr || !weightStr) return null;
  const weight = parseFloat(weightStr);
  if (!weight || isNaN(weight) || weight <= 0) return null;

  let meters = 0;
  const matchFeet = heightStr.match(/(\d+)\s*['’]\s*(\d+)?/);
  if (matchFeet) {
    const feet = parseInt(matchFeet[1], 10);
    const inches = matchFeet[2] ? parseInt(matchFeet[2], 10) : 0;
    meters = (feet * 12 + inches) * 0.0254;
  } else {
    const num = parseFloat(heightStr);
    if (!num || isNaN(num) || num <= 0) return null;
    if (num > 3) {
      meters = num / 100; // cm
    } else {
      meters = num; // meters
    }
  }

  if (meters <= 0.4 || meters > 2.8) return null;
  const bmiVal = +(weight / (meters * meters)).toFixed(1);
  if (isNaN(bmiVal) || !isFinite(bmiVal)) return null;

  if (bmiVal < 18.5) {
    return { bmi: bmiVal, category: 'Underweight', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  } else if (bmiVal < 25) {
    return { bmi: bmiVal, category: 'Normal', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  } else if (bmiVal < 30) {
    return { bmi: bmiVal, category: 'Overweight', color: 'text-amber-800 bg-amber-100 border-amber-300' };
  } else {
    return { bmi: bmiVal, category: 'Obese', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  }
}
