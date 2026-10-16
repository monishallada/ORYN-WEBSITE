import type { Metadata } from "next";
import Image from "next/image";
import { SectionHeading } from "@/components/layout/page-hero";
import { AnnotatedBlueprint } from "@/components/aero/annotated-blueprint";
import { FlightControlDiagram } from "@/components/aero/flight-control-diagram";
import { ParallaxImage } from "@/components/media/parallax-image";
import { DroneBlueprint } from "@/components/viz/drone-blueprint";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, MediaNote, StatusTag } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { a1Specs, roadmap, sensorDirection } from "@/content/aero";
import { media } from "@/content/media";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "ORYN Aero",
  description:
    "ORYN Aero is our modular aerial robotics platform. ORYN A1 is the development aircraft we are building to integrate, test, and characterize the ORYN system.",
  alternates: { canonical: "/aero" },
};

const philosophy = [
  {
    title: "Integrate, then characterize.",
    body: "We start from proven components — motors, flight controllers, sensors — and invest our effort in how they work together. Each module is bench-tested and documented before integration.",
    image: media.aeroElectronics,
  },
  {
    title: "Designed for the field.",
    body: "Survey work means repetition. The airframe is designed around fast inspection, battery swaps, and replacing a damaged arm in minutes rather than hours.",
    image: media.aeroFrame,
  },
  {
    title: "Sensing defines the aircraft.",
    body: "Payload requirements drive everything else: power budget, flight time, stability. We size the aircraft around the data we need to collect.",
    image: media.aeroCamera,
  },
];

const phaseStyle: Record<(typeof roadmap)[number]["state"], string> = {
  complete: "bg-bone-50 border-bone-50",
  current: "bg-signal border-signal",
  next: "bg-transparent border-bone-50/60",
  future: "bg-transparent border-bone-50/25",
};
const phaseLabel: Record<(typeof roadmap)[number]["state"], string> = {
  complete: "Complete",
  current: "In progress",
  next: "Next",
  future: "Planned",
};

