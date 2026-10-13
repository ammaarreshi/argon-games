# The Corridor

First-person psychological horror engine built in Three.js with custom 35mm surveillance post-processing shaders, physically based flashlight lighting, spatial audio, and 5 mutating corridor loops.
> **Create games in AI Studio:** Try building your own 3D games with Argon at **[ai.studio/build](https://ai.studio/build)**.


![The Corridor](../docs/screenshots/the-corridor.png)

## What it does
- **Surveillance PBR & flashlight pipeline:** Custom film grain, chromatic aberration, vignette, and dynamic flashlight shadow cone (`F` to toggle flashlight, `Z` or right-click to zoom inspect).
- **5 mutating corridor loops:** Every pass through the stairwell door transforms the corridor's lighting, props, radio broadcasts, and anomalies (`1`–`5` to jump between loops).
- **6-piece photograph puzzle:** Inspect environmental clues (`E`) to assemble the torn portrait while evading the corridor apparition.

## How to run
```bash
python3 server.py --port 8085
```
Then open `http://localhost:8085` in your browser.

---

**Create games in AI Studio:** [ai.studio/build](https://ai.studio/build)
