"use client"

import { Toaster as Sonner } from "sonner"
import { useTheme } from "@/providers/theme-provider"
import { scaled } from "@/lib/scaled"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { themeMeta } = useTheme()

  return (
    <Sonner
      theme={themeMeta.type === "dark" ? "dark" : "light"}
      className="toaster group"
      style={{ fontFamily: "'Inter', sans-serif" }}
      toastOptions={{
        style: { fontSize: scaled(13) },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:!bg-transparent group-[.toast]:!text-primary group-[.toast]:!font-medium group-[.toast]:underline group-[.toast]:underline-offset-2",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          icon: "group-[.toast]:text-primary",
          error:
            "group-[.toaster]:!text-foreground [&_[data-icon]]:!text-destructive",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
