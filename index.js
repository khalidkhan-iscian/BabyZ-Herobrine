const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock, GoalNear } } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const { Vec3 } = require('vec3');

const config = require('./settings.json');
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot has arrived'));
app.listen(8000, () => console.log('Server started'));

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);

  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);

  // Base safe zone config
  const baseCenter = new Vec3(config.base.x, config.base.y, config.base.z);
  const baseRadius = config.base.radius || 10;

  // State and task tracking
  let currentTask = null;
  let idleInterval = null;

  // Helper: check if position inside base safe zone
  function inBase(pos) {
    return pos.distanceTo(baseCenter) <= baseRadius;
  }

  // Helper: random head movement for human-like behavior
  function randomLook() {
    const yaw = (Math.random() - 0.5) * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * (Math.PI / 4);
    bot.look(yaw, pitch, true);
  }

  // Autonomous idle behavior loop
  async function startIdle() {
    if (idleInterval) clearInterval(idleInterval);
    bot.chat('Starting idle autonomous mode...');
    idleInterval = setInterval(async () => {
      randomLook();

      // Auto-eat if hungry
      if (bot.food < 14) {
        const foodItem = bot.inventory.items().find(i =>
          ['bread', 'apple', 'carrot', 'potato'].some(food => i.name.includes(food))
        );
        if (foodItem) {
          try {
            await bot.equip(foodItem, 'hand');
            await bot.consume();
            bot.chat('Yum!');
          } catch {}
        }
      }

      // Simple mining nearby ores outside base
      const ores = ['coal_ore', 'iron_ore', 'copper_ore'];
      for (const oreName of ores) {
        const oreBlock = bot.findBlock({
          matching: mcData.blocksByName[oreName].id,
          maxDistance: 32,
        });
        if (oreBlock && !inBase(oreBlock.position)) {
          bot.chat(`Mining nearby ${oreName}...`);
          try {
            await bot.collectBlock.collect(oreBlock);
          } catch {}
          break;
        }
      }
    }, 20 * 1000);
  }

  function stopIdle() {
    if (idleInterval) {
      clearInterval(idleInterval);
      idleInterval = null;
      bot.chat('Idle mode stopped.');
    }
  }

  // Cancel current task
  function stopCurrentTask() {
    bot.chat('Stopping current task...');
    currentTask = null;
    bot.pathfinder.setGoal(null);
    stopIdle();
  }

  // Mining command implementation
  async function mineBlock(blockName) {
    const block = mcData.blocksByName[blockName];
    if (!block) {
      bot.chat(`I don't recognize the block "${blockName}"`);
      return startIdle();
    }

    const blocks = bot.findBlocks({
      matching: block.id,
      maxDistance: 64,
      count: 5
    });

    if (blocks.length === 0) {
      bot.chat(`No ${blockName} nearby!`);
      return startIdle();
    }

    const targetBlock = bot.blockAt(blocks[0]);
    if (inBase(targetBlock.position)) {
      bot.chat(`Won't mine inside the base!`);
      return startIdle();
    }

    bot.chat(`Mining ${blockName}...`);
    currentTask = 'mining';

    try {
      await bot.collectBlock.collect(targetBlock);
      bot.chat(`Got some ${blockName}!`);
    } catch (err) {
      bot.chat(`Can't mine ${blockName}: ${err.message}`);
    }

    currentTask = null;
    startIdle();
  }

  // Follow player command implementation
  function followPlayer(targetName) {
    const target = bot.players[targetName]?.entity;
    if (!target) {
      bot.chat("Can't see you!");
      return startIdle();
    }
    currentTask = 'follow';
    bot.chat(`Following ${targetName}...`);
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalNear(target.position, 1));
  }

  // Guard base and attack hostile mobs
  async function startGuarding() {
    bot.chat('Guarding the base!');

    currentTask = 'guard';

    const guardInterval = setInterval(() => {
      if (currentTask !== 'guard') {
        clearInterval(guardInterval);
        return;
      }
      const mob = bot.nearestEntity(entity =>
        entity.type === 'mob' &&
        entity.position.distanceTo(bot.entity.position) < 20 &&
        !inBase(entity.position) &&
        entity.mobType !== 'Armor Stand' &&
        ['Zombie', 'Skeleton', 'Creeper', 'Spider', 'Enderman'].includes(entity.name)
      );
      if (mob) {
        bot.chat(`Attacking ${mob.name}!`);
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(new GoalNear(mob.position, 1));
        bot.attack(mob);
      }
    }, 5000);
  }

  // Simple farming (harvest + replant)
  async function startFarming() {
    bot.chat('Starting to farm crops...');
    currentTask = 'farm';

    const crops = ['wheat', 'carrots', 'potatoes'];
    const cropBlockIds = crops.map(crop => mcData.blocksByName[`${crop}_stage_7`]?.id).filter(Boolean);

    if (cropBlockIds.length === 0) {
      bot.chat("I don't know those crops!");
      return startIdle();
    }

    const farmInterval = setInterval(async () => {
      if (currentTask !== 'farm') {
        clearInterval(farmInterval);
        return;
      }

      const cropBlock = bot.findBlock({
        matching: block => cropBlockIds.includes(block.type),
        maxDistance: 32,
      });

      if (!cropBlock || inBase(cropBlock.position)) {
        bot.chat('No mature crops nearby or in base.');
        return;
      }

      bot.chat(`Harvesting crop at ${cropBlock.position}`);
      try {
        await bot.collectBlock.collect(cropBlock);

        // Replant seed
        for (const crop of crops) {
          const seedName = crop === 'wheat' ? 'wheat_seeds' : crop;
          const seedItem = bot.inventory.items().find(i => i.name === seedName);
          if (seedItem) {
            await bot.equip(seedItem, 'hand');
            await bot.placeBlock(bot.blockAt(cropBlock.position.offset(0, -1, 0)), new Vec3(0, 1, 0));
            bot.chat('Replanted crop.');
            break;
          }
        }
      } catch {}
    }, 20000);
  }

  // Crafting command
  async function craftItem(itemName) {
    const item = mcData.itemsByName[itemName];
    if (!item) {
      bot.chat(`I don't recognize the item "${itemName}"`);
      return startIdle();
    }

    if (!bot.recipesFor(item.id, null, 1).length) {
      bot.chat(`I can't craft ${itemName}`);
      return startIdle();
    }

    bot.chat(`Crafting 1 ${itemName}...`);
    try {
      const recipe = bot.recipesFor(item.id, null, 1)[0];
      await bot.craft(recipe, 1, null);
      bot.chat(`${itemName} crafted!`);
    } catch (err) {
      bot.chat(`Failed to craft ${itemName}: ${err.message}`);
    }
    startIdle();
  }

  // Build structure stub
  async function buildStructure(name) {
    bot.chat(`Sorry, building "${name}" not implemented yet.`);
    startIdle();
  }

  // Chat command handler
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith('/baby')) return;

    stopIdle();
    const command = message.slice(5).trim().toLowerCase();

    if (command.startsWith('mine')) {
      const blockName = command.replace('mine', '').trim().replace(/ /g, '_');
      mineBlock(blockName);
    } else if (command.startsWith('build')) {
      const structureName = command.replace('build', '').trim();
      buildStructure(structureName);
    } else if (command === 'follow') {
      followPlayer(username);
    } else if (command === 'stop') {
      stopCurrentTask();
    } else if (command === 'guard') {
      startGuarding();
    } else if (command === 'farm') {
      startFarming();
    } else if (command.startsWith('craft')) {
      const itemName = command.replace('craft', '').trim().replace(/ /g, '_');
      craftItem(itemName);
    } else if (command === 'idle') {
      startIdle();
    } else {
      bot.chat("I don't understand that command yet!");
      startIdle();
    }
  });

  // Auto-auth & ready message
  bot.once('spawn', () => {
    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      bot.chat(`/register ${password} ${password}`);
      bot.chat(`/login ${password}`);
    }
    bot.chat('Bot ready! Use /baby <command>');
    startIdle();
  });

  // Anti-AFK jump/sneak
  bot.on('physicTick', () => {
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
    }
  });

  bot.on('death', () => {
    bot.chat('I died but I am back!');
  });

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(() => createBot(), config.utils['auto-reconnect-delay'] || 5000);
    });
  }

  bot.on('error', err => console.log(`[ERROR] ${err.message}`));
  bot.on('kicked', reason => console.log(`[KICKED] ${reason}`));
}

createBot();
