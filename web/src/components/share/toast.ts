import { toast } from "@/lib/toast";

/** A share/copy confirmation (`ok`) or its failure, through the one toast service. */
export function shareToast(message: string, ok = true): void {
  if (ok) toast.success(message);
  else toast.error(message);
}
