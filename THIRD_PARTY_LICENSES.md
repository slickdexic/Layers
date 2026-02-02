# Third-Party Licenses and Attribution

This document provides attribution and license information for third-party assets bundled with the MediaWiki Layers extension.

## Summary

The Layers extension includes the following third-party assets:

| Asset Category | Count | License | Source |
|----------------|-------|---------|--------|
| Google Fonts (WOFF2) | 106 files | SIL Open Font License 1.1 | Google Fonts |
| Google Noto Color Emoji | 3,731 SVGs | SIL Open Font License 1.1 | GitHub |
| IEC 60417 Symbols | ~500 SVGs | Public Domain / CC0 | Wikimedia Commons |
| ISO 7010 Safety Signs | varies | Public Domain | Wikimedia Commons |
| ISO 7000 Symbols | varies | Public Domain | Wikimedia Commons |
| ISO 15223-1 Medical Symbols | varies | Public Domain | Wikimedia Commons |
| ANSI Z535 Safety Symbols | 34 SVGs | Public Domain | Wikimedia Commons |
| GHS Hazard Pictograms | 8 SVGs | Public Domain | Wikimedia Commons |
| ECB Hazard Symbols | 10 SVGs | Public Domain | Wikimedia Commons |

---

## Google Fonts (Self-Hosted Web Fonts)

**Location:** `resources/ext.layers.shared/fonts/`

**Source:** https://fonts.google.com/

**License:** SIL Open Font License, Version 1.1

**Total Size:** ~2.5 MB (106 WOFF2 files)

### Included Font Families (32 fonts)

**Sans-Serif (14):**
Roboto, Open Sans, Lato, Montserrat, Noto Sans, Source Sans 3, PT Sans, Ubuntu, Inter, Poppins, Work Sans, Nunito, Raleway, DM Sans

**Serif (6):**
Merriweather, Playfair Display, Lora, Libre Baskerville, EB Garamond, Crimson Text

**Display (4):**
Bebas Neue, Oswald, Archivo Black, Fredoka

**Handwriting (4):**
Caveat, Dancing Script, Pacifico, Indie Flower

**Monospace (4):**
Source Code Pro, Fira Code, JetBrains Mono, IBM Plex Mono

Each font includes regular (400) and bold (700) weights, with italic variants where available.

### Why Self-Hosted?

Fonts are self-hosted rather than loaded from Google Fonts CDN for:
- **Privacy:** No external requests to Google servers
- **Reliability:** Fonts always available, no network dependency
- **Performance:** Fonts cached locally with MediaWiki ResourceLoader
- **Compliance:** Better for privacy-focused wiki installations

---

## Google Noto Color Emoji

**Location:** `resources/ext.layers.editor/shapeLibrary/emoji-bundle.json`

**Source:** https://github.com/googlefonts/noto-emoji

**License:** SIL Open Font License, Version 1.1

**Copyright:** Copyright 2021 Google Inc. All Rights Reserved.

### SIL Open Font License 1.1

