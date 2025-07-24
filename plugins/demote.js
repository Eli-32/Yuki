/**
 * WhatsApp Bot - Demote User Handler
 * Updated for better functionality and error handling
 */

let handler = async (m, { conn, participants, groupMetadata, args, usedPrefix, command, text }) => {
  try {
    // Get chat data and group metadata
    const chat = global.db.data.chats[m.chat] || {};
    const groupMeta = await conn.groupMetadata(m.chat).catch(() => null);
    
    if (!groupMeta) {
      return conn.reply(m.chat, '❗ لا يمكن الحصول على معلومات المجموعة.', m);
    }

    // Get admins and check permissions
    const admins = groupMeta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const superAdmins = groupMeta.participants.filter(p => p.admin === 'superadmin');
    const isAdmin = admins.some(a => a.id === m.sender);
    const isSuperAdmin = superAdmins.some(a => a.id === m.sender);
    const isBotAdmin = admins.some(a => a.id === conn.user.jid);

    // Permission checks
    if (!isAdmin) {
      return conn.reply(m.chat, '❗ يجب أن تكون مديرًا لاستخدام هذا الأمر.', m);
    }
    
    if (!isBotAdmin) {
      return conn.reply(m.chat, '❗ يجب أن يكون البوت مديرًا لتنفيذ هذا الأمر.', m);
    }

    let targetUser;
    let displayNumber;

    // Parse target user from different input methods
    if (text) {
      // Handle mentions (@user)
      if (text.includes('@')) {
        const mentions = text.match(/@(\d+)/g);
        if (mentions && mentions.length > 0) {
          const number = mentions[0].replace('@', '');
          targetUser = number + '@s.whatsapp.net';
          displayNumber = number;
        } else {
          // Handle raw mention format
          const cleanNumber = text.replace(/[^0-9]/g, '');
          if (cleanNumber.length >= 5 && cleanNumber.length <= 15) {
            targetUser = cleanNumber + '@s.whatsapp.net';
            displayNumber = cleanNumber;
          }
        }
      } 
      // Handle plain number
      else if (/^\d+$/.test(text.trim())) {
        const number = text.trim();
        if (number.length >= 5 && number.length <= 15) {
          targetUser = number + '@s.whatsapp.net';
          displayNumber = number;
        }
      }
    } 
    // Handle quoted message
    else if (m.quoted && m.quoted.sender) {
      targetUser = m.quoted.sender;
      displayNumber = m.quoted.sender.split('@')[0];
    }

    // Validation checks
    if (!targetUser) {
      return conn.reply(m.chat, 
        `❗ استخدم الأمر بإحدى الطرق التالية:\n` +
        `• *${usedPrefix + command}* @منشن\n` +
        `• *${usedPrefix + command}* رقم_الهاتف\n` +
        `• رد على رسالة المستخدم مع *${usedPrefix + command}*`, m);
    }

    // Check if user is in group
    const isInGroup = groupMeta.participants.some(p => p.id === targetUser);
    if (!isInGroup) {
      return conn.reply(m.chat, '❗ المستخدم غير موجود في المجموعة.', m);
    }

    // Check if target user is admin
    const targetIsAdmin = admins.some(a => a.id === targetUser);
    if (!targetIsAdmin) {
      return conn.reply(m.chat, '❗ المستخدم ليس مديرًا في الأساس.', m);
    }

    // Check if trying to demote bot itself
    if (targetUser === conn.user.jid) {
      return conn.reply(m.chat, '❗ لا يمكنني تخفيض رتبة نفسي.', m);
    }

    // Check if target is a super admin and current user is not
    const targetIsSuperAdmin = superAdmins.some(a => a.id === targetUser);
    if (targetIsSuperAdmin && !isSuperAdmin) {
      return conn.reply(m.chat, '❗ لا يمكن تخفيض رتبة المدير الأساسي إلا من قبل مدير أساسي آخر.', m);
    }

    // Check if trying to demote the group creator (if bot has that info)
    const groupCreator = groupMeta.owner;
    if (groupCreator && targetUser === groupCreator) {
      return conn.reply(m.chat, '❗ لا يمكن تخفيض رتبة منشئ المجموعة.', m);
    }

    // Prevent self-demotion (additional safety)
    if (targetUser === m.sender) {
      return conn.reply(m.chat, '❗ لا يمكنك تخفيض رتبة نفسك. اطلب من مدير آخر القيام بذلك.', m);
    }

    // Demote user
    await conn.groupParticipantsUpdate(m.chat, [targetUser], 'demote');
    
    // Success message with user mention
    const successMsg = `✅ تم إزالة @${displayNumber} من الإدارة بنجاح!`;
    conn.reply(m.chat, successMsg, m, { mentions: [targetUser] });

    // Log the action (optional)
    console.log(`User ${m.sender.split('@')[0]} demoted ${displayNumber} in group ${m.chat}`);

  } catch (error) {
    console.error('Demote command error:', error);
    
    // Handle specific errors
    let errorMsg = '❌ حدث خطأ أثناء تخفيض رتبة المستخدم.';
    
    if (error.message?.includes('not-authorized')) {
      errorMsg = '❗ البوت لا يملك صلاحية تخفيض رتبة المستخدمين.';
    } else if (error.message?.includes('participant-not-found')) {
      errorMsg = '❗ المستخدم غير موجود في المجموعة.';
    } else if (error.message?.includes('bad-request')) {
      errorMsg = '❗ طلب غير صحيح. تأكد من صحة الرقم.';
    } else if (error.message?.includes('forbidden')) {
      errorMsg = '❗ لا يمكن تخفيض رتبة هذا المستخدم (قد يكون المدير الأساسي).';
    }
    
    conn.reply(m.chat, errorMsg, m);
  }
};

// Handler configuration
handler.help = ['demote', 'تخفيض'];
handler.tags = ['group', 'admin'];
handler.command = /^(demote|تخفيض|degradar|تنزيل|إزالة_الإدارة)$/i;
handler.group = true;
handler.admin = true;
handler.botAdmin = true;
handler.fail = null;

export default handler;