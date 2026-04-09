/**
 * SkipLink — allows keyboard users to skip repetitive navigation and jump
 * directly to the main content area.  The link is visually hidden until it
 * receives focus, at which point it appears as a prominent banner in the top-
 * left corner of the viewport.
 *
 * Usage: render this as the very first element inside <body> (i.e. the first
 * child of the root layout).  The target element must have id="main-content".
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none"
    >
      Pular para o conteúdo principal
    </a>
  );
}
