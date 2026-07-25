import { clsx } from "clsx";

/**
 * Wraps content in a grid container.
 *
 * @param className - Additional CSS classes for the container
 * @param children - Content to render inside the container
 */
export function PlusGrid({
  className = "",
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return <div className={className}>{children}</div>;
}

/**
 * Renders a grid row with decorative border lines and spacing around its content.
 *
 * @param className - Additional CSS classes for the row container
 * @param children - Content rendered inside the row
 */
export function PlusGridRow({
  className = "",
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        className,
        "group/row relative isolate pt-[calc(--spacing(2)+1px)] last:pb-[calc(--spacing(2)+1px)]",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
      >
        <div className="absolute inset-x-0 top-0 border-t border-white/5"></div>
        <div className="absolute inset-x-0 top-2 border-t border-white/5"></div>
        <div className="absolute inset-x-0 bottom-0 hidden border-b border-white/5 group-last/row:block"></div>
        <div className="absolute inset-x-0 bottom-2 hidden border-b border-white/5 group-last/row:block"></div>
      </div>
      {children}
    </div>
  );
}

/**
 * Renders an item container with decorative plus icons at its row boundaries.
 *
 * @param children - The content to render inside the item
 */
export function PlusGridItem({
  className = "",
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className={clsx(className, "group/item relative")}>
      <PlusGridIcon placement="top left" className="hidden group-first/item:block" />
      <PlusGridIcon placement="top right" />
      <PlusGridIcon
        placement="bottom left"
        className="hidden group-first/item:group-last/row:block"
      />
      <PlusGridIcon placement="bottom right" className="hidden group-last/row:block" />
      {children}
    </div>
  );
}

/**
 * Renders a decorative plus-shaped icon at the specified position.
 *
 * @param placement - The icon position, such as `top left` or `bottom right`
 * @returns The positioned plus-shaped SVG icon
 */
export function PlusGridIcon({
  className = "",
  placement,
}: {
  readonly className?: string;
  readonly placement: `${"top" | "bottom"} ${"right" | "left"}`;
}) {
  let [yAxis, xAxis] = placement.split(" ");

  let yClass = yAxis === "top" ? "-top-2" : "-bottom-2";
  let xClass = xAxis === "left" ? "-left-2" : "-right-2";

  return (
    <svg
      viewBox="0 0 15 15"
      aria-hidden="true"
      className={clsx(className, "absolute size-[15px] fill-white/10", yClass, xClass)}
    >
      <path d="M8 0H7V7H0V8H7V15H8V8H15V7H8V0Z" />
    </svg>
  );
}
