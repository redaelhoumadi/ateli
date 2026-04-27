// ─── Ateli UI — composants basés sur Radix UI ──────────────────
// Fichier unique exportant tous les composants UI

'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronDown, X, AlertCircle } from 'lucide-react'

// ─── Utils ────────────────────────────────────────────────────
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// ─── BUTTON ──────────────────────────────────────────────────
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:     'bg-gray-900 text-white hover:bg-black focus-visible:ring-gray-900',
        outline:     'border border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 focus-visible:ring-gray-400',
        ghost:       'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400',
        destructive: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500',
        success:     'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600',
        secondary:   'bg-gray-100 text-gray-800 hover:bg-gray-200 focus-visible:ring-gray-400',
        link:        'text-gray-900 underline-offset-4 hover:underline focus-visible:ring-gray-400 p-0 h-auto',
      },
      size: {
        xs:   'h-7 px-2.5 text-xs rounded-lg',
        sm:   'h-8 px-3 text-xs',
        md:   'h-9 px-4',
        lg:   'h-11 px-6 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

// ─── BADGE ────────────────────────────────────────────────────
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full text-xs font-semibold transition-all',
  {
    variants: {
      variant: {
        default:     'bg-gray-900 text-white',
        outline:     'border border-gray-300 text-gray-700',
        secondary:   'bg-gray-100 text-gray-700',
        destructive: 'bg-red-100 text-red-700 border border-red-200',
        success:     'bg-green-100 text-green-700 border border-green-200',
        warning:     'bg-amber-100 text-amber-700 border border-amber-200',
        info:        'bg-blue-100 text-blue-700 border border-blue-200',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

// ─── CARD ────────────────────────────────────────────────────
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm', className)} {...props} />
  )
}
function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5 border-b border-gray-100', className)} {...props} />
}
function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-bold text-gray-900', className)} {...props} />
}
function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-gray-500 mt-0.5', className)} {...props} />
}
function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />
}
function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 border-t border-gray-100 flex items-center', className)} {...props} />
}

// ─── INPUT ───────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  error?: boolean
}
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, ...props }, ref) => (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full border rounded-xl bg-white text-sm text-gray-900 placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
          'transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          icon ? 'pl-9 pr-4 py-2.5' : 'px-4 py-2.5',
          error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200',
          className
        )}
        {...props}
      />
    </div>
  )
)
Input.displayName = 'Input'

// ─── TEXTAREA ────────────────────────────────────────────────
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full border border-gray-200 rounded-xl bg-white px-4 py-2.5 text-sm text-gray-900',
      'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900',
      'transition-all disabled:opacity-50 resize-none',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

// ─── LABEL ───────────────────────────────────────────────────
function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('block text-xs font-semibold text-gray-700 mb-1.5', className)} {...props} />
  )
}

// ─── SEPARATOR ───────────────────────────────────────────────
function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn(
        'shrink-0 bg-gray-100',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        className
      )}
      orientation={orientation}
      {...props}
    />
  )
}

// ─── AVATAR ──────────────────────────────────────────────────
const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full object-cover', className)} {...props} />
))
AvatarImage.displayName = 'AvatarImage'

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex h-full w-full items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600', className)}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'

// ─── DIALOG ──────────────────────────────────────────────────
const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/0 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
        'w-full max-w-lg max-h-[90vh]',
        'bg-white rounded-2xl shadow-2xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2',
        'data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none">
          <X size={16} />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = 'DialogContent'

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pt-6 pb-4 border-b border-gray-100', className)} {...props} />
}
function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5 space-y-4', className)} {...props} />
}
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-3', className)} {...props} />
}
function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-bold text-gray-900', className)} {...props} />
}
function DialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-gray-500 mt-1', className)} {...props} />
}

// ─── SELECT ──────────────────────────────────────────────────
const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value
const SelectGroup = SelectPrimitive.Group

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5',
      'text-sm text-gray-900 placeholder:text-gray-400',
      'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[placeholder]:text-gray-400 transition-all hover:border-gray-400',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown size={14} className="text-gray-400 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' && 'data-[side=bottom]:translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport className={cn('p-1', position === 'popper' && 'w-full')}>
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3',
      'text-sm text-gray-700 outline-none',
      'focus:bg-gray-50 focus:text-gray-900',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check size={12} className="text-gray-900" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

function SelectLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide', className)}
      {...props}
    />
  )
}

// ─── TABS ────────────────────────────────────────────────────
const Tabs = TabsPrimitive.Root
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1', className)}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
      'text-gray-600 transition-all focus-visible:outline-none',
      'data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm',
      'hover:text-gray-900 disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

// ─── TOOLTIP ─────────────────────────────────────────────────
const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = 'TooltipContent'

// ─── DROPDOWN MENU ───────────────────────────────────────────
const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[180px] overflow-hidden rounded-xl border border-gray-100 bg-white p-1 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2',
      'text-sm text-gray-700 outline-none transition-colors',
      'focus:bg-gray-50 focus:text-gray-900',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-gray-100', className)} {...props} />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide', className)}
      {...props}
    />
  )
}

// ─── CHECKBOX ────────────────────────────────────────────────
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-5 w-5 shrink-0 rounded-md border-2 border-gray-300 bg-white',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900',
      'transition-all',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
      <Check size={12} strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'

// ─── SWITCH ──────────────────────────────────────────────────
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-200',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0',
        'transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

// ─── SCROLL AREA ─────────────────────────────────────────────
const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation="vertical"
      className="flex select-none touch-none p-0.5 bg-transparent transition-colors w-2.5 border-l border-transparent"
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-gray-200" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = 'ScrollArea'

// ─── POPOVER ─────────────────────────────────────────────────
const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-xl border border-gray-100 bg-white p-4 shadow-lg outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = 'PopoverContent'

