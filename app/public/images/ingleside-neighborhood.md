# Ingleside neighborhood map provenance

- Bounds: south `37.708`, west `-122.475`, north `37.738`, east `-122.435`
- Generated: 2026-07-29
- Overpass endpoint: https://overpass.private.coffee/api/interpreter
- Generator: `scripts/generate-offline-map.mjs`
- Data attribution: © OpenStreetMap contributors, available under the Open Data Commons Open Database License (ODbL).

## Overpass query

```overpass
[out:json][timeout:60];(
  way[highway](37.708,-122.475,37.738,-122.435);
  node[public_transport](37.708,-122.475,37.738,-122.435);
  node[railway=station](37.708,-122.475,37.738,-122.435);
);out body;>;out skel qt;
```

## Regeneration

From the `app` directory, intentionally refresh the checked-in map with:

```sh
node scripts/generate-offline-map.mjs
```
