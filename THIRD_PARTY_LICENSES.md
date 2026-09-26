# Third-Party Licenses

This project depends on open-source software. Below is a summary of each
dependency, its license, and where to find the original text.

---

## Direct Dependencies

### @modelcontextprotocol/server — v2.1.0
- **License:** MIT
- **Copyright:** Anthropic, PBC
- **Source:** https://github.com/modelcontextprotocol/typescript-sdk
- **Used in:** `packages/server`

### zod — v3.25.x
- **License:** MIT
- **Copyright:** Colin McDonnell
- **Source:** https://github.com/colinhacks/zod
- **Used in:** `packages/server` (input schema validation)

### glob — v11.x
- **License:** Blue Oak Model License 1.0.0
- **Copyright:** Isaac Z. Schlueter
- **Source:** https://github.com/isaacs/node-glob
- **Used in:** `packages/server` (file pattern matching)
- **Note:** Blue Oak 1.0.0 is a permissive license. Full text below.

### commander — v13.x
- **License:** MIT
- **Copyright:** TJ Holowaychuk
- **Source:** https://github.com/tj/commander.js
- **Used in:** `packages/cli`

### chalk — v5.x
- **License:** MIT
- **Copyright:** Sindre Sorhus
- **Source:** https://github.com/chalk/chalk
- **Used in:** `packages/cli` (terminal colors)

### ora — v8.x
- **License:** MIT
- **Copyright:** Sindre Sorhus
- **Source:** https://github.com/sindresorhus/ora
- **Used in:** `packages/cli` (spinners)

### fs-extra — v11.x
- **License:** MIT
- **Copyright:** JP Richardson
- **Source:** https://github.com/jprichardson/node-fs-extra
- **Used in:** `packages/cli`

---

## Development Dependencies

### typescript — v5.9.x
- **License:** Apache License 2.0
- **Copyright:** Microsoft Corporation
- **Source:** https://github.com/microsoft/TypeScript
- **Note:** Apache 2.0 full text below.

### tsx — v4.x
- **License:** MIT
- **Copyright:** Hiroki Osame
- **Source:** https://github.com/privatenumber/tsx

### vitest — v3.x
- **License:** MIT
- **Copyright:** Anthony Fu, Matías Capeletto, and Vitest contributors
- **Source:** https://github.com/vitest-dev/vitest

### @types/node — v22.x
- **License:** MIT
- **Copyright:** DefinitelyTyped contributors
- **Source:** https://github.com/DefinitelyTyped/DefinitelyTyped

### @types/fs-extra — v11.x
- **License:** MIT
- **Copyright:** DefinitelyTyped contributors
- **Source:** https://github.com/DefinitelyTyped/DefinitelyTyped

---

## Transitive Dependencies (notable)

### jackspeak, minimatch, minipass, path-scurry, lru-cache
- **License:** Blue Oak Model License 1.0.0
- **Copyright:** Isaac Z. Schlueter
- **Note:** Sub-dependencies of `glob`. Permissive license.

---

## Recipe-Referenced Libraries

These are **not bundled** with Atelier MCP. They are referenced in recipe code
snippets and installed by users into their own projects.

### motion (Framer Motion) — v12.x
- **License:** MIT
- **Copyright:** Framer B.V.
- **Source:** https://github.com/motiondivision/motion

### Playwright — (optional, for screenshots)
- **License:** Apache License 2.0
- **Copyright:** Microsoft Corporation
- **Source:** https://github.com/microsoft/playwright

---

## Full License Texts

### MIT License

