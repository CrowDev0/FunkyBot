const { Client, MessageAttachment } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { QuickDB } = require('quick.db');
const { createCanvas, loadImage } = require('canvas');

const fs = require('fs');

const token = "";

const commands = [{
    name: 'profile',
    description: 'Shows your funky profile.'
}];

const rest = new REST({ version: '9' }).setToken(token);

const db = new QuickDB({ filePath: "res/saveDB.sqlite" });

const levels = JSON.parse(fs.readFileSync("res/levels.json"));

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands("979839063630688276", "970524790156849182"),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

const client = new Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
  intents: ['DIRECT_MESSAGES', 'DIRECT_MESSAGE_REACTIONS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILDS']
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  switch (interaction.commandName) {
    case "profile":
      let user = interaction.member.user;

      let points = await db.get(`${user.id}.points`);
      let level = await db.get(`${user.id}.level`);
      let nextLevelRequirement = Math.floor((100 + (1 + ((level + 1) / 5))) * (level + 1));
      let currentLevelRequirement = Math.floor(100 + (1 + ((level / 5))) * level);

      await interaction.deferReply();

      if (isNaN(points) || points < 0) {
        await db.set(`${user.id}`, { level: 1, points: 0, lastXPDrop: 0 });

        level = 1;
        points = 0;
      }

      let canvas = createCanvas(1000, 350);
      let ctx = canvas.getContext('2d');

      let outputAttachment = null;

      ctx.fillStyle = '#44404a';

      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.fill();

      ctx.fillStyle = '#231f29';

      ctx.beginPath();
      ctx.rect(0, 300, canvas.width, 300);
      ctx.fill();

      ctx.fillStyle = '#64d97b';

      ctx.beginPath();

      if (level > 1) {
        ctx.rect(0, 300, (((points - currentLevelRequirement) / nextLevelRequirement) * 1000), 300);
      } else {
        ctx.rect(0, 300, ((points / nextLevelRequirement) * 1000), 300);
      }

      ctx.fill();

      ctx.fillStyle = 'white';

      let avatar = await loadImage(user.displayAvatarURL({ format: 'png', size: 256 }));

      ctx.save();

      ctx.beginPath();
      ctx.arc(135, 145, 100, 0, Math.PI*2, true);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(avatar, 35, 45, 200, 200);

      ctx.restore();

      ctx.font = '80px Roboto';
      ctx.fillText(user.tag, 220, 100);

      ctx.font = '50px Roboto';

      if (level > 1) {
        ctx.fillText(`${Math.floor(points - currentLevelRequirement)} / ${nextLevelRequirement} Funky Points`, 260, 165);
      } else {
        ctx.fillText(`${points} / ${nextLevelRequirement} Funky Points`, 260, 165);
      }

      ctx.fillText(`Level ${level}:`, 260, 235);

      let levelData = null;

      if (level < 20) {
        levelData = levels[level];
      } else {
        levelData = levels[20];
      }

      ctx.fillStyle = levelData.color;
      ctx.font = `${levelData.size}px Roboto`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${levelData.name}`, 520, 217);

      let out = fs.createWriteStream(`output.png`);
      let stream = canvas.createPNGStream();
      await stream.pipe(out);

      out.on('finish', () => {
        outputAttachment = new MessageAttachment(`output.png`);

        interaction.editReply({ files: [ outputAttachment ] });
      });

      break;
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) { return; }

  let points = await db.get(`${message.author.id}.points`);
  let level = await db.get(`${message.author.id}.level`);

  if (isNaN(points) || points < 0) {
    await db.set(`${message.author.id}`, { level: 1, points: 0, lastXPDrop: (Date.now() - 30000) });
    level = 1;
    points = 0;
  }

  let xpTimestamp = await db.get(`${message.author.id}.lastXPDrop`);
  let time = Date.now();
  let cooldown = 30000;

  if (time - xpTimestamp < cooldown) { return; }
  
  let addPoints = getRandomInt(50);

  let nextLevelRequirement = Math.floor((100 + (1 + ((level + 1) / 5))) * (level + 1));

  points += addPoints;

  if (points >= nextLevelRequirement) {
    level += 1;

    message.channel.send(`Congrats <@${message.author.id}>, you're now level ${level}!\n\nExtra Fries!!!`);
  }

  await db.set(`${message.author.id}`, { level: level, points: points, lastXPDrop: time });
  console.log(`Added ${addPoints} Funky Points to ${message.author.tag}!`);
});

client.login(token);