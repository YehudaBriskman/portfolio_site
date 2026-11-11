/** Sonner loads on first use, with the toaster, not with every page that has a menu. */
export async function shareToast(message: string): Promise<void> {
  (await import("@/components/ui/sonner")).toast(message);
}
