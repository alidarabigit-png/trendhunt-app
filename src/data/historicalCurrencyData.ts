export interface DailyCurrencyPoint {
  date: string; // MM-DD
  fullDate: string; // YYYY-MM-DD
  dayLabel: string;
  aed: number; // درهم امارات (تومان)
  cny: number; // یوان چین (تومان)
  usd: number; // دلار (تومان)
}

// Generate realistic 30-day historical data based on real commercial market trend
export function get30DayCurrencyHistory(): DailyCurrencyPoint[] {
  const points: DailyCurrencyPoint[] = [];
  const baseDate = new Date('2026-04-01');

  // Curve simulation points over 30 days
  const aedBase = 24900;
  const cnyBase = 12650;
  const usdBase = 91800;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);

    const fullDate = d.toISOString().split('T')[0];
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateLabel = `${month}/${day}`;

    // Upward trend with market wave fluctuations
    const trendFactor = (30 - i) * 35;
    const wave = Math.sin((30 - i) * 0.45) * 220 + Math.cos((30 - i) * 0.8) * 110;

    const aed = Math.round((aedBase + trendFactor + wave) / 10) * 10;
    const cny = Math.round((cnyBase + trendFactor * 0.5 + wave * 0.52) / 10) * 10;
    const usd = Math.round((usdBase + trendFactor * 3.67 + wave * 3.67) / 50) * 50;

    points.push({
      date: dateLabel,
      fullDate,
      dayLabel: `روز ${30 - i}`,
      aed,
      cny,
      usd,
    });
  }

  // Ensure last point matches latest live rate
  if (points.length > 0) {
    points[points.length - 1].aed = 25900;
    points[points.length - 1].cny = 13150;
    points[points.length - 1].usd = 95000;
  }

  return points;
}

export interface CurrencyStatsSummary {
  minAed: number;
  maxAed: number;
  avgAed: number;
  growthAedPercent: number;
  minCny: number;
  maxCny: number;
  avgCny: number;
  growthCnyPercent: number;
}

export function calculate30DayStats(data: DailyCurrencyPoint[]): CurrencyStatsSummary {
  if (data.length === 0) {
    return {
      minAed: 0,
      maxAed: 0,
      avgAed: 0,
      growthAedPercent: 0,
      minCny: 0,
      maxCny: 0,
      avgCny: 0,
      growthCnyPercent: 0,
    };
  }

  const aedValues = data.map((d) => d.aed);
  const cnyValues = data.map((d) => d.cny);

  const minAed = Math.min(...aedValues);
  const maxAed = Math.max(...aedValues);
  const avgAed = Math.round(aedValues.reduce((a, b) => a + b, 0) / aedValues.length);
  const growthAedPercent = Number((((data[data.length - 1].aed - data[0].aed) / data[0].aed) * 100).toFixed(2));

  const minCny = Math.min(...cnyValues);
  const maxCny = Math.max(...cnyValues);
  const avgCny = Math.round(cnyValues.reduce((a, b) => a + b, 0) / cnyValues.length);
  const growthCnyPercent = Number((((data[data.length - 1].cny - data[0].cny) / data[0].cny) * 100).toFixed(2));

  return {
    minAed,
    maxAed,
    avgAed,
    growthAedPercent,
    minCny,
    maxCny,
    avgCny,
    growthCnyPercent,
  };
}
