/** Ranked division thresholds (points). Ordered from highest to lowest. */
export interface DivisionInfo {
  name: string;
  min: number;
  max: number;
  range: string;
  reward: string;
}

export const LEAGUE_DIVISIONS: DivisionInfo[] = [
  { name: 'Platinum', min: 1700, max: 3000, range: '1,700+ pts', reward: '' },
  { name: 'Gold I', min: 1500, max: 1699, range: '1,500 – 1,699 pts', reward: '' },
  { name: 'Gold II', min: 1400, max: 1499, range: '1,400 – 1,499 pts', reward: '' },
  { name: 'Silver', min: 1200, max: 1399, range: '1,200 – 1,399 pts', reward: '' },
  { name: 'Bronze', min: 0, max: 1199, range: 'Below 1,200 pts', reward: '' },
];

export function divisionForPoints(points: number): DivisionInfo {
  return LEAGUE_DIVISIONS.find((d) => points >= d.min) ?? LEAGUE_DIVISIONS[LEAGUE_DIVISIONS.length - 1]!;
}
