# Argon Towers

2.5D tactical mazing tower defense built in Three.js where every turret placement dynamically recalculates A* enemy paths across an open 18×10 battlefield.
> **Create games in AI Studio:** Try building your own 3D games with Argon at **[ai.studio/build](https://ai.studio/build)**.


![Argon Towers](../docs/screenshots/argon-towers.png)

## What it does
- **Dynamic open-field mazing:** Build serpentine mazes across an open 18×10 battlefield with live A* pathfinding and anti-blocking path previews.
- **4 upgradeable 3D turrets:** Deploy and upgrade *Gatling*, *Goo*, *Missile*, and *Tesla* towers across 3 tiers (`U` to upgrade, `Backspace` to sell).
- **100 waves & 6 unit archetypes:** Defend against infantry grunts, sprint bikes, heavy mechs, armored tanks, attack helicopters, and blimp bosses.

## How to run
```bash
python3 -m http.server 8084
```
Then open `http://localhost:8084` in your browser.

---

**Create games in AI Studio:** [ai.studio/build](https://ai.studio/build)
