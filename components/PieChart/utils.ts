import Tuple from "~/utils/tuple";
import type { Slice, SliceData } from "~/components/PieChart/types";
import { sum, lastItem } from "~/utils/array";

export const START = new Tuple(50, 10);
export const CENTER = new Tuple(50, 50);
export const RADIUS = 40;
export const COLORS = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "brown",
  "pink",
  "orange",
  "lime",
  "beige",
];

export const polarToCartesian = (
  center: Tuple,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  const x = center.x + radius * Math.cos(angleInRadians);
  const y = center.y + radius * Math.sin(angleInRadians);
  return new Tuple(x, y);
};

export const percent2Degrees = (percentage: number) => (360 * percentage) / 100;

export function generateSlices(data: SliceData[]): Slice[] {
  return data.reduce((accumulator, currentValue, index) => {
    return [
      ...accumulator,
      {
        start: accumulator.length
          ? polarToCartesian(
              CENTER,
              RADIUS,
              percent2Degrees(lastItem(accumulator).totalPercentage),
            )
          : START,
        radius: RADIUS,
        percentage: currentValue.percentage,
        totalPercentage:
          sum(accumulator.map((element) => element.percentage)) +
          currentValue.percentage,
        center: CENTER,
        color: currentValue.color || COLORS[index],
      },
    ];
  }, [] as Slice[]);
}
