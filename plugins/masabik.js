import { canLevelUp, xpRange } from '../lib/levelling.js';

let handler = m => m;

// Store game state per group
let gameStates = {};


let names= [
          'لوفي', 'ناروتو', 'سابو', 'ايس', 'رايلي', 'جيرايا', 'ايتاتشي', 'ساسكي', 'شيسوي', 'يوهان',
          'غوهان', 'آيزن', 'فايوليت', 'نامي', 'هانكوك', 'روبين', 'كاكاشي', 'ريومو', 'ريمورو',
          'غوكو', 'غوغو', 'كيلوا', 'غون', 'كورابيكا', 'يوسكي', 'ايشيدا', 'ايتشيغو', 'ميناتو', 'رينجي',
          'جيمبي', 'انوس', 'سايتاما', 'نيزيكو', 'اوراهارا', 'تانجيرو', 'نويل', 'استا', 'يونو', 'لايت',
          'راينر', 'اثي', 'لوكاس', 'زاك', 'الوكا', 'ماها', 'زينو', 'سيلفا', 'رينغوكو', 'تينغن', 'ميتسوري',
          'تنغن', 'هولمز', 'فريزا', 'فريزر', 'غيومي', 'غيو', 'كينق', 'عبدول', 'علي بابا', 'عبدالله', 'اللحية البيضاء',
          'ترانكس', 'تشوبر', 'فرانكي', 'دوفلامينغو', 'كروكودايل', 'ايانوكوجي', 'موراساكيبارا', 'فيلو', 'فو',
          'هان', 'ثورز', 'ثورفين', 'ساي', 'ساسكي', 'سابيتو', 'ساسوري', 'كوراما', 'كابوتو', 'ناروتو', 'لي',
          'غاي', 'شيغاراكي', 'اول فور ون', 'اول مايت', 'تشيساكي', 'كيسامي', 'كيساكي', 'موتين روشي', 'بيل', 'نير',
          'لوغ', 'زورو', 'ماكي', 'ماي', 'شوكو', 'شيزوكو', 'ويس', 'بو', 'بان', 'بولا', 'غوتين', 'مورو', 'سيل',
          'فيجيتا', 'بيروس', 'ديو', 'جوتارو', 'كيرا', 'غاتس', 'غارب', 'هيماواري', 'بوروتو', 'غاجيل', 'جيغن', 'ليو',
          'هيكي', 'هاتشيمان', 'ثوركيل', 'اشيلاد', 'صوفيا', 'ميدوريما', 'ميدوريا', 'ديكو', 'داكي', 'دابي', 'ليفاي',
          'ايرين', 'ارمين', 'ايروين', 'ميكاسا', 'هانجي', 'غابي', 'غابيمارو', 'هيتش', 'ريتش', 'ايلتا', 'توكا', 'كانيكي',
          'ليوريو', 'نيترو', 'ميرويم', 'ماتشي', 'جيلال', 'ميستوغان', 'هيسوكا', 'شالنارك', 'بولنارف', 'كاكيوين', 'فيتان',
          'كينشيرو', 'نوبوناغا', 'ريم', 'رين', 'رايلي', 'زينيتسو', 'ويليام', 'ويندي', 'هوري', 'هيوري', 'هوريكيتا',
          'اوروتشيمارو', 'شادو', 'تسونادي', 'هاشيراما', 'شويو', 'توبيراما', 'هيروزين', 'لولوش', 'نانالي', 'سوزاكو',
          'ميامورا', 'جيمبي', 'اوريهيمي', 'روكيا', 'ماش', 'لانس', 'رينجي', 'استا', 'ايس', 'ايما', 'راي', 'نير', 'ري',
          'كي', 'كيو', 'كو', 'رين', 'ريم', 'شين', 'غوكو', 'هيناتا', 'هاشيراما', 'توبيراما', 'ناروتو', 'بوروتو', 'شيكامارو',
          'شانكس', 'يوريتشي', 'غابيمارو', 'تشوبر', 'زينيتسو', 'ويليام', 'ويس', 'ويل', 'نيل', 'ساتورو', 'غيتو', 'علي',
          'سانغورو', 'نيزوكو', 'ايلومي', 'ميغومي', 'مي مي', 'ماكي', 'ماي', 'ناخت', 'ليخت', 'لاك', 'يامي', 'يوري', 'يور',
          'يو', 'ساسكي', 'ساسوري', 'كانيكي', 'ساساكي', 'البرت', 'ساكورا', 'لاو', 'كيو', 'شوت', 'ابي', 'روز', 'لوف', 'كاتاكوري',
          'رم', 'ابي ابو ايس', 'شوكو', 'ماي ماكي شوكو', 'كونان', 'كايتو', 'توغوموري', 'شينرا', 'بينيمارو', 'هيسوكا', 'فيتان',
          'ماتشي', 'كرولو', 'ساي', 'سابو', 'ثورز', 'ثورفين', 'ثوركيل', 'ثورغيل', 'كنوت', 'ثور', 'ثيو', 'مورا', 'ساكي', 'بارا',
          'يوليوس', 'لوسيوس', 'لامي', 'ميامورا', 'هوري', 'كوروكو', 'كاغامي', 'شيسوي', 'غين', 'ترانكس', 'ايزن', 'دابي', 'دازاي',
          'ايانوكوجي', 'ايتادوري', 'جين', 'يوجي', 'دراغون', 'دازاي', 'ديكو', 'جينوس', 'جيرو', 'جود', 'كود', 'كيد', 'يوميكو'
  ];


async function isAdmin(m, conn) {
    if (!m.isGroup) return false;
    try {
        let groupMetadata = await conn.groupMetadata(m.chat);
        let participants = groupMetadata.participants;
        let admins = participants.filter(p => p.admin);
        return admins.some(admin => admin.id === m.sender);
    } catch (error) {
        console.error('Error fetching group metadata:', error);
        return false;
    }
}

function getGameState(chatId) {
    if (!gameStates[chatId]) {
        gameStates[chatId] = {
            active: false,
            currentNames: [],
            nameCount: 1,
            responses: {},
            playerProgress: {} // Track each player's progress for current round
        };
    }
    return gameStates[chatId];
}

function getRandomNames(count) {
    let selectedNames = [];
    let usedIndices = new Set();
    
    for (let i = 0; i < count && i < names.length; i++) {
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * names.length);
        } while (usedIndices.has(randomIndex));
        
        usedIndices.add(randomIndex);
        selectedNames.push(names[randomIndex]);
    }
    
    return selectedNames;
}

function checkUserProgress(userInput, currentNames, playerProgress, playerId) {
    const normalizedInput = userInput.trim().replace(/\s+/g, ' ').toLowerCase();
    const normalizedNames = currentNames.map(name => name.trim().toLowerCase());

    if (!playerProgress[playerId]) {
        playerProgress[playerId] = new Set();
    }

    let foundNewMatches = false;

    for (let name of normalizedNames) {
        if (!playerProgress[playerId].has(name) && normalizedInput.includes(name)) {
            playerProgress[playerId].add(name);
            foundNewMatches = true;
        }
    }

    const hasAllNames = normalizedNames.every(name => playerProgress[playerId].has(name));

    return {
        foundNewMatches,
        hasAllNames,
        foundCount: playerProgress[playerId].size,
        totalCount: normalizedNames.length
    };
}

handler.all = async function(m, { conn }) {
    const chatId = m.chat;
    const gameState = getGameState(chatId);
    
    // Check for start game command with optional number
    const startMatch = m.text.match(/^\.مكت\s*(\d+)?$/i);
    if (startMatch) {
        if (gameState.active) {
            return m.reply('اللعبة قيد التشغيل بالفعل.');
        }

        // Parse the number (supports both Arabic and English numerals)
        let requestedCount = 1;
        if (startMatch[1]) {
            // Convert Arabic numerals to English if needed
            const arabicToEnglish = startMatch[1].replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            requestedCount = parseInt(arabicToEnglish) || 1;
        }

        gameState.active = true;
        gameState.nameCount = requestedCount;
        gameState.responses = {}; // Reset responses
        gameState.playerProgress = {}; // Reset player progress
        gameState.currentNames = getRandomNames(requestedCount);
        
        // Display names with spaces between them
        const nameDisplay = gameState.currentNames.join(' ');
        await m.reply(`*${nameDisplay}*`);
        
    } else if (/^\.سكت$/i.test(m.text)) {
        if (!gameState.active) {
            return m.reply('لا توجد لعبة قيد التشغيل حالياً.');
        }

        gameState.active = false;

        if (Object.keys(gameState.responses).length === 0) {
            await m.reply('لم يربح أحد نقاطاً في هذه اللعبة.');
        } else {
            let result = Object.entries(gameState.responses).map(([jid, points]) => {
                return `@${jid.split('@')[0]}: ${points} نقطة`;
            }).join('\n');

            await m.reply(`اللعبة انتهت!\n\nالنقاط:\n${result}`, null, {
                mentions: Object.keys(gameState.responses)
            });
        }

        gameState.currentNames = []; // Clear the current names
        gameState.playerProgress = {}; // Clear player progress
        
    } else if (gameState.active && gameState.currentNames.length > 0) {
        // Check user progress for current names
        const progress = checkUserProgress(
            m.text, 
            gameState.currentNames, 
            gameState.playerProgress, 
            m.sender
        );
        
        if (progress.foundNewMatches && progress.hasAllNames) {
            // Player completed all names - give point and move to next round
            if (!gameState.responses[m.sender]) {
                gameState.responses[m.sender] = 1;
            } else {
                gameState.responses[m.sender] += 1;
            }

            // Clear all players' progress for new round
            gameState.playerProgress = {};
            
            // Generate new names
            gameState.currentNames = getRandomNames(gameState.nameCount);
            const nameDisplay = gameState.currentNames.join(' ');
            await m.reply(`*${nameDisplay}*`);
        }
        // Silent tracking - no feedback for partial matches
    }
};
export default handler;