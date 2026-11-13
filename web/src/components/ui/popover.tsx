import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

/*
 * The popover: a floating panel opened from a button, for content that is
 * more than a list of commands (a menu is the wrong widget for a radio group
 * or a switch, and the APG says so).
 *
 * Non-modal, the Radix default, and left that way on purpose: a modal
 * popover locks the body's scroll, which takes the scrollbar's width out of
 * the layout and paints a strip of the page's paper down the edge of a dark
 * act. Escape, an outside press and focus returning to the trigger are all
 * kept.
 *
 * Its surface, motion and hierarchy classes are the popup system's, in
 * `styles/popup.css`: `pop` for the surface and its enter/exit, `pop-head`,
 * `pop-body` and `pop-foot` for the rows inside it.
 *
 * `container` portals the panel somewhere other than <body>: inside a modal
 * <dialog> (the top layer) a body-level panel would sit underneath it.
 */
const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverClose = PopoverPrimitive.Close

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { container?: HTMLElement | null }
>(({ className, sideOffset = 8, container, ...props }, ref) => (
  <PopoverPrimitive.Portal container={container}>
    <PopoverPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn("pop pop-panel", className)}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverClose }
