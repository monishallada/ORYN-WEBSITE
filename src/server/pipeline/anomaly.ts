/**
 * ndvi-anomaly 1.0.0 — the latest AOI-mean NDVI as a standard score against
 * the AOI's own earlier usable observations from the same collection.
 *
 * Baseline: observations within ±30 days of the same day-of-year in earlier
 * years; if fewer than 3 exist, the 90 days before the observation. With
 * fewer than 3 baseline values, or no variation, the result is stored as
 * 'unusable' with the reason — no score is invented.
 */
import { ANALYTICS } from "@/server/analytics/registry";
import { env } from "@/server/config/env";
import { jsonb, type Tx } from "@/server/db/client";

const MIN_BASELINE = 3;

export function zScore(value: number, baseline: number[]): { z: number; mean: number; std: number } | null {
  if (baseline.length < MIN_BASELINE) return null;
  const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const variance = baseline.reduce((a, b) => a + (b - mean) ** 2, 0) / (baseline.length - 1);
  const std = Math.sqrt(variance);
  if (!(std > 1e-6)) return null;
  return { z: (value - mean) / std, mean, std };
}

export async function computeNdviAnomaly(tx: Tx, p: { orgId: string; aoiId: string; observationId: string; jobId: string | null }) {
  const model = ANALYTICS["ndvi-anomaly"];
  const [obs] = await tx<{ asset_id: string; mean: number | null; observed_at: Date; collection: string }[]>`
    select o.asset_id, (o.metrics->>'mean')::float8 as mean, o.observed_at, s.collection
      from observations o join source_assets s on s.id = o.asset_id
     where o.id = ${p.observationId} and o.org_id = ${p.orgId} and o.kind = 'ndvi' and o.status = 'valid'`;
  if (!obs || obs.mean === null) return null;

  const seasonal = await tx<{ mean: number; observed_at: Date }[]>`
    select (o.metrics->>'mean')::float8 as mean, o.observed_at
      from observations o join source_assets s on s.id = o.asset_id
     where o.aoi_id = ${p.aoiId} and o.kind = 'ndvi' and o.status = 'valid' and o.is_current and s.collection = ${obs.collection}
       and o.observed_at < ${obs.observed_at}::timestamptz - interval '300 days'
       and abs(extract(doy from o.observed_at) - extract(doy from ${obs.observed_at}::timestamptz)) <= 30`;
  let window = "same season, earlier years (±30 days)";
  let baseline = seasonal;
  if (baseline.length < MIN_BASELINE) {
    baseline = await tx<{ mean: number; observed_at: Date }[]>`
      select (o.metrics->>'mean')::float8 as mean, o.observed_at
        from observations o join source_assets s on s.id = o.asset_id
       where o.aoi_id = ${p.aoiId} and o.kind = 'ndvi' and o.status = 'valid' and o.is_current and s.collection = ${obs.collection}
         and o.observed_at < ${obs.observed_at} and o.observed_at >= ${obs.observed_at}::timestamptz - interval '90 days'`;
    window = "previous 90 days";
  }
  const r = zScore(obs.mean, baseline.map((b) => b.mean));
  const status = r ? "valid" : "unusable";
  const reason = r
    ? null
    : baseline.length < MIN_BASELINE
      ? `Insufficient baseline: ${baseline.length} earlier usable observation${baseline.length === 1 ? "" : "s"} (at least ${MIN_BASELINE} needed).`
      : "The baseline observations have no measurable variation.";
  const metrics = r
    ? { z_score: r.z, value: obs.mean, baseline_mean: r.mean, baseline_std: r.std, baseline_n: baseline.length, baseline_window: window }
    : { value: obs.mean, baseline_n: baseline.length, baseline_window: window };

  const [run] = await tx<{ id: string }[]>`
    insert into processing_runs (org_id, aoi_id, job_id, model_id, model_version, status, input_asset_ids, parameters, outputs, messages, software_version, finished_at)
    values (${p.orgId}, ${p.aoiId}, ${p.jobId}, ${model.id}, ${model.version}, ${r ? "succeeded" : "insufficient_data"}, ${[obs.asset_id]}::uuid[],
            ${jsonb({ observation_id: p.observationId, min_baseline: MIN_BASELINE })}::jsonb, ${jsonb(metrics)}::jsonb, ${reason ? [reason] : []}, ${env.appVersion()}, now())
    returning id`;
  await tx`
    insert into observations (org_id, aoi_id, run_id, asset_id, model_id, model_version, kind, result_class, observed_at, status, metrics, quality, limitations)
    values (${p.orgId}, ${p.aoiId}, ${run!.id}, ${obs.asset_id}, ${model.id}, ${model.version}, 'ndvi_anomaly', ${model.resultClass}, ${obs.observed_at},
            ${status}, ${jsonb(metrics)}::jsonb, ${jsonb({ ...(reason ? { unusable_reason: reason } : {}), source_observation_id: p.observationId })}::jsonb,
            ${model.limitations as unknown as string[]})
    on conflict (aoi_id, asset_id, model_id, model_version) do nothing`;
  return { status, metrics };
}
