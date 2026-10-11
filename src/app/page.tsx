import Image from "next/image";
import { Hero } from "@/components/home/hero";
import { SystemIntro } from "@/components/home/system-intro";
import { IndustriesStack } from "@/components/home/industries-stack";
import { ManagedSteps } from "@/components/home/managed-steps";
import { AnnotatedBlueprint } from "@/components/aero/annotated-blueprint";
import { ParallaxImage } from "@/components/media/parallax-image";
import { IntelligenceDemo } from "@/components/viz/intelligence-demo";
import { CommandPreview } from "@/components/previews/command-preview";
import { PortalPreview } from "@/components/previews/portal-preview";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { Eyebrow, MediaNote, StatusTag } from "@/components/ui/primitives";
import { ChapterHeading } from "@/components/ui/chapter-heading";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/content/media";

const details = [
  { key: "aeroMotor", label: "Propulsion", note: "Brushless motor & propeller" },
  { key: "aeroCamera", label: "Imaging", note: "Gimbal-stabilized camera" },
  { key: "aeroFrame", label: "Structure", note: "Carbon-fiber frame build" },
  { key: "aeroElectronics", label: "Electronics", note: "Power distribution" },
] as const;

export default function HomePage() {
  return (
    <>
      <Hero />

      <SystemIntro />

      {/* ── ORYN AERO ─────────────────────────────────────── */}
      <section aria-labelledby="aero-title" className="bg-ink-950 pb-28 pt-28 md:pb-40 md:pt-40">
        <div className="shell">
          <ChapterHeading
            id="aero-title"
            index="02"
            eyebrow="ORYN Aero"
            title={
              <>
                Engineered
                <br />
                to see more.
              </>
            }
            body="Modular aerial systems designed to collect high-quality intelligence across complex environments."
            aside={<StatusTag>ORYN A1 · In development</StatusTag>}
          />
        </div>

        <Reveal className="mt-16 md:mt-24">
          <ParallaxImage image={media.aeroDrone} className="aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-[21/9]" sizes="100vw" />
          <div className="shell">
            <MediaNote className="mt-3">Representative commercial multirotor — not ORYN hardware. Photo: Christopher Burns / Unsplash</MediaNote>
          </div>
        </Reveal>

        <div className="shell mt-24 md:mt-36">
          <div className="mb-10 grid gap-6 md:mb-14 md:grid-cols-12">
            <h3 className="t-h3 md:col-span-5">A platform built from modules, not compromises.</h3>
            <p className="t-body text-bone-50/60 md:col-span-5 md:col-start-8">
              ORYN A1 is our development platform: an aircraft architecture where airframe, propulsion, power, flight control, compute, and payload are defined as independent modules — each one testable, serviceable, and replaceable.
            </p>
          </div>
          <AnnotatedBlueprint />
        </div>

        <div className="shell mt-24 md:mt-36">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
            {details.map((d, i) => {
              const img = media[d.key];
              const layout = [
                "col-span-2 md:col-span-7 aspect-[4/3] md:aspect-auto md:h-[min(42vw,600px)]",
                "col-span-2 md:col-span-5 aspect-[4/3] md:aspect-auto md:h-[min(42vw,600px)]",
                "col-span-1 md:col-span-5 aspect-[4/5] md:aspect-auto md:h-[min(30vw,420px)]",
                "col-span-1 md:col-span-3 aspect-[4/5] md:aspect-auto md:h-[min(30vw,420px)]",
              ][i];
              return (
                <Reveal as="figure" key={d.key} delay={(i % 2) * 0.08} className={layout!.split(" ").filter((c) => c.includes("col-span")).join(" ")}>
                  <div className={`relative overflow-hidden rounded-[2px] bg-ink-850 ${layout!.split(" ").filter((c) => !c.includes("col-span")).join(" ")}`}>
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      sizes={i < 2 ? "(min-width: 768px) 55vw, 100vw" : "(min-width: 768px) 40vw, 50vw"}
                      placeholder="blur"
                      className="object-cover transition-transform duration-[1.6s] ease-out hover:scale-[1.03]"
                      style={{ objectPosition: img.focal }}
                    />
                  </div>
                  <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-[0.9375rem] font-medium">{d.label}</span>
                    <span className="t-mono text-bone-50/60">{d.note}</span>
                  </figcaption>
                </Reveal>
              );
            })}
            <div className="col-span-2 flex flex-col justify-end gap-8 border-t border-bone-50/10 pt-6 md:col-span-4 md:border-t-0 md:pt-0">
              <p className="t-body text-bone-50/65">
                We integrate proven components into our own architecture — then test, characterize, and document every module before anything is published as a specification.
              </p>
              <MediaNote>Representative component imagery from the hardware categories we are integrating. Not ORYN-manufactured parts.</MediaNote>
              <TextLink href="/aero">Explore ORYN Aero</TextLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── ORYN INTELLIGENCE ─────────────────────────────── */}
      <section aria-labelledby="intel-title" className="border-t border-bone-50/[0.06] bg-ink-900 py-28 md:py-40">
        <div className="shell">
          <ChapterHeading
            id="intel-title"
            index="03"
            eyebrow="ORYN Intelligence"
            title={
              <>
                Every frame.
                <br />
                More intelligence.
              </>
            }
            body="Computer vision and geospatial analysis that turn raw aerial imagery into maps, detections, and measurements. Drag the frame to compare."
          />
          <div className="mt-14 md:mt-20">
            <IntelligenceDemo />
          </div>
          <div className="mt-14 flex justify-end">
            <TextLink href="/intelligence">Explore ORYN Intelligence</TextLink>
          </div>
        </div>
      </section>

      {/* ── ORYN COMMAND ──────────────────────────────────── */}
      <section aria-labelledby="command-title" className="relative overflow-hidden bg-ink-950 py-28 md:py-40">
        <div aria-hidden="true" className="tech-grid pointer-events-none absolute inset-0 text-bone-50 opacity-40 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_70%)]" />
        <div className="shell relative">
          <ChapterHeading
            id="command-title"
            index="04"
            eyebrow="ORYN Command"
            title={
              <>
                One platform.
                <br />
                Total visibility.
              </>
            }
            body="The operations layer behind every ORYN mission — aircraft, flights, processing, and findings in a single view."
            aside={<StatusTag tone="signal">Interactive product preview</StatusTag>}
          />

          <Reveal className="mt-14 md:mt-20">
            <CommandPreview />
          </Reveal>

          <div className="mt-6 grid gap-x-8 gap-y-6 border-b border-bone-50/10 pb-10 md:grid-cols-4">
            {[
              ["Fleet", "Aircraft readiness, maintenance, and link status."],
              ["Missions", "Planned survey areas, flight records, and replays."],
              ["Findings", "Detections routed through analyst review."],
              ["Layers", "Imagery, analysis, and terrain on one map."],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="t-eyebrow text-bone-50/60">{k}</p>
                <p className="t-small mt-2 text-bone-50/70">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <MediaNote className="max-w-2xl">
              Illustrative interface with sample data. Basemap: USGS The National Map orthoimagery and 3DEP elevation (public domain), Grant County, Washington. Missions and findings are fictional.
            </MediaNote>
            <TextLink href="/platform#command">Discover ORYN Command</TextLink>
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ───────────────────────────────────── */}
      <section aria-labelledby="apps-title" className="bg-ink-950">
        <div className="shell py-28 md:py-40">
          <ChapterHeading
            id="apps-title"
            index="05"
            eyebrow="Applications"
            title={
              <>
                Built for the
                <br />
                ground truth.
              </>
            }
            body="Five areas where clear, repeatable aerial intelligence can change how decisions are made."
          />
        </div>
        <IndustriesStack />
      </section>

      {/* ── MANAGED EXPERIENCE ───────────────────────────── */}
      <section aria-labelledby="managed-title" className="surface-light py-28 md:py-40">
        <div className="shell">
          <ChapterHeading
            id="managed-title"
            index="06"
            eyebrow="The managed experience"
            tone="light"
            title={
              <>
                You focus on your work.
                <br />
                <span className="text-ink-900/60">We handle the intelligence.</span>
              </>
            }
            body="ORYN is designed as a fully managed service. You don't need to fly, maintain, or understand drones — we do that, and deliver the answers."
          />
          <div className="mt-16 md:mt-24">
            <ManagedSteps />
          </div>
        </div>
      </section>

      {/* ── ORYN PORTAL ──────────────────────────────────── */}
      <section aria-labelledby="portal-title" className="bg-bone-50 py-28 text-ink-900 md:py-40" style={{ colorScheme: "light" }}>
        <div className="shell">
          <ChapterHeading
            id="portal-title"
            index="07"
            eyebrow="ORYN Portal"
            tone="light"
            title={
              <>
                Complex technology.
                <br />
                Simple answers.
              </>
            }
            body="The customer view: no telemetry, no jargon. Just what changed, where, and what to do about it."
            aside={<StatusTag tone="light">Concept preview · Sample data</StatusTag>}
          />
          <Reveal className="mt-14 md:mt-20">
            <PortalPreview />
          </Reveal>

          <div className="mt-16 grid gap-px overflow-hidden rounded-[3px] border border-ink-900/10 bg-ink-900/10 md:mt-24 md:grid-cols-2">
            <div className="bg-ink-900 p-8 text-bone-50 md:p-10">
              <p className="t-eyebrow text-bone-50/50">ORYN Command</p>
              <p className="t-h4 mt-4">For ORYN operators and analysts.</p>
              <ul className="t-small mt-6 space-y-2 text-bone-50/65">
                <li>Fleet status, flight records, telemetry</li>
                <li>Processing pipelines and model outputs</li>
                <li>Confidence scores and analyst review</li>
              </ul>
            </div>
            <div className="bg-paper p-8 md:p-10">
              <p className="t-eyebrow text-ink-900/60">ORYN Portal</p>
              <p className="t-h4 mt-4">For the people who need answers.</p>
              <ul className="t-small mt-6 space-y-2 text-ink-900/65">
                <li>Plain-language findings and suggestions</li>
                <li>A simple map of your property or site</li>
                <li>Reports, history, and inspection requests</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex justify-end">
            <TextLink href="/platform#portal">Explore ORYN Portal</TextLink>
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA ──────────────────────────────────── */}
      <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-ink-950">
        <Image
          src={media.contact.src}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          className="-z-10 object-cover opacity-70"
          style={{ objectPosition: media.contact.focal }}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-[5] bg-gradient-to-b from-ink-950 via-ink-950/40 to-ink-950/80" />
        <div className="shell flex min-h-[80svh] flex-col justify-center py-32 text-center">
          <Eyebrow className="justify-center">Work with ORYN</Eyebrow>
          <h2 id="cta-title" className="t-h1 mx-auto mt-6 max-w-[14ch] uppercase">
            Let&apos;s see what&apos;s possible.
          </h2>
          <p className="t-lead mx-auto mt-6 max-w-xl text-bone-50/70">
            We&apos;re looking for early partners who want to shape how aerial intelligence works in their industry.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/contact?intent=demo">Request a demo</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact us
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
