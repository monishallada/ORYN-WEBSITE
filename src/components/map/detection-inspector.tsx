"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, orgApi } from "@/components/map/api";
import { detectionColor } from "@/components/map/legend";
import { NotesThread } from "@/components/map/notes";
import type { Detection, Observation } from "@/components/map/types";
import type { InspectorPerms } from "@/components/map/aoi-inspector";
import { Badge, Button, EVIDENCE_TONE, inputClass, KeyValues, Notice, ResultClassBadge, VERIFICATION_TONE } from "@/components/platform/ui";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { formatArea, formatLatLon } from "@/lib/geo";

export function DetectionInspector({
  slug,
  detectionId,
  perms,
  timeZone,
  onCompare,
  onShowObservation,
  onReviewed,
  onClose,
  onFocus,
}: {
  slug: string;
  detectionId: string;
  perms: InspectorPerms;
  timeZone: string;
  onCompare: (before: Observation, after: Observation) => void;
  onShowObservation: (o: Observation) => void;
  onReviewed: () => void;
  onClose: () => void;
  onFocus: (d: Detection) => void;
}) {
  const [d, setD] = useState<Detection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Detection>(`${orgApi(slug)}/detections/${detectionId}`)
      .then((r) => {
        if (cancelled) return;
        setD(r);
        onFocus(r);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : "Could not load this detection."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, detectionId]);

  async function review(status: "needs_field_check" | "confirmed" | "dismissed" | "unverified") {
    setBusy(true);
    setReviewError(null);
    try {
      const r = await api<Detection>(`${orgApi(slug)}/detections/${detectionId}/review`, { method: "POST", json: { status, note: note || undefined } });
      setD(r);
      setNote("");
      onReviewed();
    } catch (e) {
      setReviewError(e instanceof ApiError ? e.message : "Could not record the review.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Notice tone="error" className="m-4">{error}</Notice>;
  if (!d) return <p className="p-4 text-[0.8125rem] text-bone-50/50">Loading detection…</p>;
  const m = d.metrics as { mean_delta?: number; min_delta?: number; max_delta?: number; pixel_count?: number; days_between?: number; same_grid?: boolean; valid_overlap_fraction?: number };

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-eyebrow flex items-center gap-2 text-bone-50/45">
            <span aria-hidden="true" className="size-2.5 rounded-[1px]" style={{ background: detectionColor(d.type) }} />
            {d.type.replace(/_/g, " ")}
          </p>
          <h2 className="mt-1 text-[1.0625rem] font-medium leading-tight">{d.title}</h2>
          <p className="mt-1 text-[0.75rem] text-bone-50/55">
            <Link className="hover:underline" href={`?aoi=${d.aoiId}`}>{d.aoiName}</Link> · {d.areaM2 ? formatArea(d.areaM2) : "—"} · {formatLatLon(d.centroid, 5)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ResultClassBadge resultClass={d.resultClass} verified={d.verificationStatus === "confirmed"} />
            <Badge tone={EVIDENCE_TONE[d.evidenceGrade]}>Evidence: {d.evidenceGrade}</Badge>
            <Badge tone={VERIFICATION_TONE[d.verificationStatus]}>{d.verificationStatus.replace(/_/g, " ")}</Badge>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-[3px] px-2 py-1 text-[0.75rem] text-bone-50/50 hover:bg-bone-50/[0.06]" aria-label="Close detection details">✕</button>
      </div>

      <Notice tone="info">
        This is a candidate change computed from two satellite observations. It indicates where measurements differ; it does not by itself establish what happened on the ground.
      </Notice>

      <section aria-label="Before and after">
        <p className="t-eyebrow mb-2 text-bone-50/45">Before and after</p>
        <div className="grid grid-cols-2 gap-2">
          {[d.baseline, d.comparison].map((o, i) => (
            <div key={i} className="rounded-[3px] border border-bone-50/[0.08] p-2 text-[0.75rem]">
              <p className="text-bone-50/45">{i === 0 ? "Baseline" : "Comparison"}</p>
              {o ? (
                <>
                  <p className="mt-0.5">{formatDate(o.observedAt, timeZone)}</p>
                  <p className="text-bone-50/50">{o.asset.platform ?? o.asset.collection}</p>
                  <p className="text-bone-50/50">mean {formatNumber(o.metrics.mean as number, 3)}</p>
                  <Button size="sm" className="mt-1.5" onClick={() => onShowObservation(o)}>Show</Button>
                </>
              ) : (
                <p className="mt-0.5 text-bone-50/50">Not available</p>
              )}
            </div>
          ))}
        </div>
        {d.baseline && d.comparison ? (
          <Button size="sm" variant="primary" className="mt-2 w-full" onClick={() => onCompare(d.baseline!, d.comparison!)}>Swipe-compare on map</Button>
        ) : null}
      </section>

      <section aria-label="Measurements">
        <p className="t-eyebrow mb-2 text-bone-50/45">Measurements</p>
        <KeyValues
          items={[
            ["Mean change", m.mean_delta !== undefined ? `${m.mean_delta > 0 ? "+" : ""}${formatNumber(m.mean_delta, 3)} NDVI` : "—"],
            ["Range", m.min_delta !== undefined ? `${formatNumber(m.min_delta, 2)} to ${formatNumber(m.max_delta, 2)}` : "—"],
            ["Pixels", formatNumber(m.pixel_count, 0)],
            ["Days between", formatNumber(m.days_between, 0)],
            ["Same pixel grid", m.same_grid === undefined ? "—" : m.same_grid ? "Yes (no resampling)" : "No — resampled; registration error possible"],
            ["Valid in both", m.valid_overlap_fraction !== undefined ? `${Math.round(m.valid_overlap_fraction * 100)}% of area` : "—"],
            ["Thresholds", Object.entries(d.thresholds).map(([k, v]) => `${k.replace(/_/g, " ")} ${String(v)}`).join("; ") || "—"],
            ["Method", d.model ?? "—"],
            ["Recorded", formatDateTime(d.createdAt, timeZone)],
          ]}
        />
      </section>

      <section aria-label="Evidence assessment">
        <p className="t-eyebrow mb-2 text-bone-50/45">Why the evidence is {d.evidenceGrade}</p>
        <ul className="list-disc pl-4 text-[0.75rem] text-bone-50/75">{d.evidenceReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        {d.limitations.length ? (
          <details className="mt-2 text-[0.75rem] text-bone-50/65">
            <summary className="cursor-pointer text-bone-50/75">Limitations ({d.limitations.length})</summary>
            <ul className="mt-1 list-disc pl-4">{d.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          </details>
        ) : null}
      </section>

      <section aria-label="Overlapping reference data">
        <p className="t-eyebrow mb-2 text-bone-50/45">Overlapping reference data</p>
        {d.referenceMatches.length === 0 ? (
          <p className="text-[0.75rem] text-bone-50/50">No organization reference features (permits, parcels, infrastructure) intersect this candidate. That does not imply anything is unpermitted — the layer may be incomplete or absent.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[0.75rem]">
            {d.referenceMatches.map((m) => (
              <li key={m.layerId}>
                <span className="text-bone-50/85">{m.layerName}</span> <span className="text-bone-50/45">({m.kind})</span>: {m.count} feature{m.count === 1 ? "" : "s"}
                {m.samples.length ? <span className="block text-bone-50/50">{m.samples.map((x) => x.name ?? x.externalId).join(", ")}{m.count > m.samples.length ? ", …" : ""}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.context.warnings.length ? (
        <section aria-label="Related warnings">
          <p className="t-eyebrow mb-2 text-bone-50/45">Official warnings in this period</p>
          <ul className="text-[0.75rem] text-bone-50/75">
            {d.context.warnings.map((w) => <li key={w.id}>{w.title} {w.event_start ? `(${formatDate(w.event_start, timeZone)})` : ""}</li>)}
          </ul>
        </section>
      ) : null}

      {d.relatedAlerts.length ? (
        <section aria-label="Related alerts">
          <p className="t-eyebrow mb-2 text-bone-50/45">Alerts</p>
          <ul className="text-[0.75rem]">
            {d.relatedAlerts.map((a) => (
              <li key={a.id}><Link className="hover:underline" href={`/app/${slug}/alerts/${a.id}`}>{a.title}</Link> <span className="text-bone-50/45">· {a.status}</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Verification">
        <p className="t-eyebrow mb-2 text-bone-50/45">Verification</p>
        {d.verifiedBy ? (
          <p className="mb-2 text-[0.75rem] text-bone-50/65">
            {d.verificationStatus.replace(/_/g, " ")} by {d.verifiedBy} on {formatDateTime(d.verifiedAt, timeZone)}{d.verificationNote ? ` — “${d.verificationNote}”` : ""}
          </p>
        ) : null}
        {perms.review ? (
          <div className="flex flex-col gap-2">
            <textarea aria-label="Review note" className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was this checked? (required to confirm or dismiss)" />
            {reviewError ? <p className="text-[0.75rem] text-data-alert">{reviewError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => review("needs_field_check")}>Needs field check</Button>
              <Button size="sm" disabled={busy} onClick={() => review("confirmed")}>Confirm</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => review("dismissed")}>Dismiss</Button>
              {d.verificationStatus !== "unverified" ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => review("unverified")}>Reset</Button> : null}
            </div>
          </div>
        ) : (
          <p className="text-[0.75rem] text-bone-50/50">Your role can view but not review detections.</p>
        )}
      </section>

      <NotesThread slug={slug} targetType="detection" targetId={d.id} canWrite={perms.notes} timeZone={timeZone} />
    </div>
  );
}