export default function AeroPage() {
  return (
    <>
      {/* Product hero */}
      <section aria-labelledby="aero-hero" className="relative isolate overflow-hidden bg-ink-950 pt-[calc(var(--header-h)+3rem)]">
        <div aria-hidden="true" className="tech-grid absolute inset-0 -z-10 text-bone-50 opacity-50 [mask-image:radial-gradient(ellipse_at_65%_45%,black,transparent_70%)]" />
        <div className="shell grid gap-10 pb-16 lg:min-h-[calc(100svh-var(--header-h)-3rem)] lg:grid-cols-12 lg:items-center lg:pb-10">
          <div className="lg:col-span-5">
            <Eyebrow className="animate-[fade_1.2s_var(--ease-out-expo)_0.2s_both]">ORYN Aero</Eyebrow>
            <h1 id="aero-hero" className="t-display mt-6 animate-[fade_1.4s_var(--ease-out-expo)_0.3s_both] uppercase">
              A1.
            </h1>
            <p className="t-h3 mt-6 max-w-md animate-[fade_1.4s_var(--ease-out-expo)_0.45s_both] text-bone-50/85">Our development platform.</p>
            <p className="t-body mt-5 max-w-md animate-[fade_1.4s_var(--ease-out-expo)_0.55s_both] text-bone-50/60">
              ORYN A1 is the aircraft we are building to integrate, test, and characterize the ORYN system — a modular multirotor designed around high-quality aerial data capture.
            </p>
            <div className="mt-8 flex animate-[fade_1.4s_var(--ease-out-expo)_0.65s_both] flex-wrap items-center gap-4">
              <StatusTag tone="signal">In development</StatusTag>
              <StatusTag>Concept rendering</StatusTag>
            </div>
          </div>
          <div className="lg:col-span-7">
            <DroneBlueprint className="mx-auto max-w-[760px]" />
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-title" className="bg-ink-950 pb-28 md:pb-36">
        <div className="shell">
          <div className="grid gap-10 border-t border-bone-50/10 pt-14 md:grid-cols-12">
            <h2 id="overview-title" className="t-h3 md:col-span-5">
              A platform for learning fast — and building it right.
            </h2>
            <div className="t-body space-y-4 text-bone-50/65 md:col-span-6 md:col-start-7">
              <p>
                A1 is not a finished product. It is the engineering platform where we bring together airframe, propulsion, flight control, compute, and sensing — and learn what an aircraft purpose-built for managed aerial intelligence needs to be.
              </p>
              <p>
                Everything we learn from A1 informs the aircraft that will eventually fly ORYN missions. We will publish performance figures only once they are measured and validated.
              </p>
            </div>
          </div>
        </div>
        <Reveal className="mt-20 md:mt-28">
          <ParallaxImage image={media.aeroDroneCustom} className="aspect-[4/3] md:aspect-[21/9]" imgClassName="brightness-[0.62] contrast-[1.08] saturate-[0.85]" />
          <div className="shell">
            <MediaNote className="mt-3">Representative custom multirotor build — not ORYN hardware. Photo: Josh Ogden / Unsplash</MediaNote>
          </div>
        </Reveal>
      </section>

      <section aria-labelledby="modules-title" className="border-t border-bone-50/[0.06] bg-ink-900 py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="modules-title"
            index="01"
            eyebrow="Modular architecture"
            title="Six modules. Clear interfaces."
            body="Each module has a defined mechanical, electrical, and data interface — so it can be tested on its own and upgraded without redesigning the aircraft."
          />
          <div className="mt-16">
            <AnnotatedBlueprint detailed />
          </div>
        </div>
      </section>

      <section aria-labelledby="philosophy-title" className="bg-ink-950 py-28 md:py-36">
        <div className="shell">
          <SectionHeading id="philosophy-title" index="02" eyebrow="Integration philosophy" title="How we build hardware." />
          <div className="mt-16 space-y-20 md:space-y-28">
            {philosophy.map((p, i) => (
              <Reveal key={p.title} className="grid gap-8 md:grid-cols-12 md:items-center">
                <div className={cn("relative aspect-[4/3] overflow-hidden rounded-[2px] bg-ink-850 md:col-span-7", i % 2 === 1 && "md:order-2 md:col-start-6")}>
                  <Image src={p.image.src} alt={p.image.alt} fill sizes="(min-width: 768px) 58vw, 100vw" placeholder="blur" className="object-cover" style={{ objectPosition: p.image.focal }} />
                </div>
                <div className={cn("md:col-span-4", i % 2 === 1 ? "md:order-1 md:col-start-1" : "md:col-start-9")}>
                  <p className="t-mono text-bone-50/55">0{i + 1}</p>
                  <h3 className="t-h3 mt-4">{p.title}</h3>
                  <p className="t-body mt-4 text-bone-50/65">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <MediaNote className="mt-12">Representative imagery of hardware categories. Photos via Unsplash — see Media credits.</MediaNote>
        </div>
      </section>

      <section aria-labelledby="fc-title" className="border-t border-bone-50/[0.06] bg-ink-900 py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="fc-title"
            index="03"
            eyebrow="Flight-control architecture"
            title="Keep the critical loop simple."
            body="A dedicated flight controller runs stabilization and navigation independently. Mission software runs on a separate companion computer and communicates through a narrow, well-defined interface."
          />
          <Reveal className="mt-14 md:mt-20">
            <FlightControlDiagram />
          </Reveal>
          <MediaNote className="mt-6">Planned architecture. Component selection is in progress.</MediaNote>
        </div>
      </section>

      <section aria-labelledby="sensors-title" className="bg-ink-950 py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="sensors-title"
            index="04"
            eyebrow="Sensor compatibility"
            title="One mount. Many ways of seeing."
            body="The payload interface is intended to accept different sensors as the platform matures. Our current direction:"
          />
          <ul className="mt-14 border-t border-bone-50/10">
            {sensorDirection.map((s) => (
              <li key={s.name} className="grid gap-3 border-b border-bone-50/10 py-6 md:grid-cols-12 md:items-baseline md:gap-8">
                <h3 className="t-h4 md:col-span-4">{s.name}</h3>
                <p className="t-body text-bone-50/60 md:col-span-6">{s.body}</p>
                <div className="md:col-span-2 md:text-right">
                  <StatusTag tone={s.status === "Initial focus" ? "signal" : "neutral"}>{s.status}</StatusTag>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="specs-title" className="surface-light py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="specs-title"
            index="05"
            eyebrow="Specifications"
            tone="light"
            title="Measured, then published."
            body="We don't publish numbers we haven't measured. Specifications will appear here as they are validated through structured testing."
          />
          <dl className="mt-14 grid border-t border-ink-900/15 md:grid-cols-2 md:gap-x-16">
            {a1Specs.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-6 border-b border-ink-900/10 py-4">
                <dt className="text-[0.9375rem] text-ink-900/70">{s.label}</dt>
                <dd className="text-right">
                  {s.value ? (
                    <span className="text-[0.9375rem] font-medium">{s.value}</span>
                  ) : (
                    <span className="t-mono text-ink-900/60">To be established</span>
                  )}
                  {s.note ? <span className="t-mono block text-[0.6875rem] text-ink-900/60">{s.note}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="roadmap-title" className="bg-ink-950 py-28 md:py-36">
        <div className="shell">
          <SectionHeading
            id="roadmap-title"
            index="06"
            eyebrow="Development roadmap"
            title="Where A1 is headed."
            body="Phases are sequential in intent, but overlap in practice. Timing will be shared as milestones are reached."
          />
          <ol className="relative mt-16 grid gap-10 md:grid-cols-5 md:gap-6">
            <span aria-hidden="true" className="absolute bottom-0 left-[7px] top-0 w-px bg-bone-50/15 md:bottom-auto md:left-0 md:right-0 md:top-[7px] md:h-px md:w-auto" />
            {roadmap.map((p) => (
              <li key={p.id} className="relative pl-10 md:pl-0 md:pt-12">
                <span aria-hidden="true" className={cn("absolute left-0 top-1 size-[15px] rounded-full border md:top-0", phaseStyle[p.state])} />
                <p className="t-mono text-bone-50/60">
                  {p.label} · {phaseLabel[p.state]}
                </p>
                <h3 className="t-h4 mt-3">{p.title}</h3>
                <p className="t-small mt-3 text-bone-50/60">{p.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-20 flex flex-col items-start justify-between gap-8 border-t border-bone-50/10 pt-10 md:flex-row md:items-center">
            <p className="t-h4 max-w-xl text-bone-50/85">Interested in shaping the platform as an early partner?</p>
            <ButtonLink href="/contact?intent=demo">Talk to the team</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
