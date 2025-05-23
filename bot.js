const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} = require('@discordjs/voice');
const gTTS = require('gtts');
const fs = require('fs');
const express = require('express');
const app = express();
app.use(express.json());
app.use(require('cors')());

const TOKEN = 'YOUR_BOT_TOKEN';
const PORT = 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const ttsQueues = new Map();

client.once('ready', () => {
  console.log(`Bot is ready as ${client.user.tag}`);
});

function addToQueue(guildId, voiceChannelId, textChannelId, text) {
  const key = `${guildId}:${voiceChannelId}`;
  if (!ttsQueues.has(key)) {
    ttsQueues.set(key, []);
  }

  const queue = ttsQueues.get(key);
  queue.push({ text, textChannelId, playing: false });

  if (!queue[0].playing) {
    playQueue(guildId, voiceChannelId);
  }
}

async function playQueue(guildId, voiceChannelId) {
  const key = `${guildId}:${voiceChannelId}`;
  const queue = ttsQueues.get(key);
  if (!queue || queue.length === 0) return;

  const current = queue[0];
  current.playing = true;

  const guild = client.guilds.cache.get(guildId);
  const textChannel = guild.channels.cache.get(current.textChannelId);
  const voiceChannel = guild.channels.cache.get(voiceChannelId);

  if (!textChannel || !voiceChannel) return;

  // ส่ง Embed
  const embed = new EmbedBuilder()
    .setTitle('TTS กำลังพูดข้อความ')
    .setDescription(current.text)
    .setColor(0x0099ff)
    .setTimestamp();

  textChannel.send({ embeds: [embed] });

  // สร้างไฟล์เสียง
  const filePath = `tts_${Date.now()}.mp3`;
  const gtts = new gTTS(current.text, 'th');
  gtts.save(filePath, () => {
    const connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      fs.unlinkSync(filePath);
      connection.destroy();
      queue.shift();
      if (queue.length > 0) {
        playQueue(guildId, voiceChannelId);
      } else {
        ttsQueues.delete(key);
      }
    });
  });
}

// API ที่ PHP จะเรียก
app.post('/speak', async (req, res) => {
  const { text, guildId, voiceChannelId, textChannelId } = req.body;
  if (!text || !guildId || !voiceChannelId || !textChannelId) {
    return res.status(400).send('Missing parameters');
  }

  addToQueue(guildId, voiceChannelId, textChannelId, text);
  res.send('ข้อความถูกเพิ่มในคิวและกำลังแสดง Embed...');
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});

client.login(TOKEN);