```
PREAMBLE

The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS

"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS

Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION

This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

## IEC 60417 Graphical Symbols

**Location:** `resources/ext.layers.editor/shapeLibrary/assets/iec_60417/`

**Source:** Wikimedia Commons

**License:** Public Domain / CC0

These symbols are graphical representations of IEC 60417 standard symbols. The symbol designs themselves are standardized by the International Electrotechnical Commission (IEC). The SVG implementations on Wikimedia Commons are released to the public domain or under CC0.

**Note:** While these SVG files are freely usable, the IEC 60417 standard itself is copyrighted by IEC. These files represent community-created implementations of the publicly-known symbol designs for educational and informational purposes.

---

## ISO Safety Signs and Symbols

### ISO 7010 Safety Signs

**Location:** `resources/ext.layers.editor/shapeLibrary/assets/iso/iso_7010/`

**Source:** Wikimedia Commons

**License:** Public Domain

ISO 7010 defines graphical symbols for safety signs. The symbol designs are internationally standardized. SVG implementations from Wikimedia Commons are in the public domain.

### ISO 7000 Graphical Symbols

**Location:** `resources/ext.layers.editor/shapeLibrary/assets/iso/iso_7000/`

**Source:** Wikimedia Commons

**License:** Public Domain

ISO 7000 defines graphical symbols for use on equipment. SVG implementations from Wikimedia Commons are in the public domain.

### ISO 15223-1 Medical Device Symbols

**Location:** `resources/ext.layers.editor/shapeLibrary/assets/iso/iso_15223-1/`

**Source:** Wikimedia Commons

**License:** Public Domain

ISO 15223-1 defines symbols for use in medical device labeling. SVG implementations from Wikimedia Commons are in the public domain.

---

## ANSI Z535 Safety Symbols

**Location:** `resources/ext.layers.editor/shapeLibrary/assets/ansi/`

**Source:** Wikimedia Commons

**License:** Public Domain

ANSI Z535 is the American National Standard for safety signs and colors. The SVG implementations from Wikimedia Commons are released to the public domain.

**Files include:**
- Mandatory action symbols (dust mask, goggles, hardhat, headphones, respirator)
- Warning symbols (electric shock, fire, poison, caustic, hot surface, wet floor)
- Safety information symbols (eyewash, safety shower)
- Hazard symbols (entanglement, pinch, severing, crush, laceration)

---

## GHS Hazard Pictograms

**Location:** `resources/ext.layers.editor/shapeLibrary/assets/ghs/`

**Source:** Wikimedia Commons

**License:** Public Domain

The Globally Harmonized System of Classification and Labelling of Chemicals (GHS) pictograms are internationally standardized symbols. These SVG files from Wikimedia Commons are in the public domain.

**Files:**
- `GHS-pictogram-acid.svg` - Corrosive
- `GHS-pictogram-bottle.svg` - Gas under pressure
- `GHS-pictogram-exclam.svg` - Harmful/Irritant
- `GHS-pictogram-explos.svg` - Explosive
- `GHS-pictogram-flamme.svg` - Flammable
- `GHS-pictogram-pollu.svg` - Environmental hazard
- `GHS-pictogram-silhouette.svg` - Health hazard
- `GHS-pictogram-skull.svg` - Toxic

---

## ECB Hazard Symbols

**Location:** `resources/ext.layers.editor/shapeLibrary/assets/ecb/`

**Source:** Wikimedia Commons

**License:** Public Domain

European hazard symbols (formerly required under EU Directive 67/548/EEC) from Wikimedia Commons, released to the public domain.

**Files:**
- `ECB_Hazard_Symbol_C.svg` - Corrosive
- `ECB_Hazard_Symbol_E.svg` - Explosive
- `ECB_Hazard_Symbol_F.svg` - Flammable
- `ECB_Hazard_Symbol_F+.svg` - Extremely flammable
- `ECB_Hazard_Symbol_N.svg` - Dangerous for the environment
- `ECB_Hazard_Symbol_O.svg` - Oxidizing
- `ECB_Hazard_Symbol_T.svg` - Toxic
- `ECB_Hazard_Symbol_T+.svg` - Very toxic
- `ECB_Hazard_Symbol_Xi.svg` - Irritant
- `ECB_Hazard_Symbol_Xn.svg` - Harmful

---

## Attribution Summary

This extension bundles third-party assets in compliance with their respective licenses:

1. **Google Noto Color Emoji** - Used under SIL OFL 1.1, which permits bundling with software. This license file serves as the required attribution.

2. **Wikimedia Commons symbols** - All symbol files sourced from Wikimedia Commons are either:
   - Released to the **Public Domain** by their creators
   - Licensed under **CC0** (Creative Commons Zero)
   - Simple geometric representations of internationally standardized symbols

No additional attribution is legally required for public domain works, but we acknowledge the Wikimedia Commons community for making these resources freely available.

---

## Questions or Concerns

If you believe any asset has been incorrectly attributed or licensed, please open an issue at:
https://github.com/slickdexic/Layers/issues
