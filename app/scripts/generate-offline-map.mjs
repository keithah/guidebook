import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const south = 37.708;
const west = -122.475;
const north = 37.738;
const east = -122.435;
const width = 1200;
const height = 900;
const query = `[out:json][timeout:60];(
  way[highway](${south},${west},${north},${east});
  node[public_transport](${south},${west},${north},${east});
  node[railway=station](${south},${west},${north},${east});
);out body;>;out skel qt;`;

const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.dirname(path.dirname(scriptPath));
const propertyPath = path.join(
  appRoot,
  'src/data/properties/sfcottage.json',
);
const svgPath = path.join(
  appRoot,
  'public/images/ingleside-neighborhood.svg',
);
const provenancePath = path.join(
  appRoot,
  'public/images/ingleside-neighborhood.md',
);

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function project(lat, lon) {
  const x = 34 + ((lon - west) / (east - west)) * (width - 68);
  const y = 30 + ((north - lat) / (north - south)) * (height - 100);
  return { x, y };
}

function coordinate(value) {
  return Number(value.toFixed(2));
}

function pathData(points) {
  return points
    .map(({ x, y }, index) => {
      const instruction = index === 0 ? 'M' : 'L';
      return `${instruction}${coordinate(x)} ${coordinate(y)}`;
    })
    .join(' ');
}

function polylineLength(points) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function roadClass(highway) {
  if (['motorway', 'trunk'].includes(highway)) return 'road-expressway';
  if (highway === 'primary') return 'road-primary';
  if (highway === 'secondary') return 'road-secondary';
  if (highway === 'tertiary') return 'road-tertiary';
  if (['residential', 'living_street', 'unclassified'].includes(highway)) {
    return 'road-local';
  }
  if (['footway', 'path', 'pedestrian', 'steps', 'cycleway'].includes(highway)) {
    return 'road-path';
  }
  return 'road-other';
}

async function downloadExtract() {
  let lastError;
  for (const endpoint of overpassEndpoints) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 75_000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://keithah.github.io/guidebook/',
          'User-Agent': 'sfcottage-guidebook-offline-map-generator/1.0',
        },
        body: new URLSearchParams({ data: query }),
        signal: abortController.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const extract = await response.json();
      if (!Array.isArray(extract.elements)) {
        throw new Error('response did not contain an Overpass element list');
      }
      return { endpoint, extract };
    } catch (error) {
      lastError = error;
      console.warn(`Overpass request failed at ${endpoint}: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Unable to generate map: ${lastError?.message ?? 'no endpoint available'}`);
}

