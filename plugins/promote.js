// import { getWhatsAppNumber } from '../lib/simple.js';

let handler = async (m, { conn, participants, groupMetadata, args, usedPrefix, command, text }) => {
  const chat = global.db.data.chats[m.chat] || {};
  const groupMeta = await conn.groupMetadata(m.chat);
  const admins = groupMeta.participants.filter(p => p.admin);
  const isAdmin = admins.some(a => a.id === m.sender);
  const isBotAdmin = admins.some(a => a.id === conn.user.jid);

  if (!isAdmin) return conn.reply(m.chat, '❗ يجب أن تكون مديرًا لاستخدام هذا الأمر.', m);
  if (!isBotAdmin) return conn.reply(m.chat, '❗ يجب أن يكون البوت مديرًا لتنفيذ هذا الأمر.', m);

  let number;
  if (text) {
    if (isNaN(text)) {
      if (text.match(/@/g)) {
        number = text.replace(/[^0-9]/g, '');
      } else {
        return conn.reply(m.chat, '❗ يرجى تحديد رقم صحيح أو منشن مستخدم.', m);
      }
    } else {
      number = text;
    }
  } else if (m.quoted) {
    number = m.quoted.sender.split('@')[0];
  } else {
    return conn.reply(m.chat, `❗ استخدم الأمر هكذا: *${usedPrefix + command}* @tag أو رد على رسالة المستخدم`, m);
  }

  if (!number || number.length > 15 || number.length < 5) {
    return conn.reply(m.chat, '❗ رقم غير صحيح.', m);
  }

  try {
    const user = number + '@s.whatsapp.net';
    await conn.groupParticipantsUpdate(m.chat, [user], 'promote');
    m.reply(`تم ترقية ${number} إلى مدير.`);
  } catch (e) {
    conn.reply(m.chat, `❌ فشل في ترقية المستخدم: ${e.message}`, m);
  }
}
  
  handler.help = ['promote'];
  handler.tags = ['group'];
  handler.command = ['ترقيه', 'ترقية'];
  handler.group = true;
  handler.admin = true;
  handler.botAdmin = true;
  handler.fail = null;
  
  export default handler;
  