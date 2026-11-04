/** Same price table as the original student portal. */
const prices: Record<string, Record<string, number[]>> = {
  cheap: { "24": [1500, 2500, 3500, 4500, 5500, 7000, 9000], "48": [1000, 1800, 2600, 3400, 4200, 5500, 7000], "72": [600, 1000, 1600, 2200, 2800, 3800, 5000] },
  technical: { "24": [3000, 5000, 7000, 9000, 11000, 14000, 18000], "48": [2000, 3500, 5000, 6500, 8000, 10500, 13000], "72": [1500, 2500, 3500, 4500, 5500, 7000, 9000] },
};
export const priceFor = (track: string, pages: number, hours: string) =>
  prices[track]?.[hours]?.[Math.min(Math.max(pages || 1, 1), 7) - 1] ?? 0;
