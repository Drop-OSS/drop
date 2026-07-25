import { clsx } from "clsx";

/**
 * Renders an image in a styled frame with a fixed aspect ratio and screenshot disclaimer.
 *
 * @param width - The image width used to determine the frame's aspect ratio
 * @param height - The image height used to determine the frame's aspect ratio
 * @param src - The image source
 * @param className - Additional classes applied to the frame
 * @returns The rendered screenshot frame
 */
export function Screenshot({
  width,
  height,
  src,
  className,
}: {
  readonly width: number;
  readonly height: number;
  readonly src: string;
  readonly className?: string;
}) {
  return (
    <div
      style={{ "--width": width, "--height": height } as React.CSSProperties}
      className={clsx(
        className,
        "relative aspect-[var(--width)/var(--height)] [--radius:var(--radius-xl)]",
      )}
    >
      <div className="absolute -inset-(--padding) rounded-[calc(var(--radius)+var(--padding))] shadow-xs ring-1 ring-black/5 [--padding:--spacing(2)]" />
      <img alt="" src={src} className="h-full rounded-(--radius) shadow-2xl ring-1 ring-black/10" />
      <span className="absolute bottom-0 left-0 rounded-(--radius) bg-zinc-900 px-1 py-0.5 text-center text-xs text-zinc-300">
        All games and other content shown in screenshots are examples, without actual content.
      </span>
    </div>
  );
}
