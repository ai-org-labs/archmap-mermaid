# Compound layout regression fixtures

20 fixed Mermaid diagrams expand to 68 direction cases, plus one determinism/grid-order test (69 tests).
The six `irregular-*` fixtures were generated with fixed seeds 0–5 and are checked in; tests do not generate random input.

- `children-*`: 1 / 2 / 3 / 5 / 10 differently sized children.
- `mixed-spans`: simultaneous row/column spans and holes.
- `cycles-and-groups`: cycle, reverse/bidirectional edges, self-loop, group endpoints.
- `uneven-depth`, `irregular-*`: uneven depth, empty group, alternating directions and nested grids.
- `long-labels-media`: Japanese text, line breaks, icon, embedded PNG, edge labels.
- `dense-cross-links`: 27 cross-group edges including complete bipartite connections.
- `scale-*`: 50 / 100 / 200 nodes; 200 nodes in 5 and 10 columns.

Run `npx vitest run test/group-stress.test.ts`. Small diagrams run LR/RL/TB/BT; scale diagrams run LR with local TB directions.

The assertions cover retained elements, input immutability, finite SVG geometry, node/sibling-group overlaps, containment, canvas clipping, orthogonal routes, node/header/label penetration, repeatability and span placement. Rendering has a 10-second smoke-test ceiling per fixture; this is not a performance SLA. Parse time is excluded.

`*.metrics.json` records crossings, shared segments, bends, detour, aspect, node-area ratio and dimensions. Routing counts, canvas area and aspect must not regress against these fixed baselines. They do not imply perceptual perfection or optimal routes.

After intentional layout changes, inspect the SVGs before accepting updated baselines:

```sh
UPDATE_GROUP_METRICS=1 npx vitest run test/group-stress.test.ts
mkdir -p /tmp/archmap-group-metrics
GROUP_METRICS_REPORT=/tmp/archmap-group-metrics npx vitest run test/group-stress.test.ts
npm run build:library
GROUP_METRICS_REPORT=/tmp/archmap-group-metrics node tools/render-group-stress.mjs
```

The gallery is `docs/diagrams/group-grid/stress/index.html`. PNG generation is optional: make `@resvg/resvg-js` resolvable, or set `ARCHMAP_PNG_PACKAGE` to an installed package.json location containing that dependency. No browser or network image download is required; the image fixture is embedded.

Known limits: complete bipartite connections still cross; fixed column counts can create tall canvases; nested explicit directions retain blank areas required by large descendants. The measured crossings are frozen as regression baselines, not waived as visually ideal. PNG/SVG review is manual, not an automated pixel-diff assertion. Browser image loading failures, arbitrary-font metrics and every possible 400-node graph are outside this suite.
