import { GRADE_POINTS } from "./gpa";

export type ProjectionResult = {
  requiredAveragePoints: number;
  recommendedGrade: string;
  isPossible: boolean;
  message: string;
};

export function calculateRequiredGrades(
  currentTotalPoints: number,
  currentTotalCredits: number,
  targetGpa: number,
  remainingCredits: number
): ProjectionResult {
  if (remainingCredits <= 0) {
    const currentGpa = currentTotalCredits > 0 ? currentTotalPoints / currentTotalCredits : 0;
    return {
      requiredAveragePoints: 0,
      recommendedGrade: "N/A",
      isPossible: currentGpa >= targetGpa,
      message: currentGpa >= targetGpa ? "Target already achieved!" : "Target impossible (no credits remaining)."
    };
  }

  const totalDesiredPoints = targetGpa * (currentTotalCredits + remainingCredits);
  const pointsNeeded = totalDesiredPoints - currentTotalPoints;
  const requiredAverage = pointsNeeded / remainingCredits;

  if (requiredAverage > 4.0) {
    return {
      requiredAveragePoints: requiredAverage,
      recommendedGrade: "A+",
      isPossible: false,
      message: `Impossible: You need an average of ${requiredAverage.toFixed(2)} (max is 4.0).`
    };
  }

  if (requiredAverage <= 0) {
    return {
      requiredAveragePoints: 0,
      recommendedGrade: "D",
      isPossible: true,
      message: "Target guaranteed: Even with minimum passing grades, you will hit your goal."
    };
  }

  // Find the closest grade that meets the requirement
  const sortedGrades = Object.entries(GRADE_POINTS).sort((a, b) => a[1] - b[1]);
  let recommendedGrade = "A+";
  for (const [grade, points] of sortedGrades) {
    if (points >= requiredAverage) {
      recommendedGrade = grade;
      break;
    }
  }

  return {
    requiredAveragePoints: requiredAverage,
    recommendedGrade,
    isPossible: true,
    message: `To hit ${targetGpa.toFixed(2)}, you need an average of ${requiredAverage.toFixed(2)} (${recommendedGrade}) in your remaining credits.`
  };
}
