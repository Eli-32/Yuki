import { areJidsSameUser } from '@whiskeysockets/baileys';

const handler = async (m, { conn, text, participants, usedPrefix, command }) => {
  // Check if user is admin
  const isAdmin = participants.find(p => areJidsSameUser(p.id, m.sender) && p.admin);
  if (!isAdmin) {
    return m.reply("❌ *فقط المشرفين يمكنهم استخدام هذا الأمر* (واضح إنك مش مشرف يا حبيبي)");
  }

  // Check if bot is admin
  const botAdmin = participants.find(p => areJidsSameUser(p.id, conn.user.id) && p.admin);
  if (!botAdmin) {
    return m.reply("❌ *عطيني اشراف طيب* (مش هقدر أطرد حد من غير صلاحيات)");
  }

  // Parse command and reason
  const args = text ? text.split(' ') : [];
  const reason = args.slice(1).join(' ') || 'لا يوجد سبب محدد (بس عشان عايزين نطردك)';

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
  else if (args[0]) {
    // Extract phone numbers from text
    const phoneNumbers = args[0].match(/\d+/g);
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

*مثال:* \`${usedPrefix}${command} @user السبب\`
*مثال:* \`${usedPrefix}${command} 1234567890 السبب\`

(لا تحاول تطرد الهوا بالله)`);
  }

  if (targets.length === 0) {
    return m.reply("❌ *(شكله زبال الي بينطرد)لم يتم العثور على أعضاء صالحين للإخراج*");
  }

  // Limit bulk operations to prevent abuse
  if (targets.length > 15) {
    return m.reply("❌ *لا يمكن إخراج أكثر من 15 عضو في المرة الواحدة* (مابي اتبند)\n\n*لإخراج عدد أكبر، استخدم الأمر عدة مرات*");
  }

  const removedUsers = [];
  const failedUsers = [];
  const skippedUsers = [];

  // Show processing message with sass
  const processingMsg = await m.reply(`🔄 *جاري معالجة ${targets.length} عضو...*\n\n⏳ *يرجى الانتظار...* (مش هطول كتير يا حبيبي)`);

  // Process each target
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    
    try {
      // Update processing message with sass
      await conn.sendMessage(m.chat, {
        edit: processingMsg.key,
        text: `🔄 *جاري معالجة ${i + 1}/${targets.length}...*\n\n⏳ *العضو:* @${target.split('@')[0]} (شوية شوية يا حبيبي)`
      }, { quoted: processingMsg });

      // Validate JID format
      if (!target.endsWith('@s.whatsapp.net')) {
        failedUsers.push({ jid: target, reason: 'تنسيق غير صحيح (مدري الصدق ليه تطلع ذي الرسالة)' });
        continue;
      }

      // Check if target is admin (can't remove admins)
      const targetIsAdmin = participants.find(p => areJidsSameUser(p.id, target) && p.admin);
      if (targetIsAdmin) {
        skippedUsers.push({ jid: target, reason: 'مشرف - لا يمكن إخراجه (قوي مرة)' });
        continue;
      }

      // Check if target is the bot itself
      if (areJidsSameUser(target, conn.user.id)) {
        skippedUsers.push({ jid: target, reason: 'البوت نفسه - لا يمكن إخراجه (اطردك قبل لا اطرد نفسي يفاشل)' });
        continue;
      }

      // Check if target is the group creator
      const groupMetadata = await conn.groupMetadata(m.chat);
      if (areJidsSameUser(target, groupMetadata.owner)) {
        skippedUsers.push({ jid: target, reason: 'مالك المجموعة - لا يمكن إخراجه (مش هطرد صاحب البيت)' });
        continue;
      }

      // Remove the user
      await conn.groupParticipantsUpdate(m.chat, [target], 'remove');
      removedUsers.push(target);

      // Log the removal with sass
      console.log(`🚫 User ${target} removed from group ${m.chat} by ${m.sender}. Reason: ${reason} (تم الطرد بنجاح يا حبيبي)`);

      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.error(`Error removing user ${target}:`, error);
      failedUsers.push({ jid: target, reason: error.message || 'خطأ غير معروف (شكله قوي مرة)' });
    }
  }

  // Delete processing message
  try {
    await conn.sendMessage(m.chat, { delete: processingMsg.key });
  } catch (error) {
    // Silent fail
  }

  // Prepare response message with sass
  let response = `📊 *نتيجة الإخراج:*\n\n`;

  if (removedUsers.length > 0) {
    response += `✅ *تم إخراج ${removedUsers.length} عضو بنجاح:*\n`;
    response += removedUsers.map(jid => `• @${jid.split('@')[0]}`).join('\n');
    response += `\n📝 *السبب:* ${reason}\n`;
    
    // Add sassy success message
    if (removedUsers.length === 1) {
      response += `\n🎉 *(تم الطرد بنجاح يا حبيبي - روح اتعلم)*`;
    } else {
      response += `\n🎉 *(تم الطرد الجماعي بنجاح - روحوا اتعلموا)*`;
    }
  }

  if (skippedUsers.length > 0) {
    response += `\n⚠️ *تم تخطي ${skippedUsers.length} عضو:*\n`;
    response += skippedUsers.map(user => `• @${user.jid.split('@')[0]} (${user.reason})`).join('\n');
  }

  if (failedUsers.length > 0) {
    response += `\n❌ *(عشانه قوي مرة مب عشان بوت خربان)فشل إخراج ${failedUsers.length} عضو:*\n`;
    response += failedUsers.map(user => `• @${user.jid.split('@')[0]} (${user.reason})`).join('\n');
  }

  // Add summary with sass
  response += `\n📈 *الإحصائيات:*
• إجمالي الأعضاء: ${targets.length}
• تم الإخراج: ${removedUsers.length} (شغال البوت يعني....اعتقد🎉)
• تم التخطي: ${skippedUsers.length} (حتر البوت ما يبي يتعامل معهم)
• فشل الإخراج: ${failedUsers.length} (شكله قوي مرة )`;

  // Add timestamp with sass
  response += `\n\n⏰ *التاريخ:* ${new Date().toLocaleString('ar-EG')} (تاريخ مشرف 😎)`;

  // Send response with mentions
  await m.reply(response, null, {
    mentions: [...removedUsers, ...skippedUsers.map(u => u.jid), ...failedUsers.map(u => u.jid)]
  });

  // Send notification to removed users with sass
  if (removedUsers.length > 0) {
    try {
      const notificationMsg = `🚫 *تم إخراجك من المجموعة*\n\n📝 *السبب:* ${reason}\n⏰ *التاريخ:* ${new Date().toLocaleString('ar-EG')}\n\n💡 *(روح اتعلم وارجع تاني يا حبيبي)*`;
      
      for (const user of removedUsers) {
        try {
          await conn.sendMessage(user, { text: notificationMsg });
        } catch (error) {
          // Silent fail for user notifications
        }
      }
    } catch (error) {
      // Silent fail for notifications
    }
  }
};

// Command configuration
handler.help = [
  'kick <@user/reply/phone> [reason]',
  'kick <@user/reply/phone> السبب',
  'طرد <@user/reply/phone> [reason]',
  'طرد <@user/reply/phone> السبب',
  'bulkkick <@user1 @user2 @user3> [reason]',
  'طردجماعي <@user1 @user2 @user3> السبب'
];

handler.tags = ['admin', 'group'];

handler.command = /^(kick|طرد|دزمها|انقلع|بنعالي|bulkkick|طردجماعي|إخراججماعي)$/i;

// Requirements
handler.admin = true;      // User must be admin
handler.group = true;      // Only works in groups
handler.botAdmin = true;   // Bot must be admin

export default handler; 