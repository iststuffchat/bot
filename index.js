require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

const PREFIX = '!';
const OWNER_ID = '1242864721967845387';
const LOG_CHANNEL_ID = '1449379859678756968';
const AUTO_ROLE_NAME = 'Member';

const warns = new Map();
const xp = new Map();
const snipes = new Map();
const mentionCache = new Map();
const joinMap = new Map();

function saveJson(name, map) {
  fs.writeFileSync(`${name}.json`, JSON.stringify(Object.fromEntries(map), null, 2));
}

async function sendLog(guild, title, description) {
  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setTitle(`📘 ${title}`)
    .setDescription(description)
    .setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// welcome + autorole + anti raid
client.on('guildMemberAdd', async member => {
  const role = member.guild.roles.cache.find(r => r.name === AUTO_ROLE_NAME);
  if (role) member.roles.add(role).catch(() => {});

  const system = member.guild.systemChannel;
  if (system) system.send(`🎉 Welcome ${member} to **${member.guild.name}**!`);

  const now = Date.now();
  const joins = joinMap.get(member.guild.id) || [];
  const recent = joins.filter(t => now - t < 10000);
  recent.push(now);
  joinMap.set(member.guild.id, recent);

  if (recent.length >= 5) {
    await sendLog(member.guild, 'Anti Raid', '⚠️ Possible raid detected: 5 joins in 10s');
  }
});

);
  await sendLog(member.guild, 'Member Left', `${member.user.tag} left the server`);
});

// full audit-style action logs
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  await sendLog(message.guild, 'Message Sent', `#${message.channel.name}\n${message.author.tag}: ${message.content || '[embed/attachment]'}`);
});

client.on('messageDelete', async message => {
  if (!message.guild || !message.author) return;
  snipes.set(message.channel.id, {
    content: message.content,
    author: message.author.tag,
    time: new Date().toLocaleString()
  });
  await sendLog(message.guild, 'Message Deleted', `#${message.channel.name}\n${message.author.tag}: ${message.content || '[embed/attachment]'}`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    const before = oldMember.nickname || 'None';
    const after = newMember.nickname || 'Removed';
    await sendLog(newMember.guild, 'Nickname Changed', `${newMember.user.tag}\nBefore: ${before}\nAfter: ${after}`);
  }

  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

  if (addedRoles.size > 0) {
    await sendLog(newMember.guild, 'Role Added', `${newMember.user.tag}\nAdded: ${addedRoles.map(r => r.name).join(', ')}`);
  }

  if (removedRoles.size > 0) {
    await sendLog(newMember.guild, 'Role Removed', `${newMember.user.tag}\nRemoved: ${removedRoles.map(r => r.name).join(', ')}`);
  }
});

client.on('messageDelete', message => {
  if (!message.author) return;
  snipes.set(message.channel.id, {
    content: message.content,
    author: message.author.tag,
    time: new Date().toLocaleString()
  });
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  // XP system
  const current = xp.get(message.author.id) || 0;
  xp.set(message.author.id, current + 10);

  // ghost ping tracking
  if (message.mentions.users.size > 0) {
    mentionCache.set(message.id, {
      author: message.author.tag,
      mentioned: [...message.mentions.users.values()].map(u => u.tag).join(', ')
    });
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();

  if (cmd === 'warn') {
    const member = message.mentions.members.first();
    if (!member) return;
    const reason = args.slice(1).join(' ') || 'No reason';
    const userWarns = warns.get(member.id) || [];
    userWarns.push(reason);
    warns.set(member.id, userWarns);
    saveJson('warns', warns);
    await sendLog(message.guild, 'Warn Issued', `${member.user.tag} warned by ${message.author.tag}\nReason: ${reason}`);
    return message.reply(`⚠️ Warned ${member.user.tag} (${userWarns.length} warns)`);
  }

  if (cmd === 'warnings') {
    const member = message.mentions.members.first();
    if (!member) return;
    const userWarns = warns.get(member.id) || [];
    return message.reply(userWarns.length ? userWarns.join('\n') : 'No warns');
  }

  if (cmd === 'ticket') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('Open Ticket').setStyle(ButtonStyle.Primary)
    );
    return message.channel.send({ content: '🎫 Support Tickets', components: [row] });
  }

  if (cmd === 'rr') {
    return message.channel.send('🎭 Reaction role system ready. React handling can be attached to specific message IDs.');
  }

  if (cmd === 'giveaway') {
    return message.channel.send('🎉 Giveaway started! (next upgrade can add timed winners)');
  }

  if (cmd === 'music') {
    return message.channel.send('🎵 Music system placeholder added. Next step can use @discordjs/voice + play-dl.');
  }

  if (cmd === 'snipe') {
    const s = snipes.get(message.channel.id);
    if (!s) return message.reply('Nothing to snipe');
    return message.channel.send(`👻 ${s.author}: ${s.content}\n🕒 ${s.time}`);
  }

  if (cmd === 'rank') {
    const score = xp.get(message.author.id) || 0;
    return message.reply(`⭐ XP: ${score}`);
  }

  if (cmd === 'panel') {
    if (message.author.id !== OWNER_ID) return;
    return message.channel.send('🛠️ Owner admin panel: bot stats, emergency lockdown, logs, raid mode.');
  }
});

client.on('messageDelete', async message => {
  const ping = mentionCache.get(message.id);
  if (ping && message.guild) {
    await sendLog(message.guild, 'Ghost Ping', `${ping.author} deleted a ping to ${ping.mentioned}`);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'create_ticket') {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });
    interaction.reply({ content: `🎫 Ticket created: ${channel}`, ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN);
