import type { Slice } from "~/components/PieChart/types";

export const useTooltip = () =>
  useState<{
    x?: number;
    y?: number;
    slice?: Slice;
    isDisplayed?: boolean;
  }>("tooltip", () => ({}));

export const setTooltipCoordinates = (
  parentRef: HTMLDivElement | undefined,
  mouseX: number,
  mouseY: number,
  slice: Slice,
) => {
  if (!parentRef) {
    return;
  }
  const tooltip = useTooltip();
  tooltip.value.slice = slice;
  tooltip.value.x = mouseX - parentRef.getBoundingClientRect().left;
  tooltip.value.y = mouseY - parentRef.getBoundingClientRect().top;
  tooltip.value.isDisplayed = true;
  return tooltip;
};

export const hideTooltip = () => {
  const tooltip = useTooltip();
  tooltip.value.isDisplayed = false;
};
