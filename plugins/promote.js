/**
 * WhatsApp Bot - Promote User Handler
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
    const isAdmin = admins.some(a => a.id === m.sender);
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

    // Check if user is already admin
    const isAlreadyAdmin = admins.some(a => a.id === targetUser);
    if (isAlreadyAdmin) {
      return conn.reply(m.chat, '❗ المستخدم مدير بالفعل.', m);
    }

    // Check if trying to promote bot itself
    if (targetUser === conn.user.jid) {
      return conn.reply(m.chat, '❗ لا يمكنني ترقية نفسي.', m);
    }

    // Promote user
    await conn.groupParticipantsUpdate(m.chat, [targetUser], 'promote');
    
    // Success message with user mention
    const successMsg = `✅ تم ترقية @${displayNumber} إلى مدير بنجاح!`;
    conn.reply(m.chat, successMsg, m, { mentions: [targetUser] });

    // Log the action (optional)
    console.log(`User ${m.sender.split('@')[0]} promoted ${displayNumber} in group ${m.chat}`);

  } catch (error) {
    console.error('Promote command error:', error);
    
    // Handle specific errors
    let errorMsg = '❌ حدث خطأ أثناء ترقية المستخدم.';
    
    if (error.message?.includes('not-authorized')) {
      errorMsg = '❗ البوت لا يملك صلاحية ترقية المستخدمين.';
    } else if (error.message?.includes('participant-not-found')) {
      errorMsg = '❗ المستخدم غير موجود في المجموعة.';
    } else if (error.message?.includes('bad-request')) {
      errorMsg = '❗ طلب غير صحيح. تأكد من صحة الرقم.';
    }
    
    conn.reply(m.chat, errorMsg, m);
  }
};

// Handler configuration
handler.help = ['promote', 'ترقية'];
handler.tags = ['group', 'admin'];
handler.command = /^(promote|ترقيه|ترقية|رقي|admin)$/i;
handler.group = true;
handler.admin = true;
handler.botAdmin = true;
handler.fail = null;

export default handler;