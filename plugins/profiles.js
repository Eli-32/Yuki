import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from api.env file
dotenv.config({ path: './api.env' });

// MongoDB URI from environment variables
const medoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/defaultdb';

// Connect to MongoDB with better error handling
const connectDB = async () => {
    try {
        await mongoose.connect(medoUri, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('Connected to MongoDB');
    } catch (medoError) {
        console.error('Error connecting to MongoDB:', medoError);
        process.exit(1);
    }
};

// Initialize connection
connectDB();

// Define the BK9 model
const medoBk9Schema = new mongoose.Schema({
    groupId: { type: String, required: true },
    userId: { type: String, required: true },
    bk9: { type: String, required: true }
}, {
    timestamps: true // Add timestamps for better tracking
});

// Create compound index for better query performance
medoBk9Schema.index({ groupId: 1, userId: 1 }, { unique: true });
medoBk9Schema.index({ groupId: 1, bk9: 1 }, { unique: true });

const medoBK9 = mongoose.model('BK9', medoBk9Schema);

// Helper function to format JID properly
function formatJid(jid) {
    if (!jid) return null;
    if (typeof jid !== 'string') return null;
    if (jid.includes('@s.whatsapp.net')) return jid;
    return `${jid}@s.whatsapp.net`;
}

// Helper function to extract user ID from JID
function extractUserId(jid) {
    if (!jid) return null;
    if (typeof jid !== 'string') return null;
    return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

// Helper function to check admin permissions
async function checkAdminPermission(medoContext) {
    if (!medoContext.isGroup) {
        medoContext.reply('هذا الأمر يعمل فقط في المجموعات');
        return false;
    }

    try {
        const groupMetadata = await medoContext.conn.groupMetadata(medoContext.chat);
        const groupAdmins = groupMetadata.participants
            .filter(participant => participant.admin)
            .map(admin => admin.id);

        if (!groupAdmins.includes(medoContext.sender)) {
            medoContext.reply('هذا الأمر يعمل فقط مع الإداريين');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking admin permission:', error);
        medoContext.reply('حدث خطأ في التحقق من الصلاحيات');
        return false;
    }
}

// Command handler functions
async function handleTitlesCommand(medoContext) {
    if (!(await checkAdminPermission(medoContext))) return;

    try {
        const medoTitles = await medoBK9.find({ groupId: medoContext.chat });
        if (medoTitles.length === 0) {
            medoContext.reply('لا يوجد ألقاب مسجلة حاليا ┇');
        } else {
            const titleCounts = medoTitles.reduce((acc, medoTitle) => {
                acc[medoTitle.bk9] = (acc[medoTitle.bk9] || 0) + 1;
                return acc;
            }, {});

            let medoTitleList = '';
            Object.entries(titleCounts).forEach(([medoTitle, medoCount], medoIndex) => {
                medoTitleList += `${medoIndex + 1} ┇ اللقب: ${medoTitle} ┇ عدد الأشخاص: ${medoCount}\n`;
            });

            medoContext.reply(`┇ عدد الألقاب المسجلة: ${Object.keys(titleCounts).length}\n\n ┇الألقاب المسجلة:\n\n${medoTitleList}`);
        }
    } catch (error) {
        console.error('Error in handleTitlesCommand:', error);
        medoContext.reply('حدث خطأ في جلب الألقاب');
    }
}

async function handleRegisterCommand(medoContext) {
    if (!(await checkAdminPermission(medoContext))) return;

    if (!medoContext.quoted && (!medoContext.mentionedJid || medoContext.mentionedJid.length === 0)) {
        medoContext.reply('منشن احد او رد على رسالته واكتب اللقب الذي تريد تسجيله');
        return;
    }

    try {
        let medoUserId;
        let targetJid;
        
        if (medoContext.quoted) {
            targetJid = medoContext.quoted.sender;
            medoUserId = extractUserId(targetJid);
        } else {
            targetJid = medoContext.mentionedJid[0];
            medoUserId = extractUserId(targetJid);
        }

        const medoTextParts = medoContext.text.trim().split(' ').filter(medoPart => medoPart.trim() !== '');
        const medoTitle = medoTextParts.slice(1).join(' ').trim();

        if (!medoTitle || !/\S/.test(medoTitle)) {
            medoContext.reply('مثال:\n .تسجيل @العضو جيرايا');
            return;
        }

        const medoExistingTitle = await medoBK9.findOne({ bk9: medoTitle, groupId: medoContext.chat });
        if (medoExistingTitle) {
            const existingUserJid = formatJid(medoExistingTitle.userId);
            const medoExistingUser = await medoContext.conn.getName(existingUserJid) || medoExistingTitle.userId;
            
            await medoContext.reply(
                `اللقب ${medoTitle} مأخوذ من طرف @${medoExistingUser}`,
                { mentions: [existingUserJid] }
            );
        } else {
            await medoBK9.findOneAndUpdate(
                { userId: medoUserId, groupId: medoContext.chat },
                { bk9: medoTitle },
                { upsert: true, new: true }
            );
            medoContext.reply(`┇ تم تسجيله بلقب ${medoTitle} بنجاح`);
        }
    } catch (error) {
        console.error('Error in handleRegisterCommand:', error);
        if (error.code === 11000) {
            medoContext.reply('هذا اللقب مأخوذ بالفعل');
        } else {
            medoContext.reply('حدث خطأ في تسجيل اللقب');
        }
    }
}

async function handleDeleteTitleCommand(medoContext) {
    if (!(await checkAdminPermission(medoContext))) return;

    const medoTextParts = medoContext.text.trim().split(' ').filter(medoPart => medoPart.trim() !== '');
    const medoDeleteTitle = medoTextParts.slice(1).join(' ').trim();

    if (!medoDeleteTitle || !/\S/.test(medoDeleteTitle)) {
        medoContext.reply('اكتب اللقب الذي تريد حذفه');
        return;
    }

    try {
        const medoDeleteResult = await medoBK9.deleteOne({ bk9: medoDeleteTitle, groupId: medoContext.chat });

        if (medoDeleteResult.deletedCount > 0) {
            medoContext.reply(`┇ تم حذف اللقب ${medoDeleteTitle} بنجاح`);
        } else {
            medoContext.reply(`اللقب ${medoDeleteTitle} غير مسجل لاحد اساسا`);
        }
    } catch (error) {
        console.error('Error in handleDeleteTitleCommand:', error);
        medoContext.reply('حدث خطأ في حذف اللقب');
    }
}

async function handleMyTitleCommand(medoContext) {
    try {
        const medoSenderId = extractUserId(medoContext.sender);
        const medoUserTitle = await medoBK9.findOne({ userId: medoSenderId, groupId: medoContext.chat });

        medoUserTitle && medoUserTitle.bk9
            ? medoContext.reply(`┇ لقبك هو : ${medoUserTitle.bk9}`)
            : medoContext.reply('┇ لم يتم تسجيلك بعد');
    } catch (error) {
        console.error('Error in handleMyTitleCommand:', error);
        medoContext.reply('حدث خطأ في جلب لقبك');
    }
}

async function handleGetTitleCommand(medoContext) {
    let medoUserId;
    let targetJid;

    if (medoContext.quoted) {
        targetJid = medoContext.quoted.sender;
        medoUserId = extractUserId(targetJid);
    } else if (medoContext.mentionedJid && medoContext.mentionedJid.length > 0) {
        targetJid = medoContext.mentionedJid[0];
        medoUserId = extractUserId(targetJid);
    } else {
        medoContext.reply('منشن احد او رد على رسالته لمعرفة لقبه');
        return;
    }

    try {
        const medoQuotedUserTitle = await medoBK9.findOne({ userId: medoUserId, groupId: medoContext.chat });

        if (medoQuotedUserTitle) {
            const medoQuotedUserName = await medoContext.conn.getName(targetJid) || medoUserId;
            await medoContext.reply(
                `┇ لقب @${medoQuotedUserName} هو : ${medoQuotedUserTitle.bk9}`,
                { mentions: [targetJid] }
            );
        } else {
            medoContext.reply('┇ لم يتم تسجيله بعد');
        }
    } catch (error) {
        console.error('Error in handleGetTitleCommand:', error);
        medoContext.reply('حدث خطأ في جلب اللقب');
    }
}

async function handleCheckTitleCommand(medoContext) {
    const medoTextParts = medoContext.text.trim().split(' ').filter(medoPart => medoPart.trim() !== '');

    if (medoTextParts.length < 2) {
        medoContext.reply('اكتب لقب للتحقق منه');
        return;
    }

    const medoCheckTitle = medoTextParts.slice(1).join(' ').trim();
    
    try {
        const medoCheckResult = await medoBK9.findOne({ bk9: medoCheckTitle, groupId: medoContext.chat });

        if (medoCheckResult) {
            const userJid = formatJid(medoCheckResult.userId);
            const medoCheckUser = await medoContext.conn.getName(userJid) || medoCheckResult.userId;
            
            await medoContext.reply(
                `اللقب ${medoCheckTitle} مأخوذ من طرف @${medoCheckUser}`,
                { mentions: [userJid] }
            );
        } else {
            medoContext.reply(`اللقب ${medoCheckTitle} متوفر`);
        }
    } catch (error) {
        console.error('Error in handleCheckTitleCommand:', error);
        medoContext.reply('حدث خطأ في التحقق من اللقب');
    }
}

// Main handler function
let medoHandler = async function (medoContext, { conn: medoConn, text: medoText, command: medoCommand }) {
    try {
        // Ensure database connection
        if (mongoose.connection.readyState !== 1) {
            await connectDB();
        }

        switch (medoCommand) {
            case 'الالقاب':
            case 'الألقاب':
                await handleTitlesCommand(medoContext);
                break;
            case 'تسجيل':
                await handleRegisterCommand(medoContext);
                break;
            case 'حذف_لقب':
                await handleDeleteTitleCommand(medoContext);
                break;
            case 'لقبي':
                await handleMyTitleCommand(medoContext);
                break;
            case 'لقبه':
                await handleGetTitleCommand(medoContext);
                break;
            case 'لقب':
                await handleCheckTitleCommand(medoContext);
                break;
            default:
                medoContext.reply('أمر غير معروف');
        }
    } catch (error) {
        console.error('Error handling command:', error);
        medoContext.reply('حدث خطأ اثناء معالجة الأمر');
    }
};

// Fixed command array to match switch cases
medoHandler.command = ['الالقاب', 'الألقاب', 'تسجيل', 'لقبي', 'لقبه', 'حذف_لقب', 'لقب'];
medoHandler.tags = ['BK9'];

export default medoHandler;