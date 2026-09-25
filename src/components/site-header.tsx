import { Link } from "@tanstack/react-router";

const navLinkClass =
  "px-4 py-2 rounded-full text-sm font-medium text-foreground/70 transition-colors hover:bg-cream";

const activeClass = "bg-primary text-primary-foreground font-semibold hover:bg-primary";

export function SiteHeader() {
  return (
    <header className="border-b-2 border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
            D
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold">DTE, in Plain Terms</span>
            <span className="block text-xs text-foreground/55">
              A public-interest look at bills, shutoffs &amp; company pay
            </span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Main">
          <Link to="/" className={navLinkClass} activeOptions={{ exact: true }} activeProps={{ className: activeClass }}>
            Home
          </Link>
          <Link to="/household" className={navLinkClass} activeProps={{ className: activeClass }}>
            Household Experience
          </Link>
          <Link to="/financials" className={navLinkClass} activeProps={{ className: activeClass }}>
            DTE Financials
          </Link>
          <Link to="/compare" className={navLinkClass} activeProps={{ className: activeClass }}>
            Compare
          </Link>
        </nav>
      </div>
    </header>
  );
}
