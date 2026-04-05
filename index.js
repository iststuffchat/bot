require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
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
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(`📘 ${title}`)
    .setDescription(description)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('guildMemberAdd', async member => {
  const role = member.guild.roles.cache.find(r => r.name === AUTO_ROLE_NAME);
  if (role) await member.roles.add(role).catch(() => {});

  const now = Date.now();
  const joins = joinMap.get(member.guild.id) || [];
  const recent = joins.filter(t => now - t < 10000);
  recent.push(now);
  joinMap.set(member.guild.id, recent);

  if (recent.length >= 5) {
    await sendLog(member.guild, 'Anti Raid', '⚠️ Possible raid detected: 5 joins in 10s');
  }
});

client.on('guildMemberRemove', async member => {
  await sendLog(member.guild, 'Member Left', `${member.user.tag} left the server`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    await sendLog(
      newMember.guild,
      'Nickname Changed',
      `${newMember.user.tag}\nBefore: ${oldMember.nickname || 'None'}\nAfter: ${newMember.nickname || 'Removed'}`
    );
  }
});

client.on('messageDelete', async message => {
  if (!message.guild || !message.author) return;

  snipes.set(message.channel.id, {
    content: message.content || '[empty]',
    author: message.author.tag,
    time: new Date().toLocaleString()
  });

  const ping = mentionCache.get(message.id);
  if (ping) {
    await sendLog(message.guild, 'Ghost Ping', `${ping.author} deleted a ping to ${ping.mentioned}`);
  }

  await sendLog(message.guild, 'Message Deleted', `${message.author.tag}: ${message.content || '[embed/attachment]'}`);
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  await sendLog(message.guild, 'Message Sent', `${message.author.tag}: ${message.content || '[embed/attachment]'}`);

  xp.set(message.author.id, (xp.get(message.author.id) || 0) + 10);

  if (message.mentions.users.size > 0) {
    mentionCache.set(message.id, {
      author: message.author.tag,
      mentioned: [...message.mentions.users.values()].map(u => u.tag).join(', ')
    });
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();

  if (cmd === 'warn') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('Mention a user');

    const reason = args.join(' ') || 'No reason';
    const list = warns.get(member.id) || [];
    list.push(reason);
    warns.set(member.id, list);
    saveJson('warns', warns);

    await sendLog(message.guild, 'Warn Issued', `${member.user.tag} warned by ${message.author.tag}\nReason: ${reason}`);
    return message.reply(`⚠️ Warned ${member.user.tag} (${list.length})`);
  }

  if (cmd === 'warnings') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('Mention a user');
    const list = warns.get(member.id) || [];
    return message.reply(list.length ? list.join('\n') : 'No warns');
  }

  if (cmd === 'ticket') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Open Ticket')
        .setStyle(ButtonStyle.Primary)
    );
    return message.channel.send({ content: '🎫 Support Tickets', components: [row] });
  }

  if (cmd === 'snipe') {
    const s = snipes.get(message.channel.id);
    if (!s) return message.reply('Nothing to snipe');
    return message.channel.send(`👻 ${s.author}: ${s.content}\n🕒 ${s.time}`);
  }

  if (cmd === 'rank') {
    return message.reply(`⭐ XP: ${xp.get(message.author.id) || 0}`);
  }

  if (cmd === 'panel') {
    if (message.author.id !== OWNER_ID) return;
    return message.channel.send('🛠️ Owner admin panel');
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'create_ticket') return;

  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]
      }
    ]
  });

  await interaction.reply({
    content: `🎫 Ticket created: ${channel}`,
    ephemeral: true
  });
});

client.login(process.env.BOT_TOKEN);
