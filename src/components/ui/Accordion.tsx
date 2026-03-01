"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({
  children,
  ...props
}: AccordionPrimitive.AccordionMultipleProps | AccordionPrimitive.AccordionSingleProps) {
  return (
    <AccordionPrimitive.Root {...props}>{children}</AccordionPrimitive.Root>
  );
}

export function AccordionItem({
  children,
  className,
  ...props
}: AccordionPrimitive.AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      className={cn(
        "glass rounded-xl mb-3 overflow-hidden",
        "data-[state=open]:border-[rgba(212,175,55,0.2)]",
        "transition-colors duration-300",
        className
      )}
      {...props}
    >
      {children}
    </AccordionPrimitive.Item>
  );
}

export function AccordionTrigger({
  children,
  className,
  ...props
}: AccordionPrimitive.AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "flex flex-1 items-center justify-between px-6 py-4 text-left",
          "text-[var(--white-primary)] font-medium",
          "hover:text-white transition-colors cursor-pointer",
          "group",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="w-5 h-5 text-[var(--white-muted)] shrink-0 ml-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  children,
  className,
  ...props
}: AccordionPrimitive.AccordionContentProps) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        "overflow-hidden",
        "data-[state=open]:animate-[accordion-down_200ms_ease-out]",
        "data-[state=closed]:animate-[accordion-up_200ms_ease-out]",
        className
      )}
      {...props}
    >
      <div className="px-6 pb-4 text-[var(--white-secondary)] leading-relaxed">
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}