```
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

### Apache License 2.0

```
                              Apache License
                        Version 2.0, January 2004
                     http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

   "License" shall mean the terms and conditions for use, reproduction,
   and distribution as defined by Sections 1 through 9 of this document.

   "Licensor" shall mean the copyright owner or entity authorized by the
   copyright owner that is granting the License.

   "Legal Entity" shall mean the union of the acting entity and all other
   entities that control, are controlled by, or are under common control
   with that entity.

   "You" (or "Your") shall mean an individual or Legal Entity exercising
   permissions granted by this License.

   "Source" form shall mean the preferred form for making modifications,
   including but not limited to software source code, documentation source,
   and configuration files.

   "Object" form shall mean any form resulting from mechanical transformation
   or translation of a Source form.

   "Work" shall mean the work of authorship made available under the License.

   "Derivative Works" shall mean any work that is based on the Work.

   "Contribution" shall mean any work of authorship submitted to the Licensor
   for inclusion in the Work.

   "Contributor" shall mean Licensor and any Legal Entity on behalf of whom
   a Contribution has been received by the Licensor.

2. Grant of Copyright License. Subject to the terms and conditions of this
   License, each Contributor hereby grants to You a perpetual, worldwide,
   non-exclusive, no-charge, royalty-free, irrevocable copyright license to
   reproduce, prepare Derivative Works of, publicly display, publicly
   perform, sublicense, and distribute the Work and such Derivative Works
   in Source or Object form.

3. Grant of Patent License. Subject to the terms and conditions of this
   License, each Contributor hereby grants to You a perpetual, worldwide,
   non-exclusive, no-charge, royalty-free, irrevocable patent license to
   make, have made, use, offer to sell, sell, import, and otherwise transfer
   the Work.

4. Redistribution. You may reproduce and distribute copies of the Work or
   Derivative Works thereof in any medium, with or without modifications,
   and in Source or Object form, provided that You meet the following
   conditions:

   (a) You must give any other recipients of the Work or Derivative Works
       a copy of this License; and
   (b) You must cause any modified files to carry prominent notices stating
       that You changed the files; and
   (c) You must retain, in the Source form of any Derivative Works, all
       copyright, patent, trademark, and attribution notices; and
   (d) If the Work includes a "NOTICE" text file, You must include a
       readable copy of the attribution notices contained within.

5. Submission of Contributions. Unless You explicitly state otherwise, any
   Contribution intentionally submitted for inclusion in the Work shall be
   under the terms and conditions of this License, without any additional
   terms or conditions.

6. Trademarks. This License does not grant permission to use the trade names,
   trademarks, service marks, or product names of the Licensor.

7. Disclaimer of Warranty. The Work is provided on an "AS IS" BASIS, WITHOUT
   WARRANTIES OR CONDITIONS OF ANY KIND.

8. Limitation of Liability. In no event shall any Contributor be liable to
   You for damages, including any direct, indirect, special, incidental, or
   consequential damages.

9. Accepting Warranty or Additional Liability. You may choose to offer, and
   charge a fee for, acceptance of support, warranty, indemnity, or other
   liability obligations consistent with this License.

END OF TERMS AND CONDITIONS
```

### Blue Oak Model License 1.0.0

```
Blue Oak Model License

Version 1.0.0

Purpose

This license gives everyone as much permission to work with this software
as possible, while protecting contributors from liability.

Acceptance

In order to receive this license, you must agree to its rules. The rules
of this license are both obligations under that agreement and conditions
to your license. You must not do anything with this software that triggers
a rule that you cannot or will not follow.

Copyright

Each contributor licenses you to do everything with this software that
would otherwise infringe that contributor's copyright in it.

Notices

You must ensure that everyone who gets a copy of any part of this software
from you, with or without changes, also gets the text of this license or a
link to https://blueoakcouncil.org/license/1.0.0.

Excuse

If anyone notifies you in writing that you have not complied with Notices,
you can keep your license by taking all practical steps to comply within
30 days after the notice. If you do not do so, your license ends immediately.

Patent

Each contributor licenses you to do everything with this software that would
otherwise infringe any patent claims they can license or become able to
license.

Reliability

No contributor can revoke this license.

No Liability

AS FAR AS THE LAW ALLOWS, THIS SOFTWARE COMES AS IS, WITHOUT ANY WARRANTY
OR CONDITION, AND NO CONTRIBUTOR WILL BE LIABLE TO ANYONE FOR ANY DAMAGES
RELATED TO THIS SOFTWARE OR THIS LICENSE, UNDER ANY KIND OF LEGAL CLAIM.
```
