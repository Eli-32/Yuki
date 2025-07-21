import mongoose from 'mongoose';
import WarningModel from '../lib/Warning.js';
// import { getWhatsAppNumber } from '../lib/simple.js';

// Removed: connectDB and mongoose.connect logic. Assume connection is handled globally.

mongoose.connection.on('disconnected', () => {
  // console.log('⚠️ MongoDB disconnected!');
});

mongoose.connection.on('reconnected', () => {
  // console.log('🔁 MongoDB reconnected');
});

// Core functionality
const validateAdmin = async (ctx) => {
  try {
    const metadata = await ctx.conn.groupMetadata(ctx.chat);
    const isAdmin = metadata.participants.some(participant => {
      const isMatch = participant.id === ctx.sender;
      const hasAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
      return isMatch && hasAdmin;
    });
    return isAdmin;
  } catch (error) {
    return false;
  }
};

const validateBotAdmin = async (ctx) => {
  try {
    const metadata = await ctx.conn.groupMetadata(ctx.chat);
    const botJid = ctx.conn.user.jid;
    return metadata.participants.some(
      participant => participant.id === botJid && (participant.admin === 'admin' || participant.admin === 'superadmin')
    );
  } catch (error) {
    return false;
  }
};

const resolveTargetUser = (ctx) => {
  try {
    // Check for quoted message first
    if (ctx.quoted && ctx.quoted.sender) {
      return {
        id: ctx.quoted.sender.replace(/@s\.whatsapp\.net|@lid/g, ''),
        jid: ctx.quoted.sender,
        mention: `@${ctx.quoted.sender.replace(/@s\.whatsapp\.net|@lid/g, '')}`
      };
    }

    // Check for mentioned users
    if (ctx.mentionedJid?.length > 0) {
      return {
        id: ctx.mentionedJid[0].replace(/@s\.whatsapp\.net|@lid/g, ''),
        jid: ctx.mentionedJid[0],
        mention: `@${ctx.mentionedJid[0].replace(/@s\.whatsapp\.net|@lid/g, '')}`
      };
    }

    return null;
  } catch (error) {
    return null;
  }
};

async function handleAddWarning(ctx, reason) {
  try {
    // Admin validation
    const isAdmin = await validateAdmin(ctx);
    if (!isAdmin) {
      return ctx.reply('⚠️ تحتاج صلاحيات المشرفين لهذا الأمر');
    }

    // User resolution
    const targetUser = resolveTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ يرجى تحديد مستخدم عن طريق الرد أو المنشن');
    }

    // Check if user is trying to warn themselves
    if (targetUser.jid === ctx.sender) {
      return ctx.reply('⚠️ لا يمكنك إنذار نفسك');
    }

    // Database operation
    const userWarnings = await WarningModel.findOneAndUpdate(
      { userId: targetUser.id, groupId: ctx.chat },
      {
        $push: {
          warnings: {
            cause: reason || '❌ لم يتم تقديم سبب',
            date: new Date(),
            issuer: ctx.sender
          }
        }
      },
      { new: true, upsert: true }
    );

    // Send notification
    const warningCount = userWarnings.warnings.length;
    const lastWarning = userWarnings.warnings[warningCount - 1];
    
    await ctx.conn.sendMessage(ctx.chat, {
      text: `🔔 *إنذار لـ ${targetUser.mention}*\n\n📊 العدد: ${warningCount}/5\n📝 السبب: ${lastWarning.cause}\n🕒 التاريخ: ${new Date(lastWarning.date).toLocaleString('ar-EG')}\n🚨 تحذير: عند الوصول لـ 5 إنذارات سيتم الطرد`,
      mentions: [targetUser.jid]
    });

    // Auto-moderation check
    if (warningCount >= 5) {
      try {
        const isBotAdmin = await validateBotAdmin(ctx);
        if (isBotAdmin) {
          // Correct Baileys removal method
          await ctx.conn.groupParticipantsUpdate(
            ctx.chat,
            [targetUser.jid],
            'remove'
          );
          
          await ctx.conn.sendMessage(ctx.chat, {
            text: `تم طرد ${targetUser.mention} لتجاوز الحد الأقصى للإنذارات (5/5)`,
            mentions: [targetUser.jid]
          });
          
          // Clear warnings after kick
          await WarningModel.deleteOne({ 
            userId: targetUser.id, 
            groupId: ctx.chat 
          });
        } else {
          await ctx.conn.sendMessage(ctx.chat, {
            text: '⚠️ البوت يحتاج صلاحيات إدارية للطرد التلقائي'
          });
        }
      } catch (removeError) {
        // console.error('Removal failed:', removeError);
        await ctx.reply('❌ فشل طرد العضو - تأكد من صلاحيات البوت');
      }
    }
  } catch (error) {
    // console.error('[FULL ERROR]', error);
    await ctx.reply('❌ فشل إضافة الإنذار - الرجاء التحقق من السجلات');
  }
}

