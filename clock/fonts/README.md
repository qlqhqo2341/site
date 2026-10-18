# Bundled clock webfonts

The WOFF2 files contain only `0123456789:`. They are hosted alongside the app;
visitors do not connect to an external font service. All six files together are
15 KB.

| Files | Typeface | Source / license |
| --- | --- | --- |
| `rounded-600.woff2` | Open Runde Semibold | [Open Runde](https://github.com/lauridskern/open-runde), `../OpenRunde-LICENSE.txt` |
| `inter-300.woff2`, `inter-500.woff2` | Inter Light / Medium | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/inter), `inter-LICENSE.txt` |
| `plex-mono-400.woff2` | IBM Plex Mono Regular | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/ibmplexmono), `ibmplexmono-LICENSE.txt` |
| `lora-500.woff2` | Lora Medium | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/lora), `lora-LICENSE.txt` |
| `orbitron-500.woff2` | Orbitron Medium | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/orbitron), `orbitron-LICENSE.txt` |

Open Runde was subset from the upstream OTF with fontTools. Other subsets were
obtained from the Google Fonts CSS API with the same character list and the
weights shown above, then compressed to WOFF2 with fontTools. Source attribution and SIL Open Font License notices are
included with the app. Numeric advances in `clock.js` are calculated from these
exact files. The default rounded face retains its original SVG outlines.
