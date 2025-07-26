const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock, GoalNear } } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const { Vec3 } = require('vec3');
const config = require('./settings.json');
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('BabyZ Bot Active!'));
app.listen(8000, () => console.log('Server started'));

function createBot() {
  const bot = mineflayer.createBot({
    username: 'BabyZ',      // Cracked account username
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
    auth: 'offline'         // No password needed
  });

  // Plugins
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);

  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);

  // Hazard avoidance
  defaultMove.liquidCost = 100;
  defaultMove.allow1by1towers = false;

  let currentTask = null;
  let idleTimer = null;

  // Stop any task
  function stopCurrentTask() {
    currentTask = null;
    bot.pathfinder.setGoal(null);
    stopIdle();
    bot.chat('Stopped current action.');
  }

  // Random idle behavior
  function startIdle() {
    stopIdle();
    idleTimer = setInterval(() => {
      randomLook();
      randomWalk();
      autoEat();
    }, 15000);
  }

  function stopIdle() {
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
  }

  // Look around
  function randomLook() {
    const yaw = (Math.random() - 0.5) * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * (Math.PI / 4);
    bot.look(yaw, pitch, true);
  }

  // Walk randomly
  function randomWalk() {
    const dx = Math.floor(Math.random() * 6) - 3;
    const dz = Math.floor(Math.random() * 6) - 3;
    const goal = new GoalBlock(
      Math.floor(bot.entity.position.x + dx),
      Math.floor(bot.entity.position.y),
      Math.floor(bot.entity.position.z + dz)
    );
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(goal);
  }

  // Auto-eat
  async function autoEat() {
    if (bot.food < 14) {
      const foodItem = bot.inventory.items().find(i =>
        ['bread', 'apple', 'carrot', 'potato'].some(f => i.name.includes(f))
      );
      if (foodItem) {
        try {
          await bot.equip(foodItem, 'hand');
          await bot.consume();
        } catch {}
      }
    }
  }

  // Mining command
  async function mineBlock(blockName) {
    stopCurrentTask();
    const block = mcData.blocksByName[blockName];
    if (!block) return bot.chat(`Unknown block: ${blockName}`);

    const blocks = bot.findBlocks({ matching: block.id, maxDistance: 64, count: 3 });
    if (blocks.length === 0) return bot.chat(`No ${blockName} nearby.`);

    currentTask = 'mining';
    for (const pos of blocks) {
      const targetBlock = bot.blockAt(pos);
      try {
        await bot.collectBlock.collect(targetBlock);
        bot.chat(`Mined ${blockName}!`);
      } catch (e) {
        bot.chat(`Failed mining: ${e.message}`);
      }
    }
    currentTask = null;
    startIdle();
  }

  // Follow command
  function followPlayer(username) {
    stopCurrentTask();
    const target = bot.players[username]?.entity;
    if (!target) return bot.chat("Can't see you!");

    currentTask = 'follow';
    bot.chat(`Following ${username}...`);
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 1));
  }

  // Farming command
  async function startFarming() {
    stopCurrentTask();
    bot.chat('Farming mode active.');

    const crops = ['wheat', 'carrots', 'potatoes'];
    const cropStages = crops.map(c => mcData.blocksByName[`${c}_stage_7`]?.id).filter(Boolean);

    currentTask = 'farming';
    const farmLoop = setInterval(async () => {
      if (currentTask !== 'farming') return clearInterval(farmLoop);

      const crop = bot.findBlock({
        matching: block => cropStages.includes(block.type),
        maxDistance: 32
      });

      if (!crop) return;

      try {
        await bot.collectBlock.collect(crop);
        for (const c of crops) {
          const seedName = c === 'wheat' ? 'wheat_seeds' : c;
          const seed = bot.inventory.items().find(i => i.name === seedName);
          if (seed) {
            await bot.equip(seed, 'hand');
            await bot.placeBlock(bot.blockAt(crop.position.offset(0, -1, 0)), new Vec3(0, 1, 0));
            break;
          }
        }
      } catch {}
    }, 20000);
  }

  // Crafting command
  async function craftItem(itemName) {
    stopCurrentTask();
    const item = mcData.itemsByName[itemName];
    if (!item) return bot.chat(`Unknown item: ${itemName}`);

    const recipe = bot.recipesFor(item.id, null, 1)[0];
    if (!recipe) return bot.chat(`Can't craft ${itemName}`);

    try {
      await bot.craft(recipe, 1, null);
      bot.chat(`${itemName} crafted!`);
    } catch (err) {
      bot.chat(`Crafting failed: ${err.message}`);
    }
    startIdle();
  }

  // Command handler
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith('/baby')) return;

    const args = message.slice(5).trim().split(' ');
    const cmd = args.shift()?.toLowerCase();

    switch (cmd) {
      case 'mine':
        mineBlock(args.join('_'));
        break;
      case 'follow':
        followPlayer(username);
        break;
      case 'farm':
        startFarming();
        break;
      case 'craft':
        craftItem(args.join('_'));
        break;
      case 'stop':
        stopCurrentTask();
        break;
      case 'idle':
        startIdle();
        break;
      case 'help':
        bot.chat('Commands: /baby mine <block>, follow, farm, craft <item>, stop, idle');
        break;
      default:
        bot.chat('Unknown command. Use /baby help');
    }
  });

  // On spawn
  bot.once('spawn', () => {
    bot.chat('BabyZ is online! Type /baby help');
    startIdle();
  });

  // Anti-AFK
  bot.on('physicTick', () => {
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
    }
  });

  // Reconnect on end
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => setTimeout(createBot, config.utils['auto-reconnect-delay'] || 5000));
  }

  bot.on('error', err => console.log(`[ERROR] ${err.message}`));
  bot.on('kicked', reason => console.log(`[KICKED] ${reason}`));
}

createBot();
