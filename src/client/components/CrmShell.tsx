import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINKS = [
  { to: "/", label: "Today" },
  { to: "/contacts", label: "Contacts" },
  { to: "/companies", label: "Companies" },
  { to: "/tasks", label: "Tasks" },
  { to: "/calendar", label: "Calendar" },
  { to: "/pipelines", label: "Pipelines" },
  { to: "/groups", label: "Groups" },
  { to: "/settings", label: "Settings" },
] as const;

/** The app's frame: the starter's shell with the app's sections in its bar. */
export function CrmShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.to === "/" }}
              className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-muted data-[status=active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
