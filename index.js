const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent
  ]
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

const userStatusMap = new Map();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Fetch guild and members
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    guild.members.cache.forEach(member => {
      if (WATCHED_USERS.includes(member.id)) {
        const status = member.presence?.status || 'offline';
        userStatusMap.set(member.id, status);

        if (status === 'online') {
          console.log(`User ${member.id} is already ONLINE`);
          const channel = guild.channels.cache.get(CHANNEL_ID);
          if (channel?.isTextBased()) {
            channel.send(`<@${OWNER_ID}> User <@${member.id}> is already online!`);
          }
        }
      }
    });
  } catch (err) {
    console.error('Error fetching members at startup:', err);
  }
});

client.on('presenceUpdate', async (oldPresence, newPresence) => {
  if (!newPresence) return;

  const userId = newPresence.userId;
  const guildId = newPresence.guild.id;

  if (guildId !== GUILD_ID) return;
  if (!WATCHED_USERS.includes(userId)) return;

  const newStatus = newPresence.status; // online, offline, idle, dnd
  const oldStatus = userStatusMap.get(userId) || 'offline';

  if (oldStatus !== newStatus) {
    userStatusMap.set(userId, newStatus);

    if (newStatus === 'online') {
      console.log(`User ${userId} is now ONLINE`);

      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel.isTextBased()) {
          channel.send(`<@${OWNER_ID}> User <@${userId}> is now online!`);
        }
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  }
});

client.login(process.env.BOT_TOKEN);
