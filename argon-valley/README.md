# Argon Valley

Cozy 3D valley and island life simulation built in Three.js featuring a custom rolling-horizon vertex shader, fishing, bug catching, gardening, crafting, and villager conversations.

![Argon Valley](../docs/screenshots/argon-valley.png)

## What it does
- **Rolling-world shader:** Custom GLSL vertex displacement curves terrain, rivers, waterfalls, trees, and cottages over a rolling cylinder horizon.
- **Tools & activities:** Equip the Fishing Rod (`1`), Shovel (`2`), Bug Net (`3`), or Watering Can (`4`) to catch river and ocean fish, net butterflies, dig up coin pouches, shake fruit trees, and craft furniture.
- **Dynamic sky & villagers:** Switch between *Morning*, *Noon*, *Golden Hour*, and *Starry Night* while chatting and trading gifts with valley villagers.

## How to run
```bash
python3 server.py --port 8083
```
Then open `http://localhost:8083` in your browser.
