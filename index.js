const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  PermissionsBitField, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// CONFIG
const GUILD_ID = '1449379857975742539';
const WATCHED_USERS = [
  '915972726634729503',
  '1281823289689509942',
  '1485846513623240744'
];
const OWNER_ID = '1242864721967845387';
const CHANNEL_ID = '1472408286853599415';
const VOICE_CHANNEL_ID = 'YOUR_VOICE_CHANNEL_ID'; // replace with VC id

const userStatusMap = new Map();

// ------------------ PRESENCE TRACKER ------------------
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    // Startup status check
    guild.members.cache.forEach(member => {
      if (WATCHED_USERS.includes(member.id)) {
        const status = member.presence?.status || 'offline';
        userStatusMap.set(member.id, status);

        if (status === 'online') {
          const channel = guild.channels.cache.get(CHANNEL_ID);
          if (channel?.isTextBased()) {
            channel.send(`<@${OWNER_ID}> User <@${member.id}> is already online!`);
          }
        }
      }
    });

    // Join VC
    const voiceChannel = guild.channels.cache.get(VOICE_CHANNEL_ID);
    if (voiceChannel?.isVoiceBased()) {
      const connection = joinVoiceChannel({
        channelId: VOICE_CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      console.log(`Joined voice channel: ${voiceChannel.name}`);
    } else {
      console.warn('Voice channel not found or invalid!');
    }

  } catch (err) {
    console.error('Startup error:', err);
  }
});

client.on('presenceUpdate', async (oldPresence, newPresence) => {
  if (!newPresence) return;
  const userId = newPresence.userId;
  const guildId = newPresence.guild.id;

  if (guildId !== GUILD_ID) return;
  if (!WATCHED_USERS.includes(userId)) return;

  const newStatus = newPresence.status;
  const oldStatus = userStatusMap.get(userId) || 'offline';

  if (oldStatus !== newStatus) {
    userStatusMap.set(userId, newStatus);
    if (newStatus === 'online') {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel.isTextBased()) {
        channel.send(`<@${OWNER_ID}> User <@${userId}> is now online!`);
      }
    }
  }
});

// ------------------ MODERATION COMMANDS ------------------
const commands = [
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option => option.setName('target').setDescription('The user to kick').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option => option.setName('target').setDescription('The user to ban').setRequired(true)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user')
    .addUserOption(option => option.setName('target').setDescription('The user to mute').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .addUserOption(option => option.setName('target').setDescription('The user to unmute').setRequired(true)),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Put a user in timeout')
    .addUserOption(option => option.setName('target').setDescription('The user to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setRequired(true))
]
.map(cmd => cmd.toJSON());

// Register commands
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands },
    );
    console.log('Moderation commands registered!');
  } catch (err) {
    console.error(err);
  }
})();

// Command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const target = interaction.options.getUser('target');
  if (!interaction.guild || !target) return;

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: 'Member not found!', ephemeral: true });

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
  }

  try {
    switch (commandName) {
      case 'kick':
        await member.kick();
        interaction.reply(`${target.tag} has been kicked.`);
        break;

      case 'ban':
        await member.ban({ reason: `Banned by ${interaction.user.tag}` });
        interaction.reply(`${target.tag} has been banned.`);
        break;

      case 'mute': {
        const minutes = interaction.options.getInteger('minutes') || 10;
        await member.timeout(minutes * 60 * 1000, `Muted by ${interaction.user.tag}`);
        interaction.reply(`${target.tag} has been muted for ${minutes} minutes.`);
        break;
      }

      case 'unmute':
        await member.timeout(null);
        interaction.reply(`${target.tag} has been unmuted.`);
        break;

      case 'timeout': {
        const minutes = interaction.options.getInteger('minutes');
        await member.timeout(minutes * 60 * 1000, `Timed out by ${interaction.user.tag}`);
        interaction.reply(`${target.tag} has been timed out for ${minutes} minutes.`);
        break;
      }

      default:
        interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    interaction.reply({ content: 'Failed to execute command.', ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN);
