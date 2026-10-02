/** The top bar. The current page is marked with a filled pill and `aria-current`. */
import { Link } from "@tanstack/react-router";

const navLinkClass =
  "px-4 py-2 rounded-full text-sm font-medium text-foreground/70 transition-colors hover:bg-cream";

const activeClass = "bg-primary text-primary-foreground font-semibold hover:bg-primary";

export function SiteHeader() {
  return (
    <header className="border-b-2 border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/energy-equity-project-logo.png"
            alt="Energy Equity Project"
            width={48}
            height={48}
            className="size-12 object-contain"
          />
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold">Energy Equity Report</span>
            <span className="block text-xs text-foreground/55">
              A public-interest look at bills, shutoffs &amp; company pay
            </span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Main">
          <Link
            to="/"
            className={navLinkClass}
            activeOptions={{ exact: true }}
            activeProps={{ className: activeClass }}
          >
            Compare
          </Link>
          <Link to="/household" className={navLinkClass} activeProps={{ className: activeClass }}>
            Household Experience
          </Link>
          <Link to="/financials" className={navLinkClass} activeProps={{ className: activeClass }}>
            DTE Financials
          </Link>
          <Link to="/data" className={navLinkClass} activeProps={{ className: activeClass }}>
            Your data
          </Link>
        </nav>
      </div>
    </header>
  );
}
