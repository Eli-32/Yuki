import axios from 'axios';
import { isOwner } from '../lib/owner-check.js';
import fs from 'fs';
import path from 'path';

// Anime character validation API endpoints
const ANIME_APIS = [
  'https://api.jikan.moe/v4/characters',
  'https://api.myanimelist.net/v2/characters'
];

// Cache for validated anime characters to avoid repeated API calls
const animeCharacterCache = new Map();
const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

// Global state for anime detection (per chat)
const animeDetectionActive = new Map();

// Function to get masabik game states (will be available after masabik.js loads)
function getMasabikGameStates() {
  return global.masabikGameStates || {};
}

// Learning system - persistent storage for discovered mappings
const LEARNED_MAPPINGS_FILE = './data/learned_anime_mappings.json';
let learnedMappings = new Map();

// Load learned mappings on startup
try {
  if (fs.existsSync(LEARNED_MAPPINGS_FILE)) {
    const data = JSON.parse(fs.readFileSync(LEARNED_MAPPINGS_FILE, 'utf8'));
    learnedMappings = new Map(Object.entries(data));
    console.log(`Loaded ${learnedMappings.size} learned anime character mappings`);
  } else {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(LEARNED_MAPPINGS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
} catch (error) {
  console.error('Error loading learned mappings:', error);
}

// Save learned mappings to file
function saveLearnedMappings() {
  try {
    const data = Object.fromEntries(learnedMappings);
    fs.writeFileSync(LEARNED_MAPPINGS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving learned mappings:', error);
  }
}

let masabikBotDelay = 100; // ms, initial delay
let masabikBotWins = 0;
let masabikBotLosses = 0;
const MASABIK_BOT_DELAY_MIN = 80;
const MASABIK_BOT_DELAY_MAX = 800;
const MASABIK_BOT_DELAY_STEP = 80;

let handler = async (m, { conn, text, command, isOwner }) => {
  const chatId = m.chat;
  
  // --- REPLY-TO-LEARN FEATURE ---
  // If user replies to a message with an asterisked Arabic name and types .add <english_name>
  if (m.quoted && m.text && m.text.trim().toLowerCase().startsWith('.add ')) {
    // Extract the English name
    const englishName = m.text.trim().slice(5).trim();
    // Extract all Arabic names from the quoted message (all asterisked words)
    const quotedText = m.quoted.text || '';
    const matches = quotedText.match(/\*([^*]+)\*/g) || [];
    // Find the first unrecognized name
    let nameToAdd = null;
    for (const match of matches) {
      const arabicName = match.replace(/\*/g, '').trim();
      const normalizedName = normalizeArabicName(arabicName);
      if (!learnedMappings.has(normalizedName)) {
        nameToAdd = arabicName;
        break;
      }
    }
    if (nameToAdd && englishName) {
      const normalizedName = normalizeArabicName(nameToAdd);
      learnedMappings.set(normalizedName, { name: englishName });
      saveLearnedMappings();
      await conn.sendMessage(chatId, { text: `✅ تمت إضافة: *${nameToAdd}* → ${englishName}` }, { quoted: m });
      return;
    } else if (!nameToAdd) {
      await conn.sendMessage(chatId, { text: '❌ جميع الأسماء في الرسالة معروفة بالفعل.' }, { quoted: m });
      return;
    } else {
      await conn.sendMessage(chatId, { text: '❌ يرجى الرد على رسالة تحتوي على اسم أنمي بين نجمتين وكتابة .add <الاسم بالإنجليزية>' }, { quoted: m });
      return;
    }
  }

  // Check if this is an owner command to toggle anime detection
  if (command === 'at' || command === 'aa') {
    // Only owner can control this feature
    if (!isOwner) {
      return await conn.sendMessage(chatId, { 
        text: '❌ هذا الأمر متاح للمالك فقط.' 
      });
    }

    if (command === 'at') {
      animeDetectionActive.set(chatId, true);
      return await conn.sendMessage(chatId, { 
        text: 'ابدا' 
      });
    } else {
      animeDetectionActive.set(chatId, false);
      return await conn.sendMessage(chatId, { 
        text: '❌ تم إيقاف كاشف أسماء الأنمي.' 
      });
    }
  }

  // Check if anime detection is active for this chat OR if there's an active masabik challenge
  const masabikGameStates = getMasabikGameStates();
  const masabikActive = masabikGameStates[chatId]?.active || false;
  const masabikNames = masabikGameStates[chatId]?.currentNames || [];
  
  if (!animeDetectionActive.get(chatId) && !masabikActive) {
    return; // Do nothing if neither is active
  }

  // Find all text between asterisks - strict matching for pure anime names only
  const animeNameMatches = m.text?.match(/\*([^*]+)\*/g);
  if (!animeNameMatches || animeNameMatches.length === 0) {
    return; // No anime name patterns found
  }

  // For each asterisked word, extract and validate independently
  const recognizedNames = [];
  for (const match of animeNameMatches) {
    const matchContent = match.replace(/\*/g, '').trim();
    const firstNameArr = [matchContent.split(/\s+/)[0]].filter(name => name.length >= 2 && name.length <= 50);
    for (const word of firstNameArr) {
      const normalized = normalizeArabicName(word);
      let isRecognized = false;
      // 1. Check learnedMappings (.json file) - exact match only
      if (learnedMappings.has(normalized)) {
        recognizedNames.push(word);
        isRecognized = true;
      } else {
        // 2. Check built-in mapping - exact match only
        const builtInMapping = getEnglishSearchTerms.arabicToEnglish || {};
        if (builtInMapping[word] || builtInMapping[normalized]) {
          recognizedNames.push(word);
          isRecognized = true;
        }
        // 3. (Optional) Live API check can be added here if desired
      }
      if (isRecognized) {
        console.log(`🔍 Recognized anime name: "${word}"`);
      }
    }
  }

  // Only respond if at least one recognized name is found
  if (recognizedNames.length > 0) {
    if (masabikActive) {
      setTimeout(async () => {
        await conn.sendMessage(chatId, { text: recognizedNames.join(' ') });
      }, masabikBotDelay);
    } else {
      await conn.sendMessage(chatId, { text: recognizedNames.join(' ') });
    }
  }
  // If no valid names are found, do not respond at all

  // --- Adaptive bot speed logic for masabik ---
  if (masabikActive) {
    // If bot wins, increase delay a bit (up to max)
    if (/* logic to detect bot win, e.g. bot's answer matches all masabik names */ false) {
      masabikBotWins++;
      masabikBotDelay = Math.min(MASABIK_BOT_DELAY_MAX, masabikBotDelay + MASABIK_BOT_DELAY_STEP);
    }
    // If bot loses, decrease delay a bit (down to min)
    if (/* logic to detect bot loss, e.g. human wins round */ false) {
      masabikBotLosses++;
      masabikBotDelay = Math.max(MASABIK_BOT_DELAY_MIN, masabikBotDelay - MASABIK_BOT_DELAY_STEP);
    }
  }

  // --- TYPO SUGGESTION FEATURE ---
  // If there are asterisked names, but none are recognized, suggest close matches
  // This section is no longer needed as recognition is strict
  // if (unrecognizedNames.length > 0) {
  //   const knownArabicNames = Array.from(new Set([
  //     ...Object.keys(getEnglishSearchTerms.arabicToEnglish || {}),
  //     ...Array.from(learnedMappings.keys())
  //   ]));
  //   for (const name of unrecognizedNames) {
  //     // Only suggest if not found in mappings
  //     const normalized = normalizeArabicName(name);
  //     if (!learnedMappings.has(normalized) && !knownArabicNames.includes(name)) {
  //       // Find up to 3 closest matches
  //       const scored = knownArabicNames.map(n => ({ n, score: calculateSimilarity(normalized, normalizeArabicName(n)) }));
  //       scored.sort((a, b) => b.score - a.score);
  //       const suggestions = scored.filter(s => s.score > 0.4).slice(0, 3);
  //       if (suggestions.length > 0) {
  //         const suggestionList = suggestions.map((s, i) => `${i+1}. *${s.n}*`).join('\n');
  //         await conn.sendMessage(chatId, { text: `❓ لم أتعرف على "${name}". هل تقصد:\n${suggestionList}` }, { quoted: m });
  //         return;
  //       }
  //     }
  //   }
  // }

  // Process each potential anime name in parallel for speed
  for (const potentialAnimeName of recognizedNames) {
    console.log(`🔍 Processing anime name: "${potentialAnimeName}"`);

    // Add to parallel validation
    // validationPromises.push(
    //   validateAnimeCharacter(potentialAnimeName).then(result => {
    //     console.log(`✅ Validation result for "${potentialAnimeName}":`, result ? 'VALID' : 'INVALID');
    //     return {
    //       name: potentialAnimeName,
    //       isValid: result
    //     };
    //   }).catch(error => {
    //     console.error('Anime detection error for', potentialAnimeName, ':', error);
    //     return { name: potentialAnimeName, isValid: false };
    //   })
    // );
  }

  // Wait for all validations to complete in parallel
  // if (validationPromises.length > 0) {
  //   try {
  //     console.log(`🔄 Validating ${validationPromises.length} anime names in parallel...`);
  //     const results = await Promise.all(validationPromises);
      
  //     for (const result of results) {
  //       if (result.isValid) {
  //         validAnimeNames.push(result.name);
  //         console.log(`✅ Added valid anime name: "${result.name}"`);
  //       }
  //     }

  //     // If we found valid anime characters, send them without replying
  //     if (validAnimeNames.length > 0) {
  //       const response = validAnimeNames.join(' '); // Changed from '\n' to ' ' for side-by-side display
  //       console.log(`📤 Sending response with ${validAnimeNames.length} names: "${response}"`);
  //       await conn.sendMessage(chatId, {
  //         text: response
  //       }); // No quoted message - just send normally
  //     } else {
  //       console.log('❌ No valid anime characters found');
  //     }
  //   } catch (error) {
  //     console.error('Parallel anime validation error:', error);
  //   }
  // }
};

/**
 * Validate if a name is actually an anime character with learning system
 * @param {string} name - Character name to validate (in Arabic)
 * @returns {Object|false} - Character info if valid, false otherwise
 */
async function validateAnimeCharacter(name) {
  // Check cache first
  const cacheKey = name.toLowerCase();
  const cached = animeCharacterCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < cacheExpiry) {
    return cached.data;
  }

  // Check learned mappings first (instant response)
  const normalizedName = normalizeArabicName(name);
  if (learnedMappings.has(normalizedName)) {
    const learnedData = learnedMappings.get(normalizedName);
    
    // Cache the learned result
    animeCharacterCache.set(cacheKey, {
      data: learnedData,
      timestamp: Date.now()
    });
    
    return learnedData;
  }

  try {
    // Convert Arabic name to possible English equivalents for searching
    const searchTerms = getEnglishSearchTerms(name);
    
    // Smart search: try romanization and fuzzy matching if no direct mappings
    if (searchTerms.length === 1) {
      // Add smart romanization attempts
      searchTerms.push(
        smartRomanizeArabic(name),
        name.replace(/ي/g, 'i').replace(/و/g, 'u').replace(/ا/g, 'a'), // Basic vowel mapping
        name.replace(/ة/g, 'a').replace(/ه/g, 'a') // Common endings
      );
    }
    
    // Try the most likely matches first
    const prioritizedTerms = [...new Set(searchTerms)].slice(0, 4); // Remove duplicates, limit to 4
    
    for (const searchTerm of prioritizedTerms) {
      if (!searchTerm || searchTerm.length < 2) continue;
      
      // Try Jikan API (MyAnimeList) with English search term
      const searchUrl = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(searchTerm)}&limit=8`;
      
      const response = await axios.get(searchUrl, {
        timeout: 3000, // Further reduced timeout
        headers: {
          'User-Agent': 'AnimeBot/1.0'
        }
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        // Check character results with smart matching
        for (const character of response.data.data.slice(0, 5)) {
          const characterName = character.name.toLowerCase();
          const searchTermLower = searchTerm.toLowerCase();
          
          // Multiple matching strategies
          const exactMatch = characterName === searchTermLower;
          const containsMatch = characterName.includes(searchTermLower) || searchTermLower.includes(characterName);
          const similarity = calculateSimilarity(searchTermLower, characterName);
          const wordMatch = characterName.split(' ').some(word =>
            word === searchTermLower || calculateSimilarity(word, searchTermLower) > 0.7
          );
         // Popular character threshold
         const popularCharacters = ['gojo', 'satoru', 'satoru gojo', 'goku', 'luffy', 'naruto', 'eren', 'levi', 'tanjiro', 'nezuko', 'sasuke', 'itachi'];
         const isPopular = popularCharacters.some(pc => characterName.includes(pc));
         const threshold = isPopular ? 0.4 : 0.6;
         // Split name matching
         const searchParts = searchTermLower.split(' ');
         const charParts = characterName.split(' ');
         const partMatch = searchParts.some(sp => charParts.some(cp => cp === sp || cp.includes(sp) || sp.includes(cp)));

          if (exactMatch || similarity > threshold || (containsMatch && similarity > 0.4) || wordMatch || partMatch) {
            const characterInfo = {
              name: character.name,
              anime: character.anime?.[0]?.title || null,
              description: character.about || null,
              image: character.images?.jpg?.image_url || null,
              url: character.url || null
            };

            // LEARNING SYSTEM: Save this successful mapping for future instant access
            learnedMappings.set(normalizedName, characterInfo);
            
            // Also save alternative spellings that might be used
            const alternatives = generateAlternativeSpellings(name);
            for (const alt of alternatives) {
              const altNormalized = normalizeArabicName(alt);
              if (!learnedMappings.has(altNormalized)) {
                learnedMappings.set(altNormalized, characterInfo);
              }
            }
            
            // Save to persistent storage (async, don't wait)
            setTimeout(() => saveLearnedMappings(), 100);

            // Cache the result
            animeCharacterCache.set(cacheKey, {
              data: characterInfo,
              timestamp: Date.now()
            });

            console.log(`🎌 Learned new mapping: ${name} -> ${character.name}`);
            return characterInfo;
          }
        }
      }
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // If no match found, cache negative result for a shorter time
    animeCharacterCache.set(cacheKey, {
      data: false,
      timestamp: Date.now()
    });

    return false;

  } catch (error) {
    console.error('Anime API error:', error.message);
    
    // Cache negative result on error to avoid repeated failed requests
    animeCharacterCache.set(cacheKey, {
      data: false,
      timestamp: Date.now()
    });
    
    return false;
  }
}

/**
 * Generate alternative spellings for Arabic names (enhanced for typing mistakes)
 * @param {string} name - Original Arabic name
 * @returns {Array} - Array of alternative spellings
 */
function generateAlternativeSpellings(name) {
  const alternatives = [];
  
  // Common letter substitutions (including typing mistakes)
  const substitutions = [
    // Similar looking/sounding letters
    [/ج/g, 'غ'], [/ج/g, 'ق'], [/غ/g, 'ج'], [/غ/g, 'ق'], [/ق/g, 'ج'], [/ق/g, 'غ'],
    [/ح/g, 'خ'], [/خ/g, 'ح'], [/ح/g, 'ه'], [/ه/g, 'ح'],
    [/س/g, 'ش'], [/ش/g, 'س'], [/س/g, 'ص'], [/ص/g, 'س'],
    [/ص/g, 'ض'], [/ض/g, 'ص'],
    [/ت/g, 'ث'], [/ث/g, 'ت'], [/ت/g, 'ط'], [/ط/g, 'ت'],
    [/د/g, 'ذ'], [/ذ/g, 'د'],
    [/ر/g, 'ز'], [/ز/g, 'ر'],
    [/ط/g, 'ظ'], [/ظ/g, 'ط'],
    [/ك/g, 'ق'], [/ق/g, 'ك'], [/ك/g, 'ج'], [/ج/g, 'ك'],
    [/ي/g, 'ى'], [/ى/g, 'ي'], [/ي/g, 'ج'], [/ج/g, 'ي'],
    [/ة/g, 'ه'], [/ه/g, 'ة'], [/ة/g, 'ت'], [/ت/g, 'ة'],
    [/و/g, 'ؤ'], [/ؤ/g, 'و'], [/و/g, 'ة'], [/ة/g, 'و'],
    [/ا/g, 'أ'], [/أ/g, 'ا'], [/ا/g, 'إ'], [/إ/g, 'ا'],
    [/ن/g, 'م'], [/م/g, 'ن'], // Common typing mistakes
    [/ف/g, 'ب'], [/ب/g, 'ف'], // Adjacent keys
    [/ل/g, 'ك'], [/ك/g, 'ل']  // Adjacent keys
  ];
  
  // Generate alternatives with single substitutions
  for (const [from, to] of substitutions) {
    if (name.match(from)) {
      const alternative = name.replace(from, to);
      if (alternative !== name) {
        alternatives.push(alternative);
      }
    }
  }
  
  // Generate alternatives with missing/extra letters (common typing mistakes)
  const chars = name.split('');
  
  // Missing letter alternatives (remove each letter once)
  for (let i = 0; i < chars.length; i++) {
    if (chars.length > 3) { // Don't make names too short
      const missing = chars.slice(0, i).concat(chars.slice(i + 1)).join('');
      alternatives.push(missing);
    }
  }
  
  // Extra letter alternatives (double letters - common typing mistake)
  for (let i = 0; i < chars.length; i++) {
    const doubled = chars.slice(0, i + 1).concat([chars[i]]).concat(chars.slice(i + 1)).join('');
    if (doubled.length <= 15) { // Don't make names too long
      alternatives.push(doubled);
    }
  }
  
  // Swapped adjacent letters (common typing mistake)
  for (let i = 0; i < chars.length - 1; i++) {
    const swapped = [...chars];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    alternatives.push(swapped.join(''));
  }
  
  // Remove duplicates and limit
  return [...new Set(alternatives)].slice(0, 8); // Increased limit for better matching
}

/**
 * Smart romanization with better phonetic mapping
 * @param {string} arabic - Arabic text
 * @returns {string} - Romanized text
 */
function smartRomanizeArabic(arabic) {
  const smartMapping = {
    'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's',
    'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': '', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'o', 'ي': 'i',
    'ى': 'a', 'ة': 'a', 'ء': ''
  };
  
  return arabic.split('').map(char => smartMapping[char] || char).join('').replace(/\s+/g, '');
}

/**
 * Convert Arabic anime character names to possible English search terms
 * @param {string} arabicName - Arabic character name
 * @returns {Array} - Array of possible English search terms
 */
function getEnglishSearchTerms(arabicName) {
  // Normalize Arabic name for fuzzy matching (treat similar letters as same)
  const normalizedName = normalizeArabicName(arabicName);
  
  // Common Arabic to English anime character name mappings with alternatives
  const arabicToEnglish = {
    // Naruto characters
    'ناروتو': ['Naruto', 'Naruto Uzumaki'],
    'ساسكي': ['Sasuke', 'Sasuke Uchiha'],
    'ساكورا': ['Sakura', 'Sakura Haruno'],
    'كاكاشي': ['Kakashi', 'Kakashi Hatake'],
    'ايتاشي': ['Itachi', 'Itachi Uchiha'],
    'مادارا': ['Madara', 'Madara Uchiha'],
    'هيناتا': ['Hinata', 'Hinata Hyuga'],
    'نيجي': ['Neji', 'Neji Hyuga'],
    'غارا': ['Gaara'],
    'جارا': ['Gaara'], // Alternative spelling
    'قارا': ['Gaara'], // Alternative spelling
    'اوروتشيمارو': ['Orochimaru'],
    'جيرايا': ['Jiraiya'],
    'تسونادي': ['Tsunade'],
    'تيماري': ['Temari'],
    'تمماري': ['Temari'], // Alternative spelling
    'شيكامارو': ['Shikamaru', 'Shikamaru Nara'],
    'كيبا': ['Kiba', 'Kiba Inuzuka'],
    'شينو': ['Shino', 'Shino Aburame'],
    'لي': ['Lee', 'Rock Lee'],
    'تين تين': ['Tenten'],
    'غيومي': ['Gyomei', 'Gyomei Himejima'],
    'جيومي': ['Gyomei', 'Gyomei Himejima'], // Alternative spelling
    'قيومي': ['Gyomei', 'Gyomei Himejima'], // Alternative spelling
    
    // Dragon Ball characters
    'غوكو': ['Goku', 'Son Goku'],
    'جوكو': ['Goku', 'Son Goku'], // Alternative spelling
    'قوكو': ['Goku', 'Son Goku'], // Alternative spelling
    'فيجيتا': ['Vegeta'],
    'غوهان': ['Gohan', 'Son Gohan'],
    'جوهان': ['Gohan', 'Son Gohan'], // Alternative spelling
    'بيكولو': ['Piccolo'],
    'فريزا': ['Frieza', 'Freeza'],
    'سيل': ['Cell'],
    'بو': ['Buu', 'Majin Buu'],
    'ترانكس': ['Trunks'],
    'غوتين': ['Goten', 'Son Goten'],
    'جوتين': ['Goten', 'Son Goten'], // Alternative spelling
    'كريلين': ['Krillin'],
    'ياموتشا': ['Yamcha'],
    'تين شين هان': ['Tien', 'Tien Shinhan'],
    
    // One Piece characters
    'لوفي': ['Luffy', 'Monkey D Luffy'],
    'زورو': ['Zoro', 'Roronoa Zoro'],
    'نامي': ['Nami'],
    'سانجي': ['Sanji'],
    'تشوبر': ['Chopper', 'Tony Tony Chopper'],
    'روبين': ['Robin', 'Nico Robin'],
    'فرانكي': ['Franky'],
    'بروك': ['Brook'],
    'اوسوب': ['Usopp'],
    'جينبي': ['Jinbe'],
    'ايس': ['Ace', 'Portgas D Ace'],
    'شانكس': ['Shanks'],
    'كايدو': ['Kaido'],
    'بيغ مام': ['Big Mom'],
    'دوفلامينغو': ['Doflamingo'],
    'كروكودايل': ['Crocodile'],
    'ميهوك': ['Mihawk'],
    
    // Marine Admirals
    'كيزارو': ['Kizaru', 'Borsalino'],
    'اكاينو': ['Akainu', 'Sakazuki'],
    'اوكيجي': ['Aokiji', 'Kuzan'],
    'فوجيتورا': ['Fujitora', 'Issho'],
    'ريوكوغيو': ['Ryokugyu', 'Aramaki'],
    
    // Beast Pirates
    'كينغ': ['King', 'Alber'],
    'كوين': ['Queen'],
    'جاك': ['Jack'],
    'اولتي': ['Ulti'],
    'بيج سيكس': ['Page One'],
    'ساساكي': ['Sasaki'],
    'هوز هو': ['Who\'s Who'],
    'بلاك ماريا': ['Black Maria'],
    
    // Big Mom Pirates
    'كاتاكوري': ['Katakuri', 'Charlotte Katakuri'],
    'كريكر': ['Cracker', 'Charlotte Cracker'],
    'سموثي': ['Smoothie', 'Charlotte Smoothie'],
    'بيرين': ['Perrin', 'Charlotte Perrin'],
    'اوفين': ['Oven', 'Charlotte Oven'],
    'دايفوكو': ['Daifuku', 'Charlotte Daifuku'],
    
    // Revolutionary Army
    'دراغون': ['Dragon', 'Monkey D Dragon'],
    'سابو': ['Sabo'],
    'كوالا': ['Koala'],
    'ايفانكوف': ['Ivankov', 'Emporio Ivankov'],
    
    // Warlords
    'هانكوك': ['Hancock', 'Boa Hancock'],
    'جيمبي': ['Jinbe'],
    'مورا': ['Moria', 'Gecko Moria'],
    'كوما': ['Kuma', 'Bartholomew Kuma'],
    'لو': ['Law', 'Trafalgar Law'],
    'بوغي': ['Buggy'],
    'ويبل': ['Weevil', 'Edward Weevil'],
    
    // Supernovas
    'كيد': ['Kid', 'Eustass Kid'],
    'كيلر': ['Killer'],
    'هوكينز': ['Hawkins', 'Basil Hawkins'],
    'ابو': ['Apoo', 'Scratchmen Apoo'],
    'دريك': ['Drake', 'X Drake'],
    'اورج': ['Urogue'],
    'بونيه': ['Bonney', 'Jewelry Bonney'],
    'كابوني': ['Capone', 'Capone Bege'],
    
    // Other Notable Characters
    'رايلي': ['Rayleigh', 'Silvers Rayleigh'],
    'وايت بيرد': ['Whitebeard', 'Edward Newgate'],
    'مارك': ['Marco'],
    'جوز': ['Jozu'],
    'فيستا': ['Vista'],
    'اتش': ['Ace', 'Portgas D Ace'],
    'سينغوكو': ['Sengoku'],
    'غارب': ['Garp', 'Monkey D Garp'],
    'تسورو': ['Tsuru'],
    'سموكر': ['Smoker'],
    'تاشيغي': ['Tashigi'],
    'هينا': ['Hina'],
    'كوبي': ['Coby'],
    'هيلميبو': ['Helmeppo'],
    
    // Attack on Titan characters
    'ايرين': ['Eren', 'Eren Yeager', 'Eren Jaeger'],
    'ميكاسا': ['Mikasa', 'Mikasa Ackerman'],
    'ارمين': ['Armin', 'Armin Arlert'],
    'ليفي': ['Levi', 'Levi Ackerman'],
    'انيا': ['Annie', 'Annie Leonhart'],
    'ريينر': ['Reiner', 'Reiner Braun'],
    'بيرتولت': ['Bertholdt', 'Bertholdt Hoover'],
    'هيستوريا': ['Historia', 'Historia Reiss'],
    'يمير': ['Ymir'],
    'جان': ['Jean', 'Jean Kirstein'],
    'كوني': ['Connie', 'Connie Springer'],
    'ساشا': ['Sasha', 'Sasha Blouse'],
    
    // Death Note characters
    'لايت': ['Light', 'Light Yagami'],
    'ريوك': ['Ryuk'],
    'ميسا': ['Misa', 'Misa Amane'],
    'ال': ['L', 'L Lawliet'],
    'نير': ['Near'],
    'ميلو': ['Mello'],
    
    // My Hero Academia characters
    'ديكو': ['Deku', 'Izuku Midoriya'],
    'باكوغو': ['Bakugo', 'Katsuki Bakugo'],
    'اوراكا': ['Uraraka', 'Ochaco Uraraka'],
    'ايدا': ['Iida', 'Tenya Iida'],
    'تودوروكي': ['Todoroki', 'Shoto Todoroki'],
    'كيريشيما': ['Kirishima', 'Eijiro Kirishima'],
    'مومو': ['Momo', 'Momo Yaoyorozu'],
    'توكوياما': ['Tokoyami', 'Fumikage Tokoyami'],
    'اول مايت': ['All Might'],
    'ايرازر هيد': ['Eraser Head', 'Aizawa'],
    
    // Demon Slayer characters
    'تانجيرو': ['Tanjiro', 'Tanjiro Kamado'],
    'نيزوكو': ['Nezuko', 'Nezuko Kamado'],
    'زينيتسو': ['Zenitsu', 'Zenitsu Agatsuma'],
    'اينوسكي': ['Inosuke', 'Inosuke Hashibira'],
    'غيو': ['Giyu', 'Giyu Tomioka'],
    'جيو': ['Giyu', 'Giyu Tomioka'], // Alternative spelling
    'قيو': ['Giyu', 'Giyu Tomioka'], // Alternative spelling
    'رينغوكو': ['Rengoku', 'Kyojuro Rengoku'],
    'تينغين': ['Tengen', 'Tengen Uzui'],
    'ميتسوري': ['Mitsuri', 'Mitsuri Kanroji'],
    'اوباناي': ['Obanai', 'Obanai Iguro'],
    'سانيمي': ['Sanemi', 'Sanemi Shinazugawa'],
    'موتشيرو': ['Muichiro', 'Muichiro Tokito'],
    
    // One Punch Man characters
    'سايتاما': ['Saitama'],
    'جينوس': ['Genos'],
    'كينغ': ['King'],
    'تاتسوماكي': ['Tatsumaki'],
    'فوبوكي': ['Fubuki'],
    'بانغ': ['Bang'],
    'اتوميك ساموراي': ['Atomic Samurai'],
    
    // Jujutsu Kaisen characters
    'يوجي': ['Yuji', 'Yuji Itadori'],
    'ميغومي': ['Megumi', 'Megumi Fushiguro'],
    'نوبارا': ['Nobara', 'Nobara Kugisaki'],
    'غوجو': ['Gojo', 'Satoru Gojo'],
    'جوجو': ['Gojo', 'Satoru Gojo'], // Alternative spelling
    'قوجو': ['Gojo', 'Satoru Gojo'], // Alternative spelling
    'سوكونا': ['Sukuna', 'Ryomen Sukuna'],
    'ماكي': ['Maki', 'Maki Zenin'],
    'توغي': ['Toge', 'Toge Inumaki'],
    'باندا': ['Panda'],
    'يوتا': ['Yuta', 'Yuta Okkotsu'],
    
    // Bleach characters
    'ايتشيغو': ['Ichigo', 'Ichigo Kurosaki'],
    'روكيا': ['Rukia', 'Rukia Kuchiki'],
    'اورهيمي': ['Orihime', 'Orihime Inoue'],
    'تشاد': ['Chad', 'Yasutora Sado'],
    'ايشيدا': ['Ishida', 'Uryu Ishida'],
    'ايزن': ['Aizen', 'Sosuke Aizen'],
    'بياكويا': ['Byakuya', 'Byakuya Kuchiki'],
    'كينباتشي': ['Kenpachi', 'Kenpachi Zaraki'],
    
    // Hunter x Hunter characters
    'غون': ['Gon', 'Gon Freecss'],
    'جون': ['Gon', 'Gon Freecss'], // Alternative spelling
    'قون': ['Gon', 'Gon Freecss'], // Alternative spelling
    'كيلوا': ['Killua', 'Killua Zoldyck'],
    'كورابيكا': ['Kurapika'],
    'ليوريو': ['Leorio'],
    'هيسوكا': ['Hisoka'],
    'نيتيرو': ['Netero', 'Isaac Netero'],
    'ميرويم': ['Meruem'],
    'كرولو': ['Chrollo', 'Chrollo Lucilfer'],
    'فيتان': ['Feitan'],
    'ماتشي': ['Machi'],
    'شالنارك': ['Shalnark'],
    'نوبوناغا': ['Nobunaga'],
    
    // Tokyo Ghoul characters
    'كانيكي': ['Kaneki', 'Ken Kaneki'],
    'توكا': ['Touka', 'Touka Kirishima'],
    'ريزي': ['Rize', 'Rize Kamishiro'],
    'يوشيمورا': ['Yoshimura'],
    'جوزو': ['Juzo', 'Juzo Suzuya'],
    'امون': ['Amon', 'Koutarou Amon'],
    'ارايما': ['Arima', 'Kishou Arima'],
    
    // Fullmetal Alchemist characters
    'ادوارد': ['Edward', 'Edward Elric'],
    'الفونس': ['Alphonse', 'Alphonse Elric'],
    'روي': ['Roy', 'Roy Mustang'],
    'ريزا': ['Riza', 'Riza Hawkeye'],
    'وينري': ['Winry', 'Winry Rockbell'],
    'سكار': ['Scar'],
    'انفي': ['Envy'],
    'لست': ['Lust'],
    'غلوتوني': ['Gluttony'],
    'راث': ['Wrath'],
    'برايد': ['Pride'],
    'غريد': ['Greed'],
    'هوهنهايم': ['Hohenheim', 'Van Hohenheim'],
    
    // Code Geass characters
    'لولوش': ['Lelouch', 'Lelouch vi Britannia'],
    'سوزاكو': ['Suzaku', 'Suzaku Kururugi'],
    'سي سي': ['C.C.'],
    'كالين': ['Kallen', 'Kallen Kozuki'],
    'نانالي': ['Nunnally', 'Nunnally vi Britannia'],
    
    // Mob Psycho 100 characters
    'موب': ['Mob', 'Shigeo Kageyama'],
    'ريغين': ['Reigen', 'Arataka Reigen'],
    'ديمبل': ['Dimple'],
    'ريتسو': ['Ritsu', 'Ritsu Kageyama'],
    'تيرو': ['Teru', 'Teruki Hanazawa'],
    
    // Chainsaw Man characters
    'دينجي': ['Denji'],
    'باور': ['Power'],
    'اكي': ['Aki', 'Aki Hayakawa'],
    'ماكيما': ['Makima'],
    'كوبيني': ['Kobeni', 'Kobeni Higashiyama'],
    'انجيل': ['Angel', 'Angel Devil'],
    
    // Spy x Family characters
    'لويد': ['Loid', 'Loid Forger'],
    'يور': ['Yor', 'Yor Forger'],
    'انيا': ['Anya', 'Anya Forger'],
    'بوند': ['Bond'],
    'داميان': ['Damian', 'Damian Desmond'],
    'بيكي': ['Becky', 'Becky Blackbell']
  };

  // Add popular character nicknames and split names
  if (arabicToEnglish['غوجو'] === undefined) arabicToEnglish['غوجو'] = ['Gojo', 'Satoru Gojo', 'Satoru'];
  if (arabicToEnglish['ساتورو'] === undefined) arabicToEnglish['ساتورو'] = ['Satoru', 'Satoru Gojo', 'Gojo'];
  // Add more as needed for other popular characters

  const searchTerms = [];
  
  // Check direct mapping first
  if (arabicToEnglish[arabicName]) {
    searchTerms.push(...arabicToEnglish[arabicName]);
    // Add split names for each mapping
    for (const mapped of arabicToEnglish[arabicName]) {
      const parts = mapped.split(' ');
      if (parts.length > 1) {
        searchTerms.push(...parts);
      }
    }
  }
  
  // Check normalized mapping for fuzzy matching
  if (arabicToEnglish[normalizedName] && normalizedName !== arabicName) {
    searchTerms.push(...arabicToEnglish[normalizedName]);
    for (const mapped of arabicToEnglish[normalizedName]) {
      const parts = mapped.split(' ');
      if (parts.length > 1) {
        searchTerms.push(...parts);
      }
    }
  }
  
  // Check for partial matches in the mapping
  for (const [key, values] of Object.entries(arabicToEnglish)) {
    if (key !== arabicName && key !== normalizedName) {
      const similarity = calculateSimilarity(normalizedName, normalizeArabicName(key));
      if (similarity > 0.8) { // High similarity threshold for mapping matches
        searchTerms.push(...values);
      }
    }
  }
  
  // Also try the original Arabic name (in case it's transliterated)
  searchTerms.push(arabicName);
  
  // Try romanized version if possible
  const romanized = romanizeArabic(arabicName);
  if (romanized !== arabicName) {
    searchTerms.push(romanized);
  }
  
  // Remove duplicates
  return [...new Set(searchTerms)];
}

/**
 * Normalize Arabic name by treating similar letters as the same
 * @param {string} name - Arabic name
 * @returns {string} - Normalized name
 */
function normalizeArabicName(name) {
  return name
    .replace(/[جغق]/g, 'ج') // Treat ج, غ, ق as the same
    .replace(/[حخ]/g, 'ح') // Treat ح, خ as the same
    .replace(/[سش]/g, 'س') // Treat س, ش as the same
    .replace(/[صض]/g, 'ص') // Treat ص, ض as the same
    .replace(/[تث]/g, 'ت') // Treat ت, ث as the same
    .replace(/[دذ]/g, 'د') // Treat د, ذ as the same
    .replace(/[رز]/g, 'ر') // Treat ر, ز as the same
    .replace(/[طظ]/g, 'ط') // Treat ط, ظ as the same
    .replace(/[كق]/g, 'ك') // Treat ك, ق as the same
    .replace(/[يى]/g, 'ي') // Treat ي, ى as the same
    .replace(/[ةه]/g, 'ه') // Treat ة, ه as the same
    .toLowerCase();
}

/**
 * Basic Arabic to Latin romanization
 * @param {string} arabic - Arabic text
 * @returns {string} - Romanized text
 */
function romanizeArabic(arabic) {
  const arabicToLatin = {
    'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's',
    'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
    'ى': 'a', 'ة': 'a', 'ء': 'a'
  };
  
  return arabic.split('').map(char => arabicToLatin[char] || char).join('');
}

/**
 * Calculate string similarity using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Patch getEnglishSearchTerms to expose its mapping for typo suggestions
getEnglishSearchTerms.arabicToEnglish = undefined;
const _getEnglishSearchTerms = getEnglishSearchTerms;
getEnglishSearchTerms = function(...args) {
  if (!getEnglishSearchTerms.arabicToEnglish) {
    // Extract mapping from the function body
    const fnStr = _getEnglishSearchTerms.toString();
    const match = fnStr.match(/const arabicToEnglish = ([\s\S]*?);/);
    if (match) {
      // eslint-disable-next-line no-eval
      getEnglishSearchTerms.arabicToEnglish = eval('(' + match[1] + ')');
    }
  }
  return _getEnglishSearchTerms.apply(this, args);
};

// This plugin works as a global listener
handler.all = async function (m) {
  // Only process text messages
  if (!m.text) return;
  
  // Call the main handler
  return handler(m, { conn: this, text: m.text, isOwner: isOwner(m.sender) });
};

handler.help = ['at', 'aa'];
handler.tags = ['anime', 'owner'];
handler.command = /^(at|aa)$/i;
handler.owner = true;

export default handler;