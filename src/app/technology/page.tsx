import type { Metadata } from "next";
import { PageHero, SectionHeading } from "@/components/layout/page-hero";
import { ArchitectureDiagram } from "@/components/tech/architecture-diagram";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { Eyebrow, StatusTag } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/content/media";
import { pillars, principles } from "@/content/technology";

export const metadata: Metadata = {
  title: "Technology",
  description:
    "How ORYN is designed to turn a flight into a finding: aerial acquisition, sensor processing, computer vision, geospatial intelligence, human review, and delivery.",
  alternates: { canonical: "/technology" },
};

const compute = [
  {
    where: "On the aircraft",
    items: ["Stabilization & navigation", "Mission execution", "Capture tagging", "Onboard inference (future)"],
  },
  {
    where: "In the cloud",
    items: ["Quality checks", "Orthomosaic processing", "Model inference", "Change comparison"],
  },
  {
    where: "With people",
    items: ["Mission authorization", "Finding review", "Context & notes", "Customer communication"],
  },
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Technology"
        title="The architecture of aerial intelligence."
        lead="How ORYN is designed to turn a flight into a finding — from capture, to analysis, to an answer someone can act on."
        image={media.techHero}
        credit="Photo: Louei Mups / Unsplash"
      />

      <section aria-labelledby="arch-title" className="bg-ink-900 py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="arch-title"
            index="01"
            eyebrow="System architecture"
            title="From flight to finding."
            body="Six stages, each with defined inputs and outputs. Select a stage to see what it does and where it runs."
          />
          <Reveal className="mt-14 md:mt-20">
            <ArchitectureDiagram />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="compute-title" className="border-t border-bone-50/[0.06] bg-ink-900 pb-28 md:pb-36">
        <div className="shell">
          <SectionHeading
            id="compute-title"
            index="02"
            eyebrow="Where work happens"
            title="Edge, cloud, and people."
            body="The safety-critical loop stays simple and onboard. Heavy processing runs in the cloud. Judgment stays with trained people."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-[3px] border border-bone-50/10 bg-bone-50/10 md:grid-cols-3">
            {compute.map((c, i) => (
              <Reveal key={c.where} delay={i * 0.08} className="bg-ink-950 p-6 md:p-8">
                <p className="t-mono text-bone-50/55">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="t-h4 mt-3">{c.where}</h3>
                <ul className="mt-6 space-y-2.5">
                  {c.items.map((x) => (
                    <li key={x} className="flex items-center gap-3 text-[0.9375rem] text-bone-50/70">
                      <span aria-hidden="true" className="h-px w-3 bg-bone-50/40" />
                      {x}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="direction-title" className="bg-ink-950 py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="direction-title"
            index="03"
            eyebrow="Development direction"
            title="Five commitments shape everything we build."
            body="ORYN is early. These are the directions our engineering is organized around — with an honest label on where each one stands."
          />
          <ol className="mt-16 border-t border-bone-50/10">
            {pillars.map((p, i) => (
              <Reveal as="li" key={p.id} className="grid gap-4 border-b border-bone-50/10 py-8 md:grid-cols-12 md:items-baseline md:gap-8 md:py-10">
                <span className="t-mono text-bone-50/55 md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="t-h3 md:col-span-4">{p.name}</h3>
                <p className="t-body text-bone-50/65 md:col-span-5">{p.body}</p>
                <div className="md:col-span-2 md:text-right">
                  <StatusTag>{p.status}</StatusTag>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="principles-title" className="surface-light py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="principles-title"
            index="04"
            eyebrow="Engineering principles"
            title="Credibility is a design requirement."
            tone="light"
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-[3px] border border-ink-900/10 bg-ink-900/10 md:grid-cols-2">
            {principles.map((p) => (
              <div key={p.title} className="bg-bone-100 p-8 md:p-10">
                <h3 className="t-h4">{p.title}</h3>
                <p className="t-body mt-3 max-w-md text-ink-900/65">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="explore-title" className="bg-ink-950 py-28 md:py-36">
        <div className="shell">
          <Eyebrow>Explore the system</Eyebrow>
          <h2 id="explore-title" className="t-h2 mt-6 max-w-3xl">
            Three products. One integrated system.
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden border-y border-bone-50/10 md:grid-cols-3">
            {[
              { name: "ORYN Aero", body: "The modular aircraft platform.", href: "/aero" },
              { name: "ORYN Intelligence", body: "Computer vision & geospatial analysis.", href: "/intelligence" },
              { name: "Command & Portal", body: "Operations and customer delivery.", href: "/platform" },
            ].map((x) => (
              <div key={x.href} className="flex flex-col justify-between gap-10 py-8 md:border-r md:border-bone-50/10 md:px-8 md:first:pl-0 md:last:border-r-0">
                <div>
                  <h3 className="t-h4">{x.name}</h3>
                  <p className="t-small mt-2 text-bone-50/55">{x.body}</p>
                </div>
                <TextLink href={x.href}>Learn more</TextLink>
              </div>
            ))}
          </div>
          <div className="mt-14">
            <ButtonLink href="/contact?intent=demo">Request a demo</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
