import { MapWorkspace } from "@/components/map/workspace";
import type { AoiFeatureProps, FC } from "@/components/map/types";
import { mapBasemaps, mapOverlays } from "@/lib/map-layer-adapter";
import { aoiFeatureCollection, aoiVisibleTo } from "@/server/aois/service";
import { getOrgPageAccess } from "@/server/authz/next";

export const metadata = { title: "Map workspace" };

export default async function MapPage(props: PageProps<"/app/[org]/map">) {
  const { org } = await props.params;
  const sp = await props.searchParams;
  const access = await getOrgPageAccess(org);
  const aois = (await aoiFeatureCollection(access)) as unknown as FC<AoiFeatureProps>;
  const extent = await access.tx(async (tx) => {
    const [r] = await tx<{ b: [number, number, number, number] | null }[]>`
      select case when count(*) = 0 then null else array[ST_XMin(ST_Extent(a.geom)), ST_YMin(ST_Extent(a.geom)), ST_XMax(ST_Extent(a.geom)), ST_YMax(ST_Extent(a.geom))]::float8[] end as b
        from aois a where a.org_id = ${access.org.id} and a.status = 'active' ${aoiVisibleTo(tx, access)}`;
    return r?.b ?? null;
  });
  const str = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : undefined);
  return (
    <MapWorkspace
      slug={org}
      orgKind={access.org.kind}
      timeZone={access.org.settings.timezone ?? "UTC"}
      perms={{
        write: access.can("aoi.write"),
        run: access.can("analysis.run"),
        review: access.can("detections.review"),
        notes: access.can("notes.write"),
        reports: access.can("reports.generate"),
      }}
      basemaps={mapBasemaps("usgs-imagery")}
      overlays={mapOverlays()}
      initialAois={aois}
      initialBounds={extent}
      focus={{ aoi: str(sp.aoi), detection: str(sp.detection), obs: str(sp.obs), draw: sp.draw === "1" }}
    />
  );
}
