# Third-party notices and asset provenance

The ISC license covers original project code. It does not relicense dependencies,
third-party media, font software or trademarks. Preserve their upstream notices.
The project owner confirmed source-redistribution rights for the included audio
and 3D assets on 21 September 2026. This records that confirmation; it is not a
substitute for the original licenses or any separate permission granted to the owner.

| Material | Provenance / terms |
| --- | --- |
| npm dependencies (root, admin and art tools) | Versions and license metadata are recorded in each `package-lock.json`; upstream LICENSE files remain authoritative |
| Oxanium font | Installed through `@fontsource/oxanium`; SIL Open Font License copy in `unity/design/OXANIUM-LICENSE.txt` |
| Werewolf audio | Detailed source mapping, authors and transformed clip descriptions in [public/audio/werewolf/README.md](public/audio/werewolf/README.md) |
| Pixabay-derived Werewolf clips | Pixabay Content License; preserve source credits and any separate redistribution permission. These files are not relicensed ISC |
| Dustyroom transition/countdown cues | Free Casual Game Sounds, CC0, as recorded in the Werewolf README |
| Meshy-refined companion model | Provenance in [assets/ai-companion/meshy-refined-v1/README.md](assets/ai-companion/meshy-refined-v1/README.md); owner-confirmed redistribution, retain applicable source/provider terms |
| Other audio in `public/`, original Blender/model/image assets | Owner-confirmed redistribution; preserve any file-specific notices. The confirmation does not grant third-party trademark rights |
| Radio streams | External providers in `src/radio.ts`; not redistributed recordings and not an uptime or reuse guarantee |
| Native/Unity packages | Retain their package-specific notices; separate build toolchains are not covered by the web CI |

Pixabay's general terms restrict standalone content redistribution; inclusion in
a game and publishing reusable source media are different contexts. Any separately
obtained permission remains specific to its grant. Downstream users should check
the original terms and their own use, including extraction of media from the game.
[Pixabay license summary](https://pixabay.com/service/license-summary/).

Brand names, business logos, architectural references and vehicle designs do not
imply sponsorship, endorsement or a trademark license. When adding or replacing
assets, record creator, original URL, license, modifications and distribution
permission beside the asset or in this file. Keep receipts/private permission
records outside the public repository.
