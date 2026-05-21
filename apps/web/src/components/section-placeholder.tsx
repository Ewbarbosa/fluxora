import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PlaceholderLink = {
  label: string
  href: string
}

type SectionPlaceholderProps = {
  eyebrow: string
  title: string
  description: string
  bullets: string[]
  links?: PlaceholderLink[]
}

export function SectionPlaceholder({
  eyebrow,
  title,
  description,
  bullets,
  links = [],
}: SectionPlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card>
        <CardHeader className="gap-3">
          <div className="text-sm font-medium text-muted-foreground">{eyebrow}</div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span className="mt-1 size-1.5 rounded-full bg-foreground/60" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          {links.length ? (
            <div className="flex flex-wrap gap-3 pt-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {link.label}
                  <ArrowRightIcon className="size-4" />
                </Link>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
