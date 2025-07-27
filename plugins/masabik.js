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
            playerProgress: {},
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

// Improved Arabic text normalization
function normalizeArabicText(text) {
    return text
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[ًٌٍَُِّْ]/g, '') // Remove Arabic diacritics
        .replace(/[أإآا]/g, 'ا') // Normalize all alef variants including آ
        .replace(/ة/g, 'ه') // Normalize taa marboota
        .replace(/ى/g, 'ي') // Normalize alef maksura
        .replace(/ؤ/g, 'و') // Normalize waw with hamza
        .replace(/ئ/g, 'ي'); // Normalize yaa with hamza
}

function checkUserProgress(userInput, currentNames, playerProgress, playerId) {
    const normalizedInput = normalizeArabicText(userInput).toLowerCase();
    
    if (!playerProgress[playerId]) {
        playerProgress[playerId] = new Set();
    }

    let foundNewMatches = false;

    for (let originalName of currentNames) {
        const normalizedName = normalizeArabicText(originalName).toLowerCase();
        
        console.log(`Checking: "${normalizedInput}" against "${normalizedName}" (original: "${originalName}")`); // Debug log
        
        // Check if this name hasn't been found yet and is present in the input
        if (!playerProgress[playerId].has(originalName)) {
            // Try multiple matching methods:
            
            // Method 1: Exact match after normalization
            let nameMatches = normalizedInput === normalizedName;
            
            // Method 2: Contains match
            if (!nameMatches) {
                nameMatches = normalizedInput.includes(normalizedName) || normalizedName.includes(normalizedInput);
            }
            
            // Method 3: Word-based matching for multi-word names
            if (!nameMatches) {
                const inputWords = normalizedInput.split(/\s+/);
                const nameWords = normalizedName.split(/\s+/);
                
                // Check if all words of the name are present in the input
                nameMatches = nameWords.every(nameWord => 
                    inputWords.some(inputWord => 
                        inputWord.includes(nameWord) || nameWord.includes(inputWord)
                    )
                );
            }
            
            if (nameMatches) {
                playerProgress[playerId].add(originalName);
                foundNewMatches = true;
                console.log(`✓ Player ${playerId} found: ${originalName}`); // Debug log
            }
        }
    }

    const hasAllNames = currentNames.every(name => playerProgress[playerId].has(name));

    return {
        foundNewMatches,
        hasAllNames,
        foundCount: playerProgress[playerId].size,
        totalCount: currentNames.length
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
            let numStr = startMatch[1].replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            requestedCount = parseInt(numStr) || 1;
            // Limit to reasonable number
            requestedCount = Math.min(Math.max(requestedCount, 1), 10);
        }

        // Reset state ONLY here
        gameState.active = true;
        gameState.nameCount = requestedCount;
        gameState.responses = {};
        gameState.playerProgress = {};
        gameState.currentNames = getRandomNames(requestedCount);
        
        console.log(`Game started with names: ${gameState.currentNames.join(', ')}`); // Debug log
        
        // Display names with spaces between them
        const nameDisplay = gameState.currentNames.join(' ');
        await m.reply(`*${nameDisplay}*`);
        
    } else if (/^\.تست (.+)$/i.test(m.text)) {
        // Debug command to test matching
        const testInput = m.text.match(/^\.تست (.+)$/i)[1];
        const normalized = normalizeArabicText(testInput);
        let results = [];
        
        names.slice(0, 10).forEach(name => {
            const normalizedName = normalizeArabicText(name);
            if (normalized === normalizedName || normalized.includes(normalizedName) || normalizedName.includes(normalized)) {
                results.push(`${name} ← ${normalizedName}`);
            }
        });
        
        await m.reply(`Input: "${testInput}" → "${normalized}"\n\nMatches:\n${results.join('\n') || 'No matches'}`);
        
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
        
    } else if (gameState.active && gameState.currentNames.length > 0 && m.text && !m.text.startsWith('.')) {
        // Only process non-command messages when game is active
        // Check user progress for current names using ONLY this message
        // Prevent single-letter words from being considered
        if (m.text.trim().length <= 1) return;
        const progress = checkUserProgress(
            m.text,
            gameState.currentNames,
            gameState.playerProgress,
            m.sender
        );

        if (progress.hasAllNames) {
            // Player completed all names - give point and move to next round
            if (!gameState.responses[m.sender]) {
                gameState.responses[m.sender] = 1;
            } else {
                gameState.responses[m.sender] += 1;
            }

            // No confirmation message, just show new names
            gameState.playerProgress = {};
            gameState.currentNames = getRandomNames(gameState.nameCount);
            console.log(`New round with names: ${gameState.currentNames.join(', ')}`); // Debug log
            const nameDisplay = gameState.currentNames.join(' ');
            await m.reply(`*${nameDisplay}*`);
        }
    }
};

export default handler;