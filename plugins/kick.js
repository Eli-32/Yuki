import { areJidsSameUser } from '@whiskeysockets/baileys';

const handler = async (m, { conn, text, participants, usedPrefix, command }) => {
  console.log(`🔍 Kick command triggered: ${command}`);
  console.log(`🔍 Message text: ${text}`);
  console.log(`🔍 Mentioned JIDs: ${m.mentionedJid ? m.mentionedJid.join(', ') : 'none'}`);
  
  // Check if user is admin
  const isAdmin = participants.find(p => areJidsSameUser(p.id, m.sender) && p.admin);
  if (!isAdmin) {
    console.log(`❌ User ${m.sender} is not admin`);
    return m.reply("❌ *فقط المشرفين يمكنهم استخدام هذا الأمر* (واضح إنك مش مشرف يا حبيبي)");
  }

  // Check if bot is admin
  const botAdmin = participants.find(p => areJidsSameUser(p.id, conn.user.id) && p.admin);
  if (!botAdmin) {
    console.log(`❌ Bot ${conn.user.id} is not admin`);
    return m.reply("❌ *عطيني اشراف طيب* (مش هقدر أطرد حد من غير صلاحيات)");
  }

  let targets = [];

  // Handle quoted message
  if (m.quoted) {
    targets = [m.quoted.sender];
  } 
  // Handle mentioned users
  else if (m.mentionedJid && m.mentionedJid.length > 0) {
    targets = m.mentionedJid.filter(jid => !areJidsSameUser(jid, conn.user.id));
  } 
  // Handle text input (phone numbers)
  else if (text) {
    // Extract phone numbers from text
    const phoneNumbers = text.match(/\d+/g);
    if (phoneNumbers) {
      targets = phoneNumbers.map(num => num + '@s.whatsapp.net');
    }
  } 
  // No valid target specified
  else {
    return m.reply(`❌ *الرجاء تحديد العضو:*
• الرد على رسالة العضو
• منشن العضو
• كتابة رقم العضو

(لا تحاول تطرد الهوا بالله)`);
  }

  console.log(`🔍 Targets found: ${targets.length} - ${targets.join(', ')}`);
  
  if (targets.length === 0) {
    console.log(`❌ No valid targets found`);
    return m.reply("❌ *(شكله زبال الي بينطرد)لم يتم العثور على أعضاء صالحين للإخراج*");
  }

  const removedUsers = [];
  const failedUsers = [];

  // Process each target
  for (const target of targets) {
    try {
      // Validate JID format
      if (!target.endsWith('@s.whatsapp.net')) {
        failedUsers.push({ jid: target, reason: 'تنسيق غير صحيح (مدري الصدق ليه تطلع ذي الرسالة)' });
        continue;
      }

      // Check if target is admin (can't remove admins)
      const targetIsAdmin = participants.find(p => areJidsSameUser(p.id, target) && p.admin);
      if (targetIsAdmin) {
        failedUsers.push({ jid: target, reason: 'مشرف - لا يمكن إخراجه (قوي مرة)' });
        continue;
      }

      // Check if target is the bot itself
      if (areJidsSameUser(target, conn.user.id)) {
        failedUsers.push({ jid: target, reason: 'البوت نفسه - لا يمكن إخراجه (اطردك قبل لا اطرد نفسي يفاشل)' });
        continue;
      }

      // Check if target is the group creator
      const groupMetadata = await conn.groupMetadata(m.chat);
      if (areJidsSameUser(target, groupMetadata.owner)) {
        failedUsers.push({ jid: target, reason: 'مالك المجموعة - لا يمكن إخراجه (مش هطرد صاحب البيت)' });
        continue;
      }

      // Remove the user
      await conn.groupParticipantsUpdate(m.chat, [target], 'remove');
      removedUsers.push(target);

      // Log the removal with sass
      console.log(`🚫 User ${target} removed from group ${m.chat} by ${m.sender} (تم الطرد بنجاح يا حبيبي)`);

      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Error removing user ${target}:`, error);
      failedUsers.push({ jid: target, reason: error.message || 'خطأ غير معروف (شكله قوي مرة)' });
    }
  }

  // Prepare response message with sass
  let response = `📊 *نتيجة الإخراج:*\n\n`;

  if (removedUsers.length > 0) {
    response += `✅ *تم إخراج ${removedUsers.length} عضو بنجاح:*\n`;
    response += removedUsers.map(jid => `• @${jid.split('@')[0]}`).join('\n');
    response += `\n🎉 *(تم الطرد بنجاح يا حبيبي - روح اتعلم)*`;
  }

  if (failedUsers.length > 0) {
    response += `\n❌ *(عشانه قوي مرة مب عشان بوت خربان)فشل إخراج ${failedUsers.length} عضو:*\n`;
    response += failedUsers.map(user => `• @${user.jid.split('@')[0]} (${user.reason})`).join('\n');
  }

  // Add summary with sass
  response += `\n📈 *الإحصائيات:*
• إجمالي الأعضاء: ${targets.length}
• تم الإخراج: ${removedUsers.length} (شغال البوت يعني....اعتقد🎉)
• فشل الإخراج: ${failedUsers.length} (شكله قوي مرة )`;

  // Add timestamp with sass
  response += `\n\n⏰ *التاريخ:* ${new Date().toLocaleString('ar-EG')} (تاريخ مشرف 😎)`;

  // Send response with mentions
  await m.reply(response, null, {
    mentions: [...removedUsers, ...failedUsers.map(u => u.jid)]
  });
};

// Command configuration
handler.help = [
  'kick <@user/reply/phone> [reason]',
  'طرد <@user/reply/phone> [reason]',
  'دزمها <@user/reply/phone> [reason]',
  'انقلع <@user/reply/phone> [reason]',
  'بنعالي <@user/reply/phone> [reason]'
];

handler.tags = ['admin', 'group'];

handler.command = /^(kick|طرد|دزمها|انقلع|بنعالي)$/i;

// Requirements
handler.admin = true;      // User must be admin
handler.group = true;      // Only works in groups
handler.botAdmin = true;   // Bot must be admin

export default handler; 