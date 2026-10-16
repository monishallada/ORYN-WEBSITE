/**
 * Source-asset ingestion and AOI matching (Workflow C, steps 1–4).
 *
 *  - upsertSourceAssets: idempotent on (provider, collection, external id).
 *    Re-seeing an item only bumps last_seen_at; if the provider changed its
 *    metadata (hash differs), the stored metadata is replaced and the change
 *    is reported so it can be audited — first_seen_at never moves.
 *  - matchAssets: finds active AOIs (any tenant) subscribed to the product
 *    whose geometry intersects each footprint and whose cloud limit admits
 *    the scene, with the fraction of the AOI the footprint covers.
 *  - linkAndQueue: records the (aoi, asset) link and queues processing once;
 *    re-running is a no-op. Footprints covering too little of an AOI are
 *    linked as 'skipped' with the reason, so the history explains itself.
 */
import { createHash } from "node:crypto";
import { jsonb, type Tx } from "@/server/db/client";
import { enqueueTx } from "@/server/jobs/queue";
import { JOB } from "@/server/jobs/types";
import type { NormalizedAsset } from "@/server/providers/types";

/** Bump when the set of analytics run per asset changes, so new work is queued for old assets. */
export const PROCESSING_SET_VERSION = "1";
export const MIN_COVERAGE_FRACTION = 0.05;

export function assetMetadataHash(a: NormalizedAsset): string {
  const material = {
    assets: Object.fromEntries(Object.entries(a.assets).map(([k, f]) => [k, [f.href, f.bands ?? null]])),
    footprint: a.footprint,
    cloud: a.cloudCover,
    baseline: a.processingBaseline,
    acquired: a.acquiredAt.toISOString(),
  };
  return createHash("sha256").update(JSON.stringify(material)).digest("hex").slice(0, 32);
}

export type UpsertedAsset = { id: string; externalId: string; inserted: boolean; metadataChanged: boolean };

export async function upsertSourceAssets(tx: Tx, assets: NormalizedAsset[]): Promise<UpsertedAsset[]> {
  const out: UpsertedAsset[] = [];
  for (const a of assets) {
    const hash = assetMetadataHash(a);
    const [prior] = await tx<{ metadata_hash: string }[]>`
      select metadata_hash from source_assets
       where provider_id = ${a.providerId} and collection = ${a.collection} and external_id = ${a.externalId}`;
    const [row] = await tx<{ id: string; inserted: boolean }[]>`
      insert into source_assets (
        provider_id, collection, external_id, kind, platform, instruments, acquired_at, acquired_end_at,
        provider_published_at, footprint, cloud_cover, gsd_m, epsg, grid_code, processing_level, processing_baseline,
        properties, assets, license, license_url, attribution, stac_url, metadata_hash
      ) values (
        ${a.providerId}, ${a.collection}, ${a.externalId}, ${a.kind}, ${a.platform}, ${a.instruments},
        ${a.acquiredAt}, ${a.acquiredEndAt}, ${a.providerPublishedAt},
        ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(a.footprint)}), 4326)),
        ${a.cloudCover}, ${a.gsdM}, ${a.epsg}, ${a.gridCode}, ${a.processingLevel}, ${a.processingBaseline},
        ${jsonb(a.properties)}::jsonb, ${jsonb(a.assets)}::jsonb, ${a.license}, ${a.licenseUrl}, ${a.attribution}, ${a.stacUrl}, ${hash}
      )
      on conflict (provider_id, collection, external_id) do update set
        last_seen_at = now(),
        footprint = case when source_assets.metadata_hash <> excluded.metadata_hash then excluded.footprint else source_assets.footprint end,
        cloud_cover = case when source_assets.metadata_hash <> excluded.metadata_hash then excluded.cloud_cover else source_assets.cloud_cover end,
        assets = case when source_assets.metadata_hash <> excluded.metadata_hash then excluded.assets else source_assets.assets end,
        properties = case when source_assets.metadata_hash <> excluded.metadata_hash then excluded.properties else source_assets.properties end,
        provider_published_at = coalesce(excluded.provider_published_at, source_assets.provider_published_at),
        metadata_hash = excluded.metadata_hash
      returning id, (xmax = 0) as inserted`;
    out.push({ id: row!.id, externalId: a.externalId, inserted: row!.inserted, metadataChanged: Boolean(prior && prior.metadata_hash !== hash) });
  }
  return out;
}

export type AssetMatch = { org_id: string; aoi_id: string; asset_id: string; coverage: number; cloud_cover: number | null; max_cloud_cover: number };

/**
 * Intersect assets with subscribed active AOIs. Pass `onlyAoiIds` to restrict
 * matching (AOI backfill); omit it for provider-level syncs (all tenants —
 * call within a system context).
 */
export async function matchAssets(tx: Tx, assetIds: string[], productId: string, onlyAoiIds?: string[]): Promise<AssetMatch[]> {
  if (assetIds.length === 0) return [];
  return tx<AssetMatch[]>`
    select a.org_id, a.id as aoi_id, s.id as asset_id,
           least(1.0, ST_Area(ST_Intersection(a.geom, s.footprint)::geography) / nullif(a.area_m2, 0)) as coverage,
           s.cloud_cover::float8 as cloud_cover, a.max_cloud_cover::float8 as max_cloud_cover
      from source_assets s
      join aois a on a.geom && s.footprint and ST_Intersects(a.geom, s.footprint)
     where s.id = any(${assetIds}::uuid[])
       and a.status = 'active'
       and ${productId} = any(a.data_sources)
       ${onlyAoiIds ? tx`and a.id = any(${onlyAoiIds}::uuid[])` : tx``}`;
}

export async function linkAndQueue(
  tx: Tx,
  matches: AssetMatch[],
  opts: { productId: string; reason: string; createdBy?: string | null },
): Promise<{ queued: number; skipped: number; alreadyKnown: number }> {
  let queued = 0;
  let skipped = 0;
  let alreadyKnown = 0;
  for (const m of matches) {
    const cloudy = m.cloud_cover !== null && m.cloud_cover > m.max_cloud_cover;
    const tooSmall = m.coverage < MIN_COVERAGE_FRACTION;
    const status = cloudy || tooSmall ? "skipped" : "queued";
    const reason = cloudy
      ? `Scene cloud cover ${m.cloud_cover?.toFixed(0)}% exceeds this area's limit of ${m.max_cloud_cover.toFixed(0)}%.`
      : tooSmall
        ? `The image footprint covers only ${(m.coverage * 100).toFixed(1)}% of this area.`
        : null;
    const inserted = await tx`
      insert into aoi_assets (org_id, aoi_id, asset_id, coverage_fraction, status, status_reason)
      values (${m.org_id}, ${m.aoi_id}, ${m.asset_id}, ${Math.min(1, m.coverage)}, ${status}, ${reason})
      on conflict (aoi_id, asset_id) do nothing
      returning aoi_id`;
    if (inserted.length === 0) {
      alreadyKnown++;
      continue;
    }
    if (status === "skipped") {
      skipped++;
      continue;
    }
    await enqueueTx(tx, {
      orgId: m.org_id,
      type: JOB.aoiProcessAsset,
      payload: { aoiId: m.aoi_id, assetId: m.asset_id, productId: opts.productId, reason: opts.reason },
      priority: 60,
      timeoutSeconds: 900,
      idempotencyKey: `process:${m.aoi_id}:${m.asset_id}:${PROCESSING_SET_VERSION}`,
      createdBy: opts.createdBy ?? null,
    });
    queued++;
  }
  return { queued, skipped, alreadyKnown };
}
