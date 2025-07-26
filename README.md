# BabyZ Herobrine by khahahalid

BabyZ Herobrine is an intelligent Minecraft bot built using [mineflayer](https://github.com/PrismarineJS/mineflayer) that behaves like a real player. It can walk, mine, farm, guard, craft, and respond autonomously to chat commands, making it ideal for SMP servers or solo worlds.

---

## Features

- Joins Minecraft servers as a normal player (supports cracked/offline mode)  
- Auto-registration and login support (optional)  
- Uses advanced pathfinding to avoid hazards (lava, drops, etc.)  
- Mines ores and collects resources without griefing your base  
- Follows players on command  
- Guards your base by attacking hostile mobs nearby  
- Harvests and replants crops automatically  
- Crafts items from recipes available in inventory  
- Anti-AFK functionality: jumping and sneaking to avoid kicks  
- Supports chat commands to control behavior:  
  - `/baby mine <block_name>` — Mine nearby blocks of specified type  
  - `/baby follow` — Follow the command sender  
  - `/baby farm` — Start farming crops  
  - `/baby guard` — Protect the base from mobs  
  - `/baby craft <item_name>` — Craft specified item  
  - `/baby stop` — Stop current task  
  - `/baby idle` — Resume idle/autonomous mode

---

## Installation

1. Clone or download this repository:

   ```bash
   git clone https://github.com/khalidkhan-iscian/BabyZ-Herobrine.git
   cd BabyZ-Herobrine
   
2. Install required dependencies:

   ```bash
    npm install
   
3. Configure your bot by editing the settings.json file:

4. Set your Minecraft username under "bot-account".

5. For cracked accounts, set "type": "offline".

6. Configure your target server's IP, port, and Minecraft version.

7. Optionally adjust base location and radius if you want safe zone features.

8. Customize chat messages and other utilities as needed.

9. Usage
Start the bot by running:
   ```bash
   npm start
    
10. Once connected, the bot will send initial chat messages and enter idle mode.

11. Use the in-game chat commands to control the bot’s behavior:
    ```
    /baby mine diamond_ore — Finds and mines nearby diamond ore blocks.

    /baby follow <playername> — Follow a specified player.

    /baby farm — Harvest and replant crops near the bot.

    /baby guard — Defend the base by attacking hostile mobs.

    /baby craft bread — Craft bread if you have the recipe and materials.

    /baby stop — Stop current action and go idle.

    /baby idle — Return to autonomous idle behavior.

11. Notes
Make sure you use Node.js version 16 or newer for best compatibility.

The bot is designed to avoid mining or destroying blocks within your base radius to prevent griefing.

Supports Minecraft Java Edition 1.12.1 by default; update version in settings.json if necessary.

If you enable auto-auth in settings, the bot will register and login automatically using the provided password.

Anti-AFK is enabled by default to keep the bot active on servers that kick idle players.

## Troubleshooting
If the bot fails to connect, check your server IP, port, and Minecraft version settings.

For cracked accounts, ensure "type": "offline" in settings.json.

Update dependencies with npm install if modules are missing.

Monitor console output for errors and debug logs.

## License
MIT License © Khalid Khan

## Contact & Support
If you run into issues or want to contribute, open an issue or pull request on the GitHub repository.

Enjoy your intelligent Minecraft companion -> BabyZ Herobrine!