function renderSvg(extract, property) {
  const sortedElements = [...extract.elements].sort(
    (left, right) => Number(left.id) - Number(right.id),
  );
  const nodes = sortedElements.filter((element) => element.type === 'node');
  const ways = sortedElements.filter((element) => element.type === 'way');
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const renderedWays = [];
  const labelCandidates = new Map();

  for (const way of ways) {
    if (!way.tags?.highway || !Array.isArray(way.nodes)) continue;
    const points = way.nodes
      .map((nodeId) => nodesById.get(nodeId))
      .filter(Boolean)
      .map((node) => project(node.lat, node.lon));
    if (points.length < 2) continue;

    renderedWays.push(
      `    <path class="${roadClass(way.tags.highway)}" data-osm-way="${way.id}" d="${pathData(points)}" fill="none" />`,
    );

    const name = way.tags.name;
    const isMajor = ['primary', 'secondary', 'tertiary'].includes(
      way.tags.highway,
    );
    const isOceanAvenue = /^Ocean (Ave|Avenue)$/i.test(name ?? '');
    if (!name || (!isMajor && !isOceanAvenue)) continue;

    const displayName = isOceanAvenue ? 'Ocean Avenue' : name;
    const length = polylineLength(points);
    if (!labelCandidates.has(displayName) || labelCandidates.get(displayName).length < length) {
      labelCandidates.set(displayName, { displayName, length, points });
    }
  }

  const roadLabels = [...labelCandidates.values()]
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .map(({ displayName, points }) => {
      const middleIndex = Math.floor((points.length - 1) / 2);
      const start = points[middleIndex];
      const end = points[Math.min(middleIndex + 1, points.length - 1)];
      let angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      if (angle > 90 || angle < -90) angle += 180;
      const x = (start.x + end.x) / 2;
      const y = (start.y + end.y) / 2;
      return `    <text class="road-label" x="${coordinate(x)}" y="${coordinate(y)}" transform="rotate(${coordinate(angle)} ${coordinate(x)} ${coordinate(y)})" fill="#314944" font-family="system-ui,sans-serif" font-size="15" font-weight="650" text-anchor="middle">${escapeXml(displayName)}</text>`;
    });

  const osmTransitNodes = nodes
    .filter(
      (node) =>
        node.tags?.public_transport || node.tags?.railway === 'station',
    )
    .map((node) => {
      const { x, y } = project(node.lat, node.lon);
      return `    <rect class="osm-transit" data-osm-node="${node.id}" x="${coordinate(x - 3)}" y="${coordinate(y - 3)}" width="6" height="6" fill="#6e807b" transform="rotate(45 ${coordinate(x)} ${coordinate(y)})"><title>${escapeXml(node.tags?.name ?? 'Transit stop')}</title></rect>`;
    });

  const duplicateCounts = new Map();
  const curatedStops = property.transit.nearbyStops.map((stop, index) => {
    const duplicateKey = `${stop.lat},${stop.lng}`;
    const duplicateIndex = duplicateCounts.get(duplicateKey) ?? 0;
    duplicateCounts.set(duplicateKey, duplicateIndex + 1);
    const point = project(stop.lat, stop.lng);
    const x = point.x + duplicateIndex * 20;
    const y = point.y;
    const line = stop.line === 'BUS' ? '29' : stop.line;
    return `    <g class="curated-stop" data-stop-index="${index}" transform="translate(${coordinate(x)} ${coordinate(y)})" aria-label="${escapeXml(`${stop.name}, ${stop.sub}`)}">
      <circle r="10" fill="#569bbe" stroke="#fff" stroke-width="3" />
      <text x="0" y="3.5" fill="#fff" font-family="system-ui,sans-serif" font-size="9" font-weight="700" text-anchor="middle">${escapeXml(line)}</text>
      <title>${escapeXml(`${stop.name} · ${stop.sub}`)}</title>
    </g>`;
  });

  const stopLabels = [...new Set(property.transit.nearbyStops.map((stop) => stop.name))]
    .map((name) => {
      const stop = property.transit.nearbyStops.find((item) => item.name === name);
      const { x, y } = project(stop.lat, stop.lng);
      return `    <text class="stop-label" x="${coordinate(x + 14)}" y="${coordinate(y - 13)}" fill="#314944" font-family="system-ui,sans-serif" font-size="13" font-weight="650">${escapeXml(name)}</text>`;
    });

  const cottage = project(property.address.lat, property.address.lng);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="map-title map-description">
  <title id="map-title">Offline neighborhood map around The SF Cottage in Ingleside</title>
  <desc id="map-description">Street and transit orientation map bounded by south ${south}, west ${west}, north ${north}, east ${east}.</desc>
  <metadata>OpenStreetMap data query: ${escapeXml(query)}</metadata>
  <style>
    .road-expressway,.road-primary,.road-secondary,.road-tertiary,.road-local,.road-other,.road-path{fill:none;stroke-linecap:round;stroke-linejoin:round}
    .road-expressway{stroke:#bd8e6c;stroke-width:8}.road-primary{stroke:#d5a46c;stroke-width:7}.road-secondary{stroke:#e2bd86;stroke-width:6}.road-tertiary{stroke:#ead2a7;stroke-width:5}.road-local{stroke:#fff;stroke-width:3}.road-other{stroke:#f7f8f5;stroke-width:2}.road-path{stroke:#cbd6cc;stroke-width:1.5;stroke-dasharray:4 4}
    .road-label,.stop-label{paint-order:stroke;stroke:#edf1ef;stroke-width:5;stroke-linejoin:round;fill:#314944;font-family:system-ui,sans-serif}.road-label{font-size:15px;font-weight:650;text-anchor:middle}.stop-label{font-size:13px;font-weight:650}
    .osm-transit{fill:#6e807b}.curated-stop circle{fill:#569bbe;stroke:#fff;stroke-width:3}.curated-stop text{fill:#fff;font:700 9px system-ui,sans-serif;text-anchor:middle}.cottage-marker{fill:#2c6d61;stroke:#fff;stroke-width:4}.cottage-label{fill:#14201d;font:700 17px system-ui,sans-serif;paint-order:stroke;stroke:#edf1ef;stroke-width:6}.map-attribution{fill:#4a605a;font:13px system-ui,sans-serif}.neighborhood-label{fill:#78908a;font:700 30px system-ui,sans-serif;letter-spacing:5px}
  </style>
  <rect width="${width}" height="${height}" fill="#edf1ef" />
  <text class="neighborhood-label" x="42" y="64">INGLESIDE</text>
  <g aria-label="OpenStreetMap roads">
${renderedWays.join('\n')}
  </g>
  <g aria-label="Road labels">
${roadLabels.join('\n')}
  </g>
  <g aria-label="OpenStreetMap transit features">
${osmTransitNodes.join('\n')}
  </g>
  <g aria-label="Curated nearby transit stops">
${curatedStops.join('\n')}
${stopLabels.join('\n')}
  </g>
  <g aria-label="The SF Cottage" transform="translate(${coordinate(cottage.x)} ${coordinate(cottage.y)})">
    <circle class="cottage-marker" r="13" />
    <circle fill="#fff" r="4" />
    <text class="cottage-label" x="19" y="6">The SF Cottage</text>
  </g>
  <g aria-label="North arrow" transform="translate(1130 64)">
    <path d="M0 24 L0 -16 M0 -16 L-7 -3 M0 -16 L7 -3" fill="none" stroke="#14201d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    <text x="0" y="-25" text-anchor="middle" fill="#14201d" font-family="system-ui,sans-serif" font-size="15" font-weight="700">N</text>
  </g>
  <rect x="0" y="846" width="1200" height="54" fill="#fdf6e7" />
  <text class="map-attribution" x="24" y="878">© OpenStreetMap contributors · ODbL</text>
  <text class="map-attribution" x="1176" y="878" text-anchor="end">Offline orientation map · not for turn-by-turn navigation</text>
</svg>
`;
}

function renderProvenance(endpoint) {
  const generatedOn = new Date().toISOString().slice(0, 10);
  return `# Ingleside neighborhood map provenance

- Bounds: south \`${south}\`, west \`${west}\`, north \`${north}\`, east \`${east}\`
- Generated: ${generatedOn}
- Overpass endpoint: ${endpoint}
- Generator: \`scripts/generate-offline-map.mjs\`
- Data attribution: © OpenStreetMap contributors, available under the Open Data Commons Open Database License (ODbL).

## Overpass query

\`\`\`overpass
${query}
\`\`\`

## Regeneration

From the \`app\` directory, intentionally refresh the checked-in map with:

\`\`\`sh
node scripts/generate-offline-map.mjs
\`\`\`
`;
}

const property = JSON.parse(await readFile(propertyPath, 'utf8'));
const { endpoint, extract } = await downloadExtract();
const svg = renderSvg(extract, property);
await writeFile(svgPath, svg, 'utf8');
await writeFile(provenancePath, renderProvenance(endpoint), 'utf8');

const wayCount = extract.elements.filter((element) => element.type === 'way').length;
const nodeCount = extract.elements.filter((element) => element.type === 'node').length;
console.log(
  `Generated ${path.relative(appRoot, svgPath)} from ${endpoint} (${wayCount} ways, ${nodeCount} nodes).`,
);
