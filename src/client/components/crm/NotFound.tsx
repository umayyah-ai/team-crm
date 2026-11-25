import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";

/** A record that doesn't exist, or that this member can't open. */
export function RecordNotFound({ back, backLabel }: { back: string; backLabel: string }) {
  return (
    <div data-testid="not-found">
      <EmptyState
        kind="filtered"
        title="Not found"
        description="This doesn't exist, or you don't have access to it."
        action={<Button variant="outline" render={<Link to={back} />}>{backLabel}</Button>}
      />
    </div>
  );
}
