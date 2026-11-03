import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * shadcn's button, with one variant and two sizes added for the chrome.
 *
 * The stock variants all assume a solid surface underneath them. `ghost` is
 * the closest fit for a control that sits on glass, and it is the one that
 * fails hardest here: it hovers to `bg-accent`, and this palette maps
 * `--accent` to `--surface` (#121214), so hovering a control on a translucent
 * island paints an opaque dark rectangle over the blur — the hover state
 * destroys the material it is drawn on. `glass` hovers to a 10% wash of the
 * ink (white until #247 gave the site two themes), as the island's own "you are here" state does, which is the only kind of
 * emphasis this palette has: light, not hue.
 *
 * The two island sizes encode the nav's 44px rule. Each control is a real
 * 44px touch target and then gives 7px back at each end, so the row measures
 * 30px and the island resolves to the 50px the glass recipe draws. The finger
 * gets its floor without the object growing to meet it.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /* A ring offset is a band of the page's ground drawn around the
           control, which on glass is a dark halo punched through the blur.
           The nav focuses with a flush ring instead, matching the outline the
           CSS-module links use. */
        glass:
          "text-clay hover:bg-ink/10 hover:text-bone data-[state=open]:bg-ink/10 data-[state=open]:text-bone focus-visible:ring-offset-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        island: "min-h-11 -my-[7px] gap-1.5 rounded-full px-3",
        islandIcon: "min-h-11 w-11 -my-[7px] rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
