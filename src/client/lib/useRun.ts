import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "./format";

/** Runs a change, then reloads the page's data; a failure becomes a toast. */
export function useRun() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run<T>(work: () => Promise<T>, success?: string): Promise<T | undefined> {
    setPending(true);
    try {
      const result = await work();
      await router.invalidate();
      if (success) toast.success(success);
      return result;
    } catch (error) {
      toast.error(errorMessage(error));
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}
