/**
 * Global site configuration.
 * Values that depend on deployment come from environment variables —
 * see .env.example and README.md.
 */

function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const site = {
  name: "ORYN",
  tagline: "Autonomous Aerial Intelligence",
  description:
    "ORYN is developing integrated aerial intelligence — custom drone systems, computer vision, and managed operations that turn aerial observation into clear, actionable information.",
  url: resolveSiteUrl(),
  /** Optional public inquiry address. Leave unset rather than inventing one. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
  /**
   * Where "Sign in" points: an external platform deployment when
   * NEXT_PUBLIC_COMMAND_URL is set, the built-in platform when
   * NEXT_PUBLIC_PLATFORM_ENABLED=true, otherwise hidden.
   */
  commandUrl: process.env.NEXT_PUBLIC_COMMAND_URL || (process.env.NEXT_PUBLIC_PLATFORM_ENABLED === "true" ? "/login" : null),
  stageNote:
    "ORYN is an early-stage company. Products and capabilities described on this site are in development unless stated otherwise.",
} as const;

export type NavItem = { label: string; href: string; description?: string };

export const primaryNav: NavItem[] = [
  { label: "Technology", href: "/technology" },
  { label: "Aero", href: "/aero" },
  { label: "Intelligence", href: "/intelligence" },
  { label: "Platform", href: "/platform" },
  { label: "Solutions", href: "/solutions" },
  { label: "About", href: "/about" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Products",
    items: [
      { label: "ORYN Aero", href: "/aero" },
      { label: "ORYN Intelligence", href: "/intelligence" },
      { label: "ORYN Command", href: "/platform#command" },
      { label: "ORYN Portal", href: "/platform#portal" },
    ],
  },
  {
    title: "Solutions",
    items: [
      { label: "Agriculture", href: "/solutions/agriculture" },
      { label: "Environment", href: "/solutions/environment" },
      { label: "Construction", href: "/solutions/construction" },
      { label: "Disaster Response", href: "/solutions/disaster-response" },
      { label: "Search & Rescue", href: "/solutions/search-and-rescue" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Technology", href: "/technology" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Request a demo", href: "/contact?intent=demo" },
      { label: "Media credits", href: "/credits" },
    ],
  },
];
