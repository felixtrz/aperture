# Third-Party Notices

Aperture is MIT-licensed (see `LICENSE`). It additionally incorporates the
third-party material listed below, under the licenses reproduced here.

---

## Runtime dependencies

- `elics` is distributed under the MIT License.
  Copyright (c) 2022 - present EliXR Games.
- `@preact/signals-core` is distributed under the MIT License.
  Copyright (c) 2022-present Preact Team.

## Development dependencies used in examples, tests, or tooling

- `wgpu-matrix` is distributed under the MIT License.
  Copyright (c) 2022 Gregg Tavares.
- `gl-matrix` is distributed under the MIT License.
  Copyright (c) 2015-2025 Brandon Jones, Colin MacKenzie IV.

---

## three.js — linearly-transformed-cosine (LTC) area-light data

`@aperture-engine/webgpu` embeds an LTC matrix/magnitude data table for area
lights in
`packages/webgpu/src/materials/standard/standard-area-light-ltc-data.ts`,
generated from three.js'
`examples/jsm/lights/RectAreaLightTexturesLib.js`. The underlying fit originates
from Eric Heitz and Stephen Hill's "Linearly Transformed Cosines" work,
published at <https://github.com/selfshadow/ltc_code> and used under the same
permissive terms via three.js.

three.js is distributed under the MIT License:

```
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

The dependencies listed above use the same MIT permission and warranty terms.
