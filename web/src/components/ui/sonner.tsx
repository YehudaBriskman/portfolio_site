import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/*
 * Pinned to "light", not read from a theme hook. The site has one scheme —
 * index.html declares `color-scheme: light` — and this used to call
 * next-themes' `useTheme()` with no `ThemeProvider` above it, which returns
 * nothing, so the fallback "system" handed a dark-OS reader a dark toast on a
 * cream page.
 *
 * Mounted by the one component that raises a toast (ReadingBar), not by App,
 * so sonner ships in the post route's chunk instead of every route's.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast pop-toast",
          title: "font-semibold",
          description: "group-[.toast]:text-muted-foreground text-[0.8125rem]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
