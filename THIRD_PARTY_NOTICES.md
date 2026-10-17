# Third-party notices

ORYN's npm dependencies carry their own licences (see each package in `node_modules`). This file records source code adapted into ORYN from other projects.

## God's Eye View

ORYN's public-event layers, feed-state model, and event inspector adapt ideas and small portions of code from God's Eye View (https://github.com/bilawalsidhu/gods-eye-view, reviewed at commit `1df2a27`):

| ORYN file | Adapted from |
| --- | --- |
| `src/lib/public-events.ts` (`feedState`) | `src/data/feedState.js` (feed-state model) |
| `src/server/public-events/normalize.ts` (`normalizeEarthquakes`) | `src/layers/earthquakes/records.js` (all-or-nothing USGS validation) |
| `src/server/public-events/service.ts` | `server/providers/firePerimeters.js` (WFIGS query fields, paging, cache and serve-stale pattern) |
| `src/components/map/event-inspector.tsx` | `src/layers/perimeters/cards.js` (entity card fields) |

Only source code was adapted. No data, imagery, 3D models, fonts, or other assets from God's Eye View are included in ORYN. Its repository notes that its bundled datasets and models are **not** covered by its MIT licence (for example the TeleGeography cable data and the Bhote Koshi imagery are non-commercial); none of them are used here.

```
MIT License

Copyright (c) 2026 Bilawal Sidhu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
