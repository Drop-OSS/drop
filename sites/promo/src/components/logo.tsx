/**
 * Renders the Drop OSS logo with an icon and text label.
 *
 * @param className - Optional CSS classes applied to the logo icon
 */
export function Logo({ className }: { readonly className?: string }) {
  return (
    <div className="mt-1 inline-flex items-center gap-x-1">
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4 13.5C4 11.0008 5.38798 8.76189 7.00766 7C8.43926 5.44272 10.0519 4.25811 11.0471 3.5959C11.6287 3.20893 12.3713 3.20893 12.9529 3.5959C13.9481 4.25811 15.5607 5.44272 16.9923 7C18.612 8.76189 20 11.0008 20 13.5C20 17.9183 16.4183 21.5 12 21.5C7.58172 21.5 4 17.9183 4 13.5Z"
          stroke="#60a5fa"
          strokeWidth="2"
        />
      </svg>
      <span className="text-lg font-semibold">Drop OSS</span>
    </div>
  );
}

/**
 * Renders the Drop OSS mark as an SVG icon.
 *
 * @param className - Optional CSS class name applied to the SVG element.
 */
export function Mark({ className }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 13.5C4 11.0008 5.38798 8.76189 7.00766 7C8.43926 5.44272 10.0519 4.25811 11.0471 3.5959C11.6287 3.20893 12.3713 3.20893 12.9529 3.5959C13.9481 4.25811 15.5607 5.44272 16.9923 7C18.612 8.76189 20 11.0008 20 13.5C20 17.9183 16.4183 21.5 12 21.5C7.58172 21.5 4 17.9183 4 13.5Z"
        stroke="#60a5fa"
        strokeWidth="2"
      />
    </svg>
  );
}