async function handleViewWarnings(ctx, targetUserId) {
  try {
    
    const warnings = await WarningModel.findOne({
      userId: targetUserId,
      groupId: ctx.chat
    });

    if (!warnings?.warnings?.length) {
      return ctx.conn.sendMessage(ctx.chat, {
        text: '✔️ لا يوجد إنذارات مسجلة لهذا المستخدم',
        mentions: [ctx.sender]
      });
    }

    let message = '╭─🚨 سجل الإنذارات ─╮\n';
    message += `📊 العدد الكلي: ${warnings.warnings.length}/5\n\n`;
    
    warnings.warnings.forEach((warn, index) => {
      message += `${index + 1}. ⚠️ ${warn.cause}\n`;
      message += `   📅 ${new Date(warn.date).toLocaleString('ar-EG')}\n`;
      message += `   👤 بواسطة: @${ctx.sender.replace(/@s\.whatsapp\.net|@lid/g, '')}\n\n`;
    });
    
    message += '╰────────────────╯';

    // Get all issuers for mentions
    const issuers = warnings.warnings.map(warn => warn.issuer);
    const uniqueIssuers = [...new Set(issuers)];

    await ctx.conn.sendMessage(ctx.chat, {
      text: message,
      mentions: uniqueIssuers
    });
  } catch (error) {
    // console.error('Display warnings error:', error);
    await ctx.reply('❌ فشل عرض الإنذارات');
  }
}

async function handleDeleteOneWarning(ctx) {
  try {
    
    // Admin validation
    const isAdmin = await validateAdmin(ctx);
    if (!isAdmin) {
      return ctx.reply('⚠️ تحتاج صلاحيات المشرفين لهذا الأمر');
    }

    // User resolution
    const targetUser = resolveTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ يرجى تحديد مستخدم عن طريق الرد أو المنشن');
    }

    // Find user warnings
    const userWarnings = await WarningModel.findOne({
      userId: targetUser.id,
      groupId: ctx.chat
    });

    if (!userWarnings?.warnings?.length) {
      return ctx.reply('✔️ لا يوجد إنذارات لحذفها');
    }

    // Remove the last warning
    userWarnings.warnings.pop();
    await userWarnings.save();

    const remainingCount = userWarnings.warnings.length;

    // If no warnings left, delete the document
    if (remainingCount === 0) {
      await WarningModel.deleteOne({ 
        userId: targetUser.id, 
        groupId: ctx.chat 
      });
    }

    await ctx.conn.sendMessage(ctx.chat, {
      text: `✅ تم حذف آخر إنذار من ${targetUser.mention}\n📊 الإنذارات المتبقية: ${remainingCount}/5`,
      mentions: [targetUser.jid]
    });

  } catch (error) {
    // console.error('Delete one warning error:', error);
    await ctx.reply('❌ فشل حذف الإنذار');
  }
}

async function handleClearAllWarnings(ctx) {
  try {
    
    // Admin validation
    const isAdmin = await validateAdmin(ctx);
    if (!isAdmin) {
      return ctx.reply('⚠️ تحتاج صلاحيات المشرفين لهذا الأمر');
    }

    // User resolution
    const targetUser = resolveTargetUser(ctx);
    if (!targetUser) {
      return ctx.reply('⚠️ يرجى تحديد مستخدم عن طريق الرد أو المنشن');
    }

    // Delete all warnings for the user
    const result = await WarningModel.deleteOne({
      userId: targetUser.id,
      groupId: ctx.chat
    });

    if (result.deletedCount === 0) {
      return ctx.reply('✔️ لا يوجد إنذارات لحذفها');
    }

    await ctx.conn.sendMessage(ctx.chat, {
      text: `✅ تم حذف جميع إنذارات ${targetUser.mention}`,
      mentions: [targetUser.jid]
    });

  } catch (error) {
    // console.error('Clear all warnings error:', error);
    await ctx.reply('❌ فشل حذف الإنذارات');
  }
}

// Command router
export const warningHandler = async (ctx, { command }) => {
  try {
    if (!ctx.isGroup) {
      return ctx.reply('🚫 هذا الأمر يعمل فقط في المجموعات');
    }

    switch (command) {
      case 'test-warn':
        // Test command to debug the warning system
        const testUser = resolveTargetUser(ctx);
        const testAdmin = await validateAdmin(ctx);
        
        ctx.reply(`🧪 Test Results:
Admin: ${testAdmin}
Target User: ${testUser ? testUser.jid : 'None'}
Is Group: ${ctx.isGroup}
Command: ${command}`);
        break;
        
      case 'انذار':
        // Extract reason from the full text, removing the command part
        const fullText = ctx.text || '';
        const textParts = fullText.split(' ');
        const reason = textParts.slice(1).join(' ').trim();
        await handleAddWarning(ctx, reason);
        break;
        
      case 'انذاراتي':
        const myUserId = ctx.sender.replace(/@s\.whatsapp\.net|@lid/g, '');
        await handleViewWarnings(ctx, myUserId);
        break;
        
      case 'انذاراته':
        const targetUser = resolveTargetUser(ctx);
        if (!targetUser) {
          return ctx.reply('⚠️ حدد مستخدمًا أولاً عن طريق الرد أو المنشن');
        }
        await handleViewWarnings(ctx, targetUser.id);
        break;
        
      case 'حذف-انذار':
      case 'حذف_انذار':
        await handleDeleteOneWarning(ctx);
        break;
        
      case 'حذف-انذاراته':
      case 'حذف_انذاراته':
        await handleClearAllWarnings(ctx);
        break;
        
      default:
        ctx.reply('⚠️ أمر غير معروف');
    }
  } catch (error) {
    // console.error('Command handler error:', error);
    await ctx.reply('❌ حدث خطأ غير متوقع');
  }
};

// Metadata
warningHandler.command = ['انذار', 'انذاراتي', 'انذاراته', 'حذف-انذار', 'حذف_انذار', 'حذف-انذاراته', 'حذف_انذاراته', 'test-warn'];
warningHandler.tags = ['الإنذارات'];
warningHandler.help = [
  {
    command: 'انذار',
    description: 'إضافة إنذار لعضو (للمشرفين) - استخدام: .انذار @المستخدم [السبب]'
  },
  {
    command: 'انذاراتي',
    description: 'عرض إنذاراتك الخاصة'
  },
  {
    command: 'انذاراته',
    description: 'عرض إنذارات عضو آخر - استخدام: .انذاراته @المستخدم'
  },
  {
    command: 'حذف-انذار / حذف_انذار',
    description: 'حذف آخر إنذار من عضو (للمشرفين) - استخدام: .حذف-انذار @المستخدم'
  },
  {
    command: 'حذف-انذاراته / حذف_انذاراته',
    description: 'حذف جميع إنذارات عضو (للمشرفين) - استخدام: .حذف-انذاراته @المستخدم'
  }
];

export default warningHandler;