import { clsx } from "clsx";

/**
 * Wraps content in a responsive container with optional styling and element ID.
 *
 * @returns The rendered container element.
 */
export function Container({
  className,
  children,
  id,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
  readonly id?: string;
}) {
  return (
    <div className={clsx(className, "px-6 lg:px-8")} id={id}>
      <div className="mx-auto max-w-2xl lg:max-w-7xl">{children}</div>
    </div>
  );
}