// ─── STAT CARD ───────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  trend?: { value: number; label: string }
  className?: string
}
function StatCard({ label, value, sub, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className="text-2xl font-black text-gray-900 mb-1">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {trend && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-semibold',
          trend.value >= 0 ? 'text-green-600' : 'text-red-500')}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          <span className="font-normal text-gray-400">{trend.label}</span>
        </div>
      )}
    </Card>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────────────
function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-4xl mb-4 text-gray-300">{icon}</div>}
      <p className="text-base font-semibold text-gray-700 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-400 mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ─── DATE PICKER ─────────────────────────────────────────────
// Radix Popover + calendrier mensuel custom, même style que Input
function DatePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  min,
  max,
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  // Internal navigation state (YYYY-MM)
  const today = new Date()
  const [nav, setNav] = React.useState<{ year: number; month: number }>(() => {
    if (value) { const d = new Date(value); return { year: d.getFullYear(), month: d.getMonth() } }
    return { year: today.getFullYear(), month: today.getMonth() }
  })

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const DAYS   = ['Lu','Ma','Me','Je','Ve','Sa','Di']

  const firstDay = new Date(nav.year, nav.month, 1)
  // Monday-based offset
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(nav.year, nav.month + 1, 0).getDate()

  const toISO = (y: number, m: number, d: number) =>
    `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  const isSelected = (d: number) => value === toISO(nav.year, nav.month, d)
  const isToday    = (d: number) => {
    const t = today
    return t.getFullYear()===nav.year && t.getMonth()===nav.month && t.getDate()===d
  }
  const isDisabled = (d: number) => {
    const iso = toISO(nav.year, nav.month, d)
    if (min && iso < min) return true
    if (max && iso > max) return true
    return false
  }

  const prevMonth = () => setNav(n => n.month === 0 ? { year: n.year-1, month: 11 } : { ...n, month: n.month-1 })
  const nextMonth = () => setNav(n => n.month === 11 ? { year: n.year+1, month: 0 } : { ...n, month: n.month+1 })

  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })
    : ''

  const handleSelect = (d: number) => {
    if (isDisabled(d)) return
    onChange(toISO(nav.year, nav.month, d))
    setOpen(false)
  }

  // Sync nav when value changes externally
  React.useEffect(() => {
    if (value) {
      const d = new Date(value)
      setNav({ year: d.getFullYear(), month: d.getMonth() })
    }
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative w-full">
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-left',
              'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
              'hover:border-gray-300 transition-colors bg-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              value ? 'pr-10' : '',
              className
            )}>
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
            </svg>
            <span className={cn('flex-1 truncate', !displayValue && 'text-gray-400')}>
              {displayValue || placeholder}
            </span>
          </button>
        </PopoverTrigger>
        {/* Clear button — outside PopoverTrigger to avoid nested <button> */}
        {value && !disabled && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors z-10">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
      <PopoverContent className="w-72 p-3 shadow-xl" align="start">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
            </svg>
          </button>
          <button
            onClick={() => { setNav({ year: today.getFullYear(), month: today.getMonth() }) }}
            className="text-sm font-bold text-gray-900 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50">
            {MONTHS[nav.month]} {nav.year}
          </button>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
            </svg>
          </button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {/* Empty cells for offset */}
          {Array.from({ length: startOffset }).map((_, i) => <div key={`e-${i}`}/>)}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const dis = isDisabled(d)
            const sel = isSelected(d)
            const tod = isToday(d)
            return (
              <button key={d} onClick={() => handleSelect(d)} disabled={dis}
                className={cn(
                  'h-8 w-full text-sm font-medium rounded-lg transition-all',
                  sel && 'bg-gray-900 text-white',
                  !sel && tod && 'bg-indigo-50 text-indigo-700 font-bold ring-1 ring-indigo-200',
                  !sel && !tod && !dis && 'text-gray-800 hover:bg-gray-100',
                  dis && 'text-gray-300 cursor-not-allowed',
                )}>
                {d}
              </button>
            )
          })}
        </div>
        {/* Today shortcut */}
        {(!min || today.toISOString().split('T')[0] >= min) && (!max || today.toISOString().split('T')[0] <= max) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => { onChange(today.toISOString().split('T')[0]); setOpen(false) }}
              className="w-full text-xs text-center text-indigo-600 hover:text-indigo-800 font-semibold py-1 hover:bg-indigo-50 rounded-lg transition-colors">
              Aujourd'hui
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─── LOADING SPINNER ─────────────────────────────────────────
function Spinner({ size = 'md', className }: { size?: 'sm'|'md'|'lg'; className?: string }) {
  const s = { sm:'w-4 h-4', md:'w-7 h-7', lg:'w-10 h-10' }[size]
  return (
    <div className={cn(s, 'border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin', className)} />
  )
}

// ─── EXPORTS ─────────────────────────────────────────────────
export {
  // Button
  Button, buttonVariants,
  // Badge
  Badge, badgeVariants,
  // Card
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  // Form
  Input, Textarea, Label,
  // Separator
  Separator,
  // Avatar
  Avatar, AvatarImage, AvatarFallback,
  // Dialog
  Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogClose,
  DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
  // Select
  Select, SelectValue, SelectGroup, SelectTrigger, SelectContent, SelectItem, SelectLabel,
  // Tabs
  Tabs, TabsList, TabsTrigger, TabsContent,
  // Tooltip
  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent,
  // Dropdown
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuSub, DropdownMenuRadioGroup,
  // Checkbox + Switch
  Checkbox, Switch,
  // Scroll Area
  ScrollArea,
  // Popover
  Popover, PopoverTrigger, PopoverContent,
  // Composite
  StatCard, EmptyState, Spinner, DatePicker,
  // Utils
  cn,
}
