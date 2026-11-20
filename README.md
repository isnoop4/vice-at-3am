# vice-at-3am

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/isnoop4/vice-at-3am/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/isnoop4/vice-at-3am/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

VICE AT 3 AM is a static, offline web app that turns photos into GTA 6-style multi-panel poster cover art and exports real PNGs. A cast of five characters (THE DRIVER, THE INSIDER, THE BOSS, THE RIDER, THE COURIER) fills five tilted panels under a giant chrome title that overlaps them, with a magenta script subtitle, a press-quote strip, a tagline ribbon, a gold ORIGINAL COVER ART seal and a barcode. Five colour grades (Night, Ember, Sunset, Ink, Duotone), two layouts, per-panel drag-to-position and zoom, editable role labels and captions, and a Surprise me button. Exports in 1080×1080, 1080×1350 and 1920×1080. No Rockstar logo, artwork or fonts: Anton (SIL OFL) and Yellowtail (Apache 2.0) ship under app/fonts/, and every photo is model-made for this entry.

## Run it

```sh
python3 -m http.server 8080 --directory app
```

Then open http://localhost:8080 in desktop Chrome. Click a photo in the library to fill the selected panel, drag the photo on the canvas to reposition it, edit the title and chips, and press Export PNG. Nothing is uploaded: photos are read on your own machine, and the app makes no network request.

---

Entered on [make.fun](https://make.fun/?ref=zr9ef9xb&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards
