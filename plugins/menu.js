// Import necessary modules
import { promises as fsPromises, readFileSync } from "fs";
import { join } from "path";
import { xpRange } from "../lib/levelling.js";
import moment from "moment-timezone";
import os from "os";

// Load the video from config
const menuVideoUrl = "./menu_video.mp4";

// Define menus with emojis
const menus = {
    adminsmenu: `✦ ───『 *المشرفين* 』─── 👾
    👑 *.ترقية* (ترقية مستخدم)
    ❌ *.طرد|بنعالي|انقلع|دزمها* (طرد مستخدم)
    🗑️ *.حذف* (إزالة أو حذف)
    🔗 *.رابط* (عرض رابط المجموعة)
    🔒 *.مخفي* (إرسال رسالة مخفية)
    📉 *.تخفيض* (تخفيض الرتبة)
    📝 *.تسجيل* (تسجيل مستخدم جديد)
    📜 *.الألقاب* (عرض الألقاب)
    🗑️ *.حذف_لقب* (حذف لقب مستخدم)
    🔔 *.منشن* (منشن الجميع)
    🔓 *.فتح|قفل* (فتح أو قفل المجموعة)
    ╰──────────⳹`,

    gamemenu: `✦ ───『 *الألعاب* 』─── ⚝
    🎴 *.ملصق* (إنشاء ملصق)
    📊 *.مس|سس* (مسابقة الشخصيات)
    🎭 *.مكت|سكت* (مسابقة الكلمات)
    🤔 *.متع|ستع* (مسابقة التعرف)
    🔍 *.متف|ستف* (مسابقة التفكيك)
    🔤 *.ص* (لعبة الصور)
    📖 *.كت* (لعبة الكتابة)
    🎲 *.تع|سس* (ألعاب التحدي)
    🔢 *.كت <عدد>* (مثال: .كت 3 - يعطيك 3 أسماء لترجعها اكتب .كت)
    ╰──────────⳹`,

    usermenu: `✦ ───『 *قائمة المستخدمين* 』─── 🎭
    👤 *.لقبي* (عرض لقبك)
    🎉 *.تحسين* (تحسين صورتك)
    🖼️ *.لصورة* (تحويل إلى صورة)
    📹 *.لفيد* (تحويل إلى فيديو)
    📜 *.لقبه* (عرض لقب المستخدم)
    🎨 *.ملصق* (إنشاء ملصق)
    📜 *.منيو|اوامر|menu* (عرض القائمة)
    ╰──────────⳹`
};


// Define bot name
const botname = "Y U K I";

// Main handler function
const handler = async (m, { conn, command, text, args, usedPrefix }) => {
    try {
        let glb = global.db.data.users;
        let usrs = glb[m.sender];
        let tag = `@${m.sender.split("@")[0]}`;
        let mode = global.opts["self"] ? "Private" : "Public";

        let { age, exp, limit, level, role, registered, credit } = glb[m.sender];
        let { min, xp, max } = xpRange(level, global.multiplier);
        let name = await conn.getName(m.sender);
        let premium = glb[m.sender].premiumTime;
        let prems = `${premium > 0 ? "Premium" : "Free"}`;
        let platform = os.platform();

        let ucpn = `${ucapan()}`;

        let _uptime = process.uptime() * 1000;
        let _muptime;
        if (process.send) {
            process.send("uptime");
            _muptime = await new Promise(resolve => {
                process.once("message", resolve);
                setTimeout(resolve, 1000);
            }) * 1000;
        }
        let muptime = clockString(_muptime);
        let uptime = clockString(_uptime);

        let totalfeatures = Object.values(global.plugins).filter((v) => v.help && v.tags).length;
        let totalreg = Object.keys(glb).length;

        conn.gurumenu = conn.gurumenu ? conn.gurumenu : {};

        global.fcontact = {
            key: { fromMe: false, participant: `0@s.whatsapp.net`, remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: `${name}`,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${name}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        const infoText = `
        ${botname} 
        Hi ${name}, Senpai!

        *${ucpn}* 

        乂───『 *U S E R*』───乂
        ⛥ *Rank:* User
        ⛥ *Owner:* Elta/+96176337375
        ╰──────────⳹

╭───────⳹
│ ✨ *1.* قائمة المشرفين (Admins Menu)
│ 🎮 *2.* قائمة الالعاب (Games Menu)
│ 👤 *3.* قائمة المستخدمين (Users Menu)
╰───────⳹
`;

        // React to the message
        await conn.sendMessage(m.chat, { react: { text: '🌀', key: m.key } });

        const { result, key, timeout } = await conn.sendMessage(m.chat, { video: { url: "./menu_video.mp4"  }, caption: infoText.trim(), gifPlayback: false, gifAttribution: 0 }, { quoted: fcontact });

        conn.gurumenu[m.sender] = {
            result,
            key,
            timeout: setTimeout(() => {
                conn.sendMessage(m.chat, { delete: key });
                delete conn.gurumenu[m.sender];
            }, 150 * 1000),
        };
    } catch (err) {
        console.error(err);
        m.reply('An error occurred while processing your request.');
    }
};

// Before handler function to catch user responses
handler.before = async (m, { conn }) => {
    try {
        conn.gurumenu = conn.gurumenu ? conn.gurumenu : {};
        if (m.isBaileys || !(m.sender in conn.gurumenu)) return;
        const { result, key, timeout } = conn.gurumenu[m.sender];
        if (!m.quoted || m.quoted.id !== key.id || !m.text) return;
        const choice = m.text.trim();

        const sendMenu = async (menuName) => {
            await conn.sendMessage(m.chat, { image: { url: './menu.jpg' }, caption: menus[menuName] }, { quoted: fcontact });
        };

        const menuOptions = {
            "1": "adminsmenu",
            "2": "gamemenu",
            "3": "usermenu" 
        };

        if (menuOptions[choice]) {
            await sendMenu(menuOptions[choice]);
        } else {
            m.reply('Invalid choice. Please reply with a valid number.');
        }

        // Add reaction to the message
        await conn.sendMessage(m.chat, { react: { text: '👍', key: m.key } });
    } catch (err) {
        console.error(err);
        m.reply('An error occurred while processing your request.');
    }
};

// Register the handler
handler.help = ["menu"];
handler.tags = ["main"];
handler.command = ['menu', 'اوامر','منيو'];
handler.limit = true;

export default handler;

// Utility functions
function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function clockString(ms) {
    let h = isNaN(ms) ? "--" : Math.floor(ms / 3600000);
    let m = isNaN(ms) ? "--" : Math.floor(ms / 60000) % 60;
    let s = isNaN(ms) ? "--" : Math.floor(ms / 1000) % 60;
    return [h, " H ", m, " M ", s, " S "].map(v => v.toString().padStart(2, 0)).join("");
}

function ucapan() {
    const time = moment.tz("Asia/Kolkata").format("HH");
    if (time >= 4 && time < 10) return "Good Morning 🌄";
    if (time >= 10 && time < 15) return "Good Afternoon ☀️";
    if (time >= 15 && time < 18) return "Good Evening 🌇";
    return "Good Night 🌙";
}
