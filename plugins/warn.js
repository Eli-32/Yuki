import mongoose from 'mongoose';
import dotenv from 'dotenv';
import WarningModel from '../lib/Warning.js';

dotenv.config({ path: './api.env' });

// Database connection setup
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in api.env');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected!');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔁 MongoDB reconnected');
});

// Core functionality
const validateAdmin = async (ctx) => {
  try {
    const metadata = await ctx.conn.groupMetadata(ctx.chat);
    return metadata.participants.some(
      participant => participant.id === ctx.sender && participant.admin
    );
  } catch (error) {
    console.error('Admin validation error:', error);
    return false;
  }
};

const resolveTargetUser = (ctx) => {
  try {
    if (ctx.quoted) {
      return {
        id: ctx.quoted.sender.replace('@s.whatsapp.net', ''),
        jid: ctx.quoted.sender,
        mention: `@${ctx.quoted.sender.split('@')[0]}`
      };
    }

    if (ctx.mentionedJid?.length > 0) {
      return {
        id: ctx.mentionedJid[0].replace('@s.whatsapp.net', ''),
        jid: ctx.mentionedJid[0],
        mention: `@${ctx.mentionedJid[0].split('@')[0]}`
      };
    }

    return null;
  } catch (error) {
    console.error('User resolution error:', error);
    return null;
  }
};

async function handleAddWarning(ctx, reason) {
  try {
    console.log('[DEBUG] Command received from:', ctx.sender);

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
        const isBotAdmin = await validateAdmin(ctx);
        if (isBotAdmin) {
          // Correct Baileys removal method
          await ctx.conn.groupParticipantsUpdate(
            ctx.chat,
            [targetUser.jid],
            'remove'
          );
          
          await ctx.conn.sendMessage(ctx.chat, {
            text: `.بنعالي (${targetUser.mention})`,
            mentions: [targetUser.jid]
          });
          
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
        console.error('Removal failed:', removeError);
        await ctx.reply('❌ فشل طرد العضو - تأكد من صلاحيات البوت');
      }
    }
  } catch (error) {
    console.error('[FULL ERROR]', error);
    ctx.reply('❌ فشل إضافة الإنذار - الرجاء التحقق من السجلات');
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
        text: '✔️ لا يوجد إنذارات مسجلة',
        mentions: [ctx.sender]
      });
    }

    let message = '╭─🚨 سجل الإنذارات ─╮\n';
    warnings.warnings.forEach((warn, index) => {
      message += `\n${index + 1}. ⚠️ ${warn.cause}\n   📅 ${new Date(warn.date).toLocaleString('ar-EG')}\n   👤 بواسطة: @${warn.issuer.split('@')[0]}\n`;
    });
    message += '╰────────────────╯';

    await ctx.conn.sendMessage(ctx.chat, {
      text: message,
      mentions: [`${targetUserId}@s.whatsapp.net`]
    });
  } catch (error) {
    console.error('Display warnings error:', error);
    ctx.reply('❌ فشل عرض الإنذارات');
  }
}

// Command router
export const warningHandler = async (ctx, { command }) => {
  try {
    if (!ctx.isGroup) {
      return ctx.reply('🚫 هذا الأمر يعمل فقط في المجموعات');
    }

    switch (command) {
      case 'انذار':
        await handleAddWarning(ctx, ctx.text.split(' ').slice(1).join(' '));
        break;
      case 'انذاراتي':
        await handleViewWarnings(ctx, ctx.sender.replace('@s.whatsapp.net', ''));
        break;
      case 'انذاراته':
        const targetUser = resolveTargetUser(ctx);
        if (!targetUser) return ctx.reply('⚠️ حدد مستخدمًا أولاً');
        await handleViewWarnings(ctx, targetUser.id);
        break;
      case 'حذف-انذاراته':
        // Add clearance logic here
        break;
      default:
        ctx.reply('⚠️ أمر غير معروف');
    }
  } catch (error) {
    console.error('Command handler error:', error);
    ctx.reply('❌ حدث خطأ غير متوقع');
  }
};

connectDB();

// Metadata
warningHandler.command = ['انذار', 'انذاراتي', 'انذاراته', 'حذف-انذاراته'];
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
  }
];

export default warningHandler;