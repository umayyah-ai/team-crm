import { EmptyState } from "@/client/components/EmptyState";

export function AdminOnly() {
  return <EmptyState kind="filtered" title="Only admins can change these settings." />;
}
