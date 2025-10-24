import type Tuple from "~/utils/tuple";
import type { COLOR } from "~/utils/colors";

export type Slice = {
  start: Tuple;
  center: Tuple;
  percentage: number;
  totalPercentage: number;
  radius: number;
  color: COLOR;
  label: string;
  value: number;
};

export type SliceData = {
  value: number;
  color?: COLOR;
  label: string;
};
