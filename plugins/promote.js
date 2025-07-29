import fs from 'fs';
import { normalizeJid, safeGroupOperation } from '../lib/simple.js'; // Import the helper functions

const handler = async (m, {conn, usedPrefix, text}) => {

    
    try {
        const datas = global;
        
        // Add safety check for global.db
        if (!datas || !datas.db || !datas.db.data || !datas.db.data.users || !datas.db.data.users[m.sender]) {
            console.error('Database structure is incomplete');
            return conn.reply(m.chat, 'Database error. Please try again later.', m);
        }
        
        const idioma = datas.db.data.users[m.sender].language || global.defaultLenguaje || 'en';
        
        // Add safety check for file reading
        let _translate;
        try {
            const filePath = `./language/${idioma}.json`;
            if (fs.existsSync(filePath)) {
                _translate = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } else {
                console.warn(`Language file not found: ${filePath}, using default`);
                // Try the correct language directory path
                const defaultPath = './language/en.json';
                if (fs.existsSync(defaultPath)) {
                    _translate = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
                } else {
                    console.warn(`Default language file not found: ${defaultPath}, using fallback`);
                }
            }
        } catch (fileError) {
            console.error('Error reading language file:', fileError);
            // Fallback translations
            _translate = {
                plugins: {
                    gc_promote: {
                        texto1: ['Usage: ', 'number'],
                        texto2: 'Invalid number format',
                        texto3: 'User has been promoted'
                    }
                }
            };
        }
        
        const tradutor = _translate.plugins.gc_promote;
        
        let number;
        let user;
        let cleanNumber;
        let properJid;
        // Enhanced parsing to handle @lid mentions and normalize JIDs
        if (!text && !m.quoted) {
            return conn.reply(m.chat, `${tradutor.texto1[0]} ${usedPrefix}ترقيه @tag*\n*┠≽ ${usedPrefix}ترقيه ${tradutor.texto1[1]}`, m);
        }
        try {
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                cleanNumber = m.mentionedJid[0].replace(/@.*$/, '');
            } else if (m.quoted?.sender) {
                cleanNumber = m.quoted.sender.replace(/@.*$/, '');
            } else if (text) {
                const numberMatch = text.match(/@(\d+)/);
                if (numberMatch) {
                    cleanNumber = numberMatch[1];
                } else {
                    cleanNumber = text.replace(/[^\d]/g, '');
                }
            }
            if (!cleanNumber) {
                return conn.reply(m.chat, tradutor.texto2, m);
            }
            properJid = cleanNumber + '@s.whatsapp.net';
            user = properJid;
            // Validation for number length
            if (cleanNumber.length > 13 || (cleanNumber.length < 11 && cleanNumber.length > 0)) {
                return conn.reply(m.chat, tradutor.texto2, m);
            }
            
            // Enhanced validation for @lid vs regular numbers
            if (number && !user.includes('@lid')) {
                if (number.length > 13 || (number.length < 11 && number.length > 0)) {
                    return conn.reply(m.chat, tradutor.texto2, m);
                }
            }
            
            // Additional validation: Check if the JID format is correct
            if (user && !user.includes('@lid') && !user.includes('@s.whatsapp.net') && !user.includes('@g.us')) {
                // If it's not a @lid and doesn't have proper domain, add @s.whatsapp.net
                if (/^\d+$/.test(user)) {
                    user = user + '@s.whatsapp.net';
                }
            }
            
            // Ensure we have a valid user to promote
            if (!user) {
                return conn.reply(m.chat, `${tradutor.texto1[0]} ${usedPrefix}ترقيه @tag*`, m);
            }
            
            // Use the safe group operation function
            await safeGroupOperation(conn, m.chat, [user], 'promote');
            
            // No success message - silent operation
            
        } catch (operationError) {
            console.error('Error in promote operation:', operationError);
            
            // Provide more specific error messages
            if (operationError.message?.includes('not-authorized')) {
                await conn.reply(m.chat, 'I don\'t have permission to promote this user.', m);
            } else if (operationError.message?.includes('participant-not-found')) {
                await conn.reply(m.chat, 'User not found in this group.', m);
            } else if (operationError.message?.includes('@lid')) {
                await conn.reply(m.chat, 'Cannot promote this user due to identifier format issues. Please try again later.', m);
            } else {
                await conn.reply(m.chat, 'An error occurred while trying to promote the user.', m);
            }
        }
        
    } catch (mainError) {
        console.error('Main handler error:', mainError);
        await conn.reply(m.chat, 'An unexpected error occurred.', m);
    }
};

handler.help = ['promote', 'ترقيه', 'ترقية'].map((v) => 'mention ' + v);
handler.tags = ['group'];
handler.command = /^(promote|ترقيه|ترقية)$/i;
handler.group = true;
handler.admin = true;
handler.botAdmin = true;
handler.fail = null;

export default handler; 