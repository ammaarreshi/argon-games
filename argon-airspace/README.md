# Argon Airspace

1950s air traffic management arcade game built in Three.js orthographic WebGL with multi-touch Catmull-Rom flight path drawing, TCAS conflict detection, and spatial Web Audio.
> **Create games in AI Studio:** Try building your own 3D games with Argon at **[ai.studio/build](https://ai.studio/build)**.


![Argon Airspace](../docs/screenshots/argon-airspace.png)

## What it does
- **Path drawing:** Click and drag from any incoming aircraft to its color-matched runway or helipad to lock in a smooth Catmull-Rom spline approach.
- **3 airfields & 4 aircraft classes:** Guide heavy red jetliners, yellow twin-props, blue vintage biplanes, and green rotorcraft across *Classic Outback*, *Resort Atoll*, and *Naval Carrier*.
- **Dynamic weather & alerts:** Real-time TCAS proximity rings, wind gusts, 2x fast-forward toggle, and cabin PA callouts.

## How to run
```bash
python3 -m http.server 8081
```
Then open `http://localhost:8081` in your browser.

---

**Create games in AI Studio:** [ai.studio/build](https://ai.studio/build)
