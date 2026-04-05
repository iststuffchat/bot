const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ChannelType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONFIG =====
const PREFIX = '!';
const GUILD_ID = '1449379857975742539';
const WATCHED_USERS = [
  '915972726634729503',
  '1281823289689509942',
  '1485846513623240744'
];
const OWNER_ID = '1242864721967845387';
const CHANNEL_ID = '1472408286853599415';
const LOG_CHANNEL_ID = '1472408286853599415';

const userStatusMap = new Map();
const spamMap = new Map();

function logAction(channel, title, description) {
  const embed = new EmbedBuilder()
    .setTitle(`🛡️ ${title}`)
    .setDescription(description)
    .setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    guild.members.cache.forEach(member => {
      if (WATCHED_USERS.includes(member.id)) {
        const status = member.presence?.status || 'offline';
        userStatusMap.set(member.id, status);
      }
    });

    console.log('Advanced moderation bot is online.');
  } catch (err) {
    console.error('Startup error:', err);
  }
});

// ===== WATCH ONLINE USERS =====
client.on('presenceUpdate', async (_, newPresence) => {
  if (!newPresence) return;

  const userId = newPresence.userId;
  if (!WATCHED_USERS.includes(userId)) return;

  const newStatus = newPresence.status;
  const oldStatus = userStatusMap.get(userId) || 'offline';

  if (oldStatus !== newStatus) {
    userStatusMap.set(userId, newStatus);

    if (newStatus === 'online') {
      const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
      if (channel?.isTextBased()) {
        channel.send(`🔔 <@${OWNER_ID}> User <@${userId}> is now online!`);
      }
    }
  }
});

// ===== AUTO MODERATION =====
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  // Anti-link
  if (/https?:\/\//i.test(message.content) && !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await message.delete().catch(() => {});
    return message.channel.send(`⚠️ ${message.author}, links are not allowed here.`);
  }

  // Anti-spam
  const now = Date.now();
  const userData = spamMap.get(message.author.id) || [];
  const filtered = userData.filter(t => now - t < 5000);
  filtered.push(now);
  spamMap.set(message.author.id, filtered);

  if (filtered.length >= 6) {
    await message.member.timeout(60 * 1000, 'Spam detected').catch(() => {});
    return message.channel.send(`⏱️ ${message.author} was timed out for spamming.`);
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  // ===== MOD COMMANDS =====
  if (command === 'purge') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) return message.reply('Use 1-100');
    await message.channel.bulkDelete(amount, true);
    return message.channel.send(`🧹 Deleted ${amount} messages.`);
  }

  if (command === 'kick') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
    const member = message.mentions.members.first();
    if (!member) return message.reply('Mention a user');
    await member.kick('Kicked by moderator');
    return message.channel.send(`👢 Kicked ${member.user.tag}`);
  }

  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
    const member = message.mentions.members.first();
    if (!member) return message.reply('Mention a user');
    await member.ban({ reason: 'Banned by moderator' });
    return message.channel.send(`🔨 Banned ${member.user.tag}`);
  }

  if (command === 'timeout') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
    const member = message.mentions.members.first();
    const mins = parseInt(args[1]);
    if (!member || !mins) return message.reply('Usage: !timeout @user 10');
    await member.timeout(mins * 60 * 1000, 'Timed out by moderator');
    return message.channel.send(`⏱️ Timed out ${member.user.tag} for ${mins}m`);
  }

  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });
    return message.channel.send('🔒 Channel locked');
  }

  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: true
    });
    return message.channel.send('🔓 Channel unlocked');
  }

  // ===== COOL UTILITY COMMANDS =====
  if (command === 'ping') {
    return message.reply(`🏓 ${client.ws.ping}ms`);
  }

  if (command === 'userinfo') {
    const member = message.mentions.members.first() || message.member;
    const embed = new EmbedBuilder()
      .setTitle('👤 User Info')
      .setDescription(`User: ${member.user.tag}\nID: ${member.id}\nJoined: ${member.joinedAt}`)
      .setThumbnail(member.user.displayAvatarURL());
    return message.channel.send({ embeds: [embed] });
  }

  if (command === 'serverinfo') {
    const guild = message.guild;
    const embed = new EmbedBuilder()
      .setTitle('🌐 Server Info')
      .setDescription(`Name: ${guild.name}\nMembers: ${guild.memberCount}`)
      .setThumbnail(guild.iconURL());
    return message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.BOT_TOKEN);
