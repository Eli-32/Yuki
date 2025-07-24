import axios from 'axios';
import { isOwner } from '../lib/owner-check.js';
import fs from 'fs';
import path from 'path';

// Anime character validation API endpoints (ordered by reliability)
const ANIME_APIS = [
  {
    name: 'Jikan',
    url: 'https://api.jikan.moe/v4/characters',
    searchParam: 'q',
    rateLimit: 1000, // 1 request per second
    reliability: 'high'
  },
  {
    name: 'AniList',
    url: 'https://graphql.anilist.co',
    type: 'graphql',
    rateLimit: 500, // 2 requests per second
    reliability: 'very_high'
  },
  {
    name: 'Kitsu',
    url: 'https://kitsu.io/api/edge/characters',
    searchParam: 'filter[name]',
    rateLimit: 2000, // 0.5 requests per second
    reliability: 'medium'
  }
];

// Cache for validated anime characters to avoid repeated API calls
const animeCharacterCache = new Map();
const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting for API requests
const apiRequestQueue = [];
const maxConcurrentRequests = 1; // Only 1 request at a time
const requestDelay = 2000; // 2 seconds between requests
let activeRequests = 0;
let lastRequestTime = 0;
const rateLimitBackoff = new Map(); // Track rate limit backoff per API

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

// Human-like behavior settings
const RESPONSE_DELAY_MIN = 2000; // 2 seconds
const RESPONSE_DELAY_MAX = 8000; // 8 seconds
const TYPING_MISTAKE_CHANCE = 0.15; // 15% chance of making a typing mistake
const CORRECTION_DELAY_MIN = 1000; // 1 second
const CORRECTION_DELAY_MAX = 3000; // 3 seconds

// Tournament host tracking (per chat)
const tournamentHosts = new Map();
const lastResponders = new Map();

// Blacklist of common Arabic words that should never be considered anime characters
const ARABIC_BLACKLIST = new Set([
  'كيفك', 'كيف', 'شلونك', 'شلون', 'اهلا', 'مرحبا', 'السلام', 'عليكم', 'وعليكم',
  'صباح', 'مساء', 'الخير', 'النور', 'تسلم', 'يسلمو', 'شكرا', 'مشكور', 'عفوا',
  'اسف', 'معذرة', 'لا', 'نعم', 'ايوة', 'طيب', 'زين', 'حلو', 'جميل', 'رائع',
  'ممتاز', 'بس', 'بعدين', 'الحين', 'توا', 'امس', 'اليوم', 'بكرا', 'غدا',
  'هاي', 'هلا', 'اهلين', 'حبيبي', 'حبيبتي', 'اخي', 'اختي', 'يا', 'ياخي',
  'والله', 'بالله', 'انشالله', 'ماشالله', 'الحمدلله', 'سبحان', 'استغفر',
  'تعال', 'تعالي', 'روح', 'روحي', 'ادخل', 'ادخلي', 'اطلع', 'اطلعي',
  'شوف', 'شوفي', 'اسمع', 'اسمعي', 'قول', 'قولي', 'اكتب', 'اكتبي',
  'ايش', 'شو', 'وين', 'متى', 'ليش', 'كيف', 'مين', 'منو', 'ايمتى',
  'هنا', 'هناك', 'هون', 'هونيك', 'جوا', 'برا', 'فوق', 'تحت', 'يمين', 'شمال'
]);

/**
 * Generate a random delay for human-like response timing
 * @returns {number} - Delay in milliseconds
 */
function getRandomResponseDelay() {
  return Math.floor(Math.random() * (RESPONSE_DELAY_MAX - RESPONSE_DELAY_MIN + 1)) + RESPONSE_DELAY_MIN;
}

/**
 * Generate adaptive delay based on number of recognized names
 * @param {number} nameCount - Number of recognized anime names
 * @returns {number} - Delay in milliseconds
 */
function getAdaptiveResponseDelay(nameCount) {
  let baseDelay, variationRange;
  
  switch (nameCount) {
    case 1:
      // Ultra fast for 1 name - instant recognition
      baseDelay = 200; // 0.2 seconds base
      variationRange = 100; // ±0.05 seconds (0.15-0.25 seconds total)
      break;
    case 2:
      // Very fast - quick thinking
      baseDelay = 300; // 0.3 seconds base
      variationRange = 100; // ±0.05 seconds (0.25-0.35 seconds total)
      break;
    case 3:
      // Fast - processing multiple characters
      baseDelay = 400; // 0.4 seconds base
      variationRange = 100; // ±0.05 seconds (0.35-0.45 seconds total)
      break;
    case 4:
      // Still fast - more characters
      baseDelay = 500; // 0.5 seconds base
      variationRange = 100; // ±0.05 seconds (0.45-0.55 seconds total)
      break;
    default:
      // Fast even for many names
      baseDelay = 600; // 0.6 seconds base
      variationRange = 100; // ±0.05 seconds (0.55-0.65 seconds total)
      break;
  }
  
  // Add random variation
  const variation = Math.floor(Math.random() * variationRange) - (variationRange / 2);
  const finalDelay = Math.max(150, baseDelay + variation); // Minimum 0.15 seconds
  
  return finalDelay;
}

/**
 * Create a typing mistake in a name
 * @param {string} name - Original name
 * @returns {string} - Name with potential typing mistake
 */
function createTypingMistake(name) {
  // Only make mistakes in longer names and with lower probability
  if (name.length < 4 || Math.random() > 0.4) {
    return name;
  }
  
  const mistakes = [
    // Missing letter (most common mistake)
    () => {
      if (name.length <= 4) return name;
      const pos = Math.floor(Math.random() * (name.length - 1)) + 1; // Don't remove first letter
      return name.slice(0, pos) + name.slice(pos + 1);
    },
    // Wrong letter (similar looking Arabic letters)
    () => {
      const substitutions = [
        ['ج', 'غ'], ['غ', 'ج'], ['ح', 'خ'], ['خ', 'ح'],
        ['س', 'ش'], ['ش', 'س'], ['ص', 'ض'], ['ض', 'ص'],
        ['ت', 'ث'], ['ث', 'ت'], ['د', 'ذ'], ['ذ', 'د'],
        ['ر', 'ز'], ['ز', 'ر'], ['ك', 'ق'], ['ق', 'ك'],
        ['ي', 'ى'], ['ى', 'ي'], ['ة', 'ه'], ['ه', 'ة']
      ];
      
      let result = name;
      for (const [from, to] of substitutions) {
        if (result.includes(from) && Math.random() < 0.5) {
          result = result.replace(from, to);
          break;
        }
      }
      return result;
    },
    // Double letter (less common)
    () => {
      const pos = Math.floor(Math.random() * (name.length - 1)) + 1; // Don't double first letter
      return name.slice(0, pos + 1) + name[pos] + name.slice(pos + 1);
    }
  ];
  
  // Weighted selection - missing letter is most common
  const weights = [0.6, 0.3, 0.1]; // 60% missing, 30% wrong letter, 10% double
  const random = Math.random();
  let selectedIndex = 0;
  let cumulativeWeight = 0;
  
  for (let i = 0; i < weights.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      selectedIndex = i;
      break;
    }
  }
  
  return mistakes[selectedIndex]();
}

/**
 * Send a message with potential typing mistake and correction
 * @param {Object} conn - Connection object
 * @param {string} chatId - Chat ID
 * @param {string} message - Message to send
 * @param {number} delay - Initial delay before sending
 */
async function sendHumanLikeMessage(conn, chatId, message, delay = 0) {
  setTimeout(async () => {
    // 25% chance of making a typing mistake (increased from 15%)
    const shouldMakeMistake = Math.random() < 0.25;
    
    if (shouldMakeMistake) {
      // Split message into words and potentially make mistake in one of them
      const words = message.split(' ');
      const mistakeWords = [];
      let mistakeIndex = -1;
      let originalWord = '';
      let mistakenWord = '';
      
      // Create mistakes and track which word was changed
      for (let i = 0; i < words.length; i++) {
        const originalWordText = words[i];
        const wordWithMistake = createTypingMistake(originalWordText);
        mistakeWords.push(wordWithMistake);
        
        // Track the first word that got changed
        if (wordWithMistake !== originalWordText && mistakeIndex === -1) {
          mistakeIndex = i;
          originalWord = originalWordText;
          mistakenWord = wordWithMistake;
        }
      }
      
      const mistakeMessage = mistakeWords.join(' ');
      
      if (mistakeMessage !== message && mistakeIndex !== -1) {
        // Send message with mistake first
        await conn.sendMessage(chatId, { text: mistakeMessage });
        
        // Then send correction after a delay (0.5-1.5 seconds) - faster corrections
        const correctionDelay = Math.floor(Math.random() * (1500 - 500 + 1)) + 500;
        setTimeout(async () => {
          await conn.sendMessage(chatId, { text: originalWord });
        }, correctionDelay);
        return;
      }
    }
    
    // Send normal message (no mistake or mistake function didn't change anything)
    await conn.sendMessage(chatId, { text: message });
  }, delay);
}

/**
 * Check if the sender is the tournament host for this chat
 * @param {string} chatId - Chat ID
 * @param {string} senderId - Sender ID
 * @returns {boolean} - True if sender is the host
 */
function isTournamentHost(chatId, senderId) {
  return tournamentHosts.get(chatId) === senderId;
}

/**
 * Set tournament host for a chat
 * @param {string} chatId - Chat ID
 * @param {string} hostId - Host ID
 */
function setTournamentHost(chatId, hostId) {
  tournamentHosts.set(chatId, hostId);
}

/**
 * Check if a word is an anime character name (synchronous version)
 * @param {string} word - Word to check
 * @returns {boolean} - True if recognized as anime character
 */
function checkAnimeCharacterSync(word) {
  const normalized = normalizeArabicName(word);
  
  // 0. Check blacklist first - never consider common Arabic words as anime characters
  if (ARABIC_BLACKLIST.has(word) || ARABIC_BLACKLIST.has(normalized)) {
    console.log(`🚫 Blacklisted word ignored: "${word}"`);
    return false;
  }
  
  // 1. Check learnedMappings (.json file) - exact match only
  if (learnedMappings.has(normalized)) {
    return true;
  }
  
  // 2. Check built-in mapping with improved fuzzy matching
  const builtInMapping = getEnglishSearchTerms.arabicToEnglish || {};
  
  // Direct match
  if (builtInMapping[word] || builtInMapping[normalized]) {
    return true;
  }
  
  // Enhanced fuzzy matching for similar names
  for (const [key, values] of Object.entries(builtInMapping)) {
    const similarity = calculateSimilarity(normalized, normalizeArabicName(key));
    // Lower threshold for better recognition, especially for popular characters
    const isPopularChar = values.some(v =>
      ['goku', 'naruto', 'luffy', 'gojo', 'eren', 'levi', 'tanjiro', 'nezuko', 'sasuke', 'itachi', 'sakura', 'sai', 'kizaru', 'midorima'].includes(v.toLowerCase())
    );
    const threshold = isPopularChar ? 0.65 : 0.75;
    
    if (similarity > threshold) {
      // Learn this variation for future use
      learnedMappings.set(normalized, { name: values[0] });
      setTimeout(() => saveLearnedMappings(), 100);
      return true;
    }
  }
  
  // 3. Try API validation for unrecognized names (async, don't wait for response)
  // Only for words that might be anime characters (not single letters)
  // Skip API validation if we're being rate limited
  if (word.length >= 3 && !isRateLimited()) {
    queueApiRequest(() => validateAnimeCharacter(word).then(result => {
      if (result) {
        console.log(`🎌 API validated: ${word} -> ${result.name}`);
      }
    }).catch(err => {
      // Silently handle API errors to avoid spam
    }));
  }
  
  return false;
}

/**
 * Check if a word is an anime character name (async version - kept for compatibility)
 * @param {string} word - Word to check
 * @returns {boolean} - True if recognized as anime character
 */
async function checkAnimeCharacter(word) {
  return checkAnimeCharacterSync(word);
}

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

  // Check if this is an owner command to toggle anime detection or set tournament host
  if (command === 'at' || command === 'aa' || command === 'sethost') {
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
    } else if (command === 'aa') {
      animeDetectionActive.set(chatId, false);
      return await conn.sendMessage(chatId, {
        text: '❌ تم إيقاف كاشف أسماء الأنمي.'
      });
    } else if (command === 'sethost') {
      // Set tournament host (reply to a message to set that person as host)
      if (m.quoted && m.quoted.sender) {
        setTournamentHost(chatId, m.quoted.sender);
        return await conn.sendMessage(chatId, {
          text: '✅ تم تعيين منظم البطولة.'
        });
      } else {
        return await conn.sendMessage(chatId, {
          text: '❌ يرجى الرد على رسالة الشخص المراد تعيينه كمنظم للبطولة.'
        });
      }
    }
  }

  // Check if anime detection is active for this chat OR if there's an active masabik challenge
  const masabikGameStates = getMasabikGameStates();
  const masabikActive = masabikGameStates[chatId]?.active || false;
  const masabikNames = masabikGameStates[chatId]?.currentNames || [];
  
  if (!animeDetectionActive.get(chatId) && !masabikActive) {
    return; // Do nothing if neither is active
  }

  // Tournament host validation will be handled in the text processing logic below

  // Store the last responder to avoid immediate responses
  lastResponders.set(chatId, m.sender);

  // Process text to find anime names
  const textToProcess = m.text || '';
  
  const recognizedNames = [];
  const processedWords = new Set(); // Avoid duplicates
  let wordsToCheck = [];
  
  // COMPREHENSIVE WhatsApp message structure analysis
  console.log(`🔍 === COMPLETE MESSAGE ANALYSIS ===`);
  console.log(`🔍 Message text: "${textToProcess}"`);
  console.log(`🔍 Message type: ${m.mtype}`);
  console.log(`🔍 Message keys: ${Object.keys(m)}`);
  
  // Deep dive into message object
  if (m.message) {
    console.log(`🔍 Message content keys: ${Object.keys(m.message)}`);
    console.log(`🔍 Full message object:`, JSON.stringify(m.message, null, 2));
    
    // Check for extended text message (where formatting might be)
    if (m.message.extendedTextMessage) {
      console.log(`🔍 Extended text message found`);
      console.log(`🔍 Extended keys: ${Object.keys(m.message.extendedTextMessage)}`);
      console.log(`🔍 Full extended message:`, JSON.stringify(m.message.extendedTextMessage, null, 2));
      
      if (m.message.extendedTextMessage.text) {
        console.log(`🔍 Extended text: "${m.message.extendedTextMessage.text}"`);
      }
      
      // Check for contextInfo which might contain formatting
      if (m.message.extendedTextMessage.contextInfo) {
        console.log(`🔍 Context info found:`, JSON.stringify(m.message.extendedTextMessage.contextInfo, null, 2));
      }
    }
    
    // Check for conversation message
    if (m.message.conversation) {
      console.log(`🔍 Conversation text: "${m.message.conversation}"`);
    }
    
    // Check for any other message types that might contain formatting
    Object.keys(m.message).forEach(key => {
      if (key !== 'extendedTextMessage' && key !== 'conversation') {
        console.log(`🔍 Other message type "${key}":`, JSON.stringify(m.message[key], null, 2));
      }
    });
  }
  
  // Check for any formatting indicators in the main message object
  if (m.contextInfo) {
    console.log(`🔍 Main context info:`, JSON.stringify(m.contextInfo, null, 2));
  }
  
  // Check for any other properties that might indicate formatting
  ['quoted', 'mentionedJid', 'groupMentions', 'isForwarded'].forEach(prop => {
    if (m[prop]) {
      console.log(`🔍 ${prop}:`, JSON.stringify(m[prop], null, 2));
    }
  });
  
  // Check for long conversational text - if message is too long and contains many non-anime words, skip
  const wordCount = textToProcess.split(/\s+/).length;
  const hasConversationalWords = /\b(كيف|ماذا|لماذا|متى|أين|من|هل|لكن|لأن|عندما|بعد|قبل|مع|في|على|إلى|من|عن|كان|كانت|يكون|تكون|هذا|هذه|ذلك|تلك|الذي|التي|اللذان|اللتان|اللذين|اللتين|اللواتي|اللاتي)\b/g.test(textToProcess);
  
  if (wordCount > 15 && hasConversationalWords) {
    console.log('🚫 Skipping long conversational text');
    return; // Skip responding to long conversational messages
  }

  // STRICT ITALIC TEXT DETECTION (single asterisks)
  let singleAsteriskMatches = [];
  let isItalicText = false;
  
  // Method 1: Check for literal single asterisks (for testing)
  const literalMatches = textToProcess.match(/\*([^*]+)\*/g) || [];
  if (literalMatches.length > 0) {
    singleAsteriskMatches = literalMatches;
    isItalicText = true;
    console.log('🔍 Found literal * asterisks');
  }
  
  // Method 2: Check if this is an extended text message (likely italic formatted)
  else if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.text) {
    // Extended text messages often contain formatting
    const extendedText = m.message.extendedTextMessage.text;
    console.log('🔍 Processing extended text message as italic formatted');
    singleAsteriskMatches = [`*${extendedText}*`]; // Simulate asterisk format
    isItalicText = true;
  }
  
  // Method 3: Check message type for formatting indicators
  else if (m.mtype === 'extendedTextMessage') {
    console.log('🔍 Extended text message type detected - treating as italic');
    singleAsteriskMatches = [`*${textToProcess}*`]; // Simulate asterisk format
    isItalicText = true;
  }
  
  console.log(`🔍 Italic text detected: ${isItalicText}`);
  console.log(`🔍 Matches to process: ${singleAsteriskMatches.length}`);
  
  // Check if user is tournament host (for logging purposes)
  const tournamentHost = tournamentHosts.get(chatId);
  const isFromTournamentHost = tournamentHost && m.sender === tournamentHost;
  
  // Tournament host system: When a host is set, ALL users can send anime names
  // The host just controls when the tournament is active via .at/.aa commands
  // No restriction on who can send anime names when tournament is active

  // STRICT ITALIC TEXT REQUIREMENT FOR ALL USERS
  if (isItalicText && singleAsteriskMatches.length > 0) {
    console.log('✅ Italic text detected - processing anime names');
    // Process text from italic formatted content ONLY
    for (const match of singleAsteriskMatches) {
      const matchContent = match.replace(/\*/g, '').trim(); // Remove * markers
      console.log(`🔍 Processing match content: "${matchContent}"`);
      const words = matchContent.split(/[\s\/\-\|،,]+/).filter(word =>
        word.length >= 3 && word.length <= 50 && /[\u0600-\u06FF]/.test(word) // Contains Arabic characters, min 3 chars
      );
      console.log(`🔍 Words extracted: ${JSON.stringify(words)}`);
      wordsToCheck.push(...words);
    }
    console.log(`🔍 Total words to check: ${JSON.stringify(wordsToCheck)}`);
  } else {
    // NO ITALIC TEXT = NO RESPONSE (strict requirement)
    console.log('🚫 No italic text detected, skipping anime detection');
    console.log('🚫 Only italic formatted text (from *text*) will be processed');
    return;
  }

  // Collect ALL names (both known and potential new ones)
  const allNames = [];
  const potentialNewNames = [];
  
  // Check each word synchronously (no await in loop)
  for (const word of wordsToCheck) {
    if (!processedWords.has(word)) {
      processedWords.add(word);
      const normalized = normalizeArabicName(word);
      
      // Check if it's already known (improved to check learned mappings more thoroughly)
      const isKnown = learnedMappings.has(normalized) ||
                     learnedMappings.has(word) ||
                     (getEnglishSearchTerms.arabicToEnglish &&
                      (getEnglishSearchTerms.arabicToEnglish[word] || getEnglishSearchTerms.arabicToEnglish[normalized])) ||
                     checkAnimeCharacterSync(word); // Use sync check which includes learned mappings
      
      if (isKnown) {
        allNames.push(word);
        console.log(`🔍 Recognized known anime name: "${word}"`);
      } else {
        // Add to potential new names for validation
        potentialNewNames.push(word);
      }
    }
  }

  // If we have potential new names, validate them first, then send ALL names together
  if (potentialNewNames.length > 0 && !isRateLimited()) {
    console.log(`🔍 Processing ${potentialNewNames.length} potential new character(s): ${potentialNewNames.join(', ')}`);
    
    // Validate all new names and collect the valid ones
    const validationPromises = potentialNewNames.map(word =>
      queueApiRequest(() => validateAnimeCharacter(word).then(result => {
        if (result) {
          console.log(`🎌 Discovered new character: ${word} -> ${result.name}`);
          
          // Find the correct Arabic spelling from the built-in database
          let correctArabicName = word; // Default to user input
          
          // Check if we can find the correct spelling in our built-in database
          if (getEnglishSearchTerms.arabicToEnglish) {
            const englishName = result.name.toLowerCase();
            for (const [arabicKey, englishValues] of Object.entries(getEnglishSearchTerms.arabicToEnglish)) {
              if (englishValues.some(val => val.toLowerCase().includes(englishName) || englishName.includes(val.toLowerCase()))) {
                correctArabicName = arabicKey;
                break;
              }
            }
          }
          
          allNames.push(correctArabicName);
          return correctArabicName;
        }
        return null;
      }).catch(err => {
        // Silently handle API errors
        return null;
      }))
    );

    // Wait for all validations to complete, then send ALL names together
    Promise.all(validationPromises).then(() => {
      if (allNames.length > 0) {
        const allNamesMessage = allNames.join(' ');
        console.log(`📤 Sending ALL names together: ${allNamesMessage}`);
        
        if (masabikActive) {
          // Use existing masabik delay for masabik game
          setTimeout(async () => {
            await sendHumanLikeMessage(conn, chatId, allNamesMessage);
          }, masabikBotDelay);
        } else {
          // Use adaptive delay based on total number of names
          const delay = getAdaptiveResponseDelay(allNames.length);
          console.log(`🕐 Adaptive delay for ${allNames.length} total name(s): ${delay}ms`);
          setTimeout(async () => {
            await sendHumanLikeMessage(conn, chatId, allNamesMessage, 0);
          }, delay);
        }
      }
    });
  } else if (allNames.length > 0) {
    // Only known names found, send immediately
    const allNamesMessage = allNames.join(' ');
    console.log(`📤 Sending known names only: ${allNamesMessage}`);
    
    if (masabikActive) {
      // Use existing masabik delay for masabik game
      setTimeout(async () => {
        await sendHumanLikeMessage(conn, chatId, allNamesMessage);
      }, masabikBotDelay);
    } else {
      // Use adaptive delay based on number of recognized names
      const delay = getAdaptiveResponseDelay(allNames.length);
      console.log(`🕐 Adaptive delay for ${allNames.length} known name(s): ${delay}ms`);
      await sendHumanLikeMessage(conn, chatId, allNamesMessage, delay);
    }
  }
};

/**
 * Check if we're currently rate limited
 * @returns {boolean} - True if rate limited
 */
function isRateLimited() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // Check if we have active rate limit backoff
  for (const [api, backoffUntil] of rateLimitBackoff.entries()) {
    if (now < backoffUntil) {
      return true;
    } else {
      rateLimitBackoff.delete(api); // Clear expired backoff
    }
  }
  
  // Check if we need to wait between requests
  return timeSinceLastRequest < requestDelay;
}

/**
 * Queue an API request to prevent rate limiting
 * @param {Function} requestFunction - The API request function to execute
 */
function queueApiRequest(requestFunction) {
  apiRequestQueue.push(requestFunction);
  processApiQueue();
}

/**
 * Process the API request queue with rate limiting
 */
async function processApiQueue() {
  if (activeRequests >= maxConcurrentRequests || apiRequestQueue.length === 0) {
    return;
  }
  
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // Check if we need to wait
  if (timeSinceLastRequest < requestDelay) {
    setTimeout(() => processApiQueue(), requestDelay - timeSinceLastRequest);
    return;
  }
  
  // Check for active rate limit backoff
  for (const [api, backoffUntil] of rateLimitBackoff.entries()) {
    if (now < backoffUntil) {
      setTimeout(() => processApiQueue(), backoffUntil - now);
      return;
    } else {
      rateLimitBackoff.delete(api); // Clear expired backoff
    }
  }
  
  const requestFunction = apiRequestQueue.shift();
  if (requestFunction) {
    activeRequests++;
    lastRequestTime = now;
    
    try {
      await requestFunction();
    } catch (error) {
      // Handle rate limiting errors
      if (error.response && error.response.status === 429) {
        console.log('🚫 API rate limited, backing off for 30 seconds');
        rateLimitBackoff.set('jikan', now + 30000); // 30 second backoff
      }
    } finally {
      activeRequests--;
      // Process next request after delay
      setTimeout(() => processApiQueue(), requestDelay);
    }
  }
}

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
              arabicName: name // Store the original Arabic input for reference
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
    
    // Handle rate limiting specifically
    if (error.response && error.response.status === 429) {
      console.log('🚫 API rate limited, backing off for 60 seconds');
      rateLimitBackoff.set('jikan', Date.now() + 60000); // 60 second backoff for 429 errors
    }
    
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
  
  // Massively expanded Arabic to English anime character name mappings
  const arabicToEnglish = {
    // Naruto Universe - Main Characters
    'ناروتو': ['Naruto', 'Naruto Uzumaki'], 'نارت': ['Naruto'], 'نارتو': ['Naruto'],
    'ساسكي': ['Sasuke', 'Sasuke Uchiha'], 'ساسك': ['Sasuke'], 'ساسوكي': ['Sasuke'],
    'ساكورا': ['Sakura', 'Sakura Haruno'], 'ساكرا': ['Sakura'], 'سكورا': ['Sakura'],
    'كاكاشي': ['Kakashi', 'Kakashi Hatake'], 'كاكاش': ['Kakashi'], 'كاكشي': ['Kakashi'],
    'ايتاشي': ['Itachi', 'Itachi Uchiha'], 'ايتاتشي': ['Itachi'], 'اتاشي': ['Itachi'],
    'مادارا': ['Madara', 'Madara Uchiha'], 'مدارا': ['Madara'], 'مادرا': ['Madara'],
    'هيناتا': ['Hinata', 'Hinata Hyuga'], 'هيناتة': ['Hinata'], 'هناتا': ['Hinata'],
    'نيجي': ['Neji', 'Neji Hyuga'], 'نيج': ['Neji'], 'نجي': ['Neji'],
    'غارا': ['Gaara'], 'جارا': ['Gaara'], 'قارا': ['Gaara'], 'غاارا': ['Gaara'],
    'اوروتشيمارو': ['Orochimaru'], 'اوروشيمارو': ['Orochimaru'], 'اورتشيمارو': ['Orochimaru'],
    'جيرايا': ['Jiraiya'], 'جرايا': ['Jiraiya'], 'جيراي': ['Jiraiya'],
    'تسونادي': ['Tsunade'], 'تسوناد': ['Tsunade'], 'تسونادة': ['Tsunade'],
    'شيكامارو': ['Shikamaru', 'Shikamaru Nara'], 'شيكمارو': ['Shikamaru'], 'شكامارو': ['Shikamaru'],
    'كيبا': ['Kiba', 'Kiba Inuzuka'], 'كيب': ['Kiba'], 'كبا': ['Kiba'],
    'شينو': ['Shino', 'Shino Aburame'], 'شين': ['Shino'], 'شنو': ['Shino'],
    'لي': ['Lee', 'Rock Lee'], 'روك لي': ['Rock Lee'], 'روكلي': ['Rock Lee'],
    'تين تين': ['Tenten'], 'تنتن': ['Tenten'], 'تين': ['Tenten'],
    'مينا': ['Minato', 'Minato Namikaze'], 'مينات': ['Minato'], 'مناتو': ['Minato'],
    'كوشينا': ['Kushina', 'Kushina Uzumaki'], 'كوشين': ['Kushina'], 'كشينا': ['Kushina'],
    'هاشيراما': ['Hashirama', 'Hashirama Senju'], 'هاشرما': ['Hashirama'], 'هشيراما': ['Hashirama'],
    'توبيراما': ['Tobirama', 'Tobirama Senju'], 'توبرما': ['Tobirama'], 'تبيراما': ['Tobirama'],
    'هيروزين': ['Hiruzen', 'Hiruzen Sarutobi'], 'هيروزن': ['Hiruzen'], 'هروزين': ['Hiruzen'],
    'دانزو': ['Danzo', 'Danzo Shimura'], 'دانز': ['Danzo'], 'دنزو': ['Danzo'],
    'شيسوي': ['Shisui', 'Shisui Uchiha'], 'شيسو': ['Shisui'], 'شسوي': ['Shisui'],
    'اوبيتو': ['Obito', 'Obito Uchiha'], 'اوبت': ['Obito'], 'ابيتو': ['Obito'],
    'رين': ['Rin', 'Rin Nohara'], 'رن': ['Rin'],
    'يامات': ['Yamato'], 'يامت': ['Yamato'], 'يماتو': ['Yamato'],
    'سي': ['Sai'], 'ساي': ['Sai'],
    'كارين': ['Karin'], 'كارن': ['Karin'], 'كرين': ['Karin'],
    'جوغو': ['Jugo'], 'جوج': ['Jugo'], 'جغو': ['Jugo'],
    'سوجيتسو': ['Suigetsu'], 'سوجتسو': ['Suigetsu'], 'سجيتسو': ['Suigetsu'],
    'كيلر بي': ['Killer Bee'], 'كيلربي': ['Killer Bee'], 'كلر بي': ['Killer Bee'],
    'ناغاتو': ['Nagato'], 'ناغت': ['Nagato'], 'نغاتو': ['Nagato'],
    'كونان': ['Konan'], 'كونن': ['Konan'], 'كنان': ['Konan'],
    'يحيى': ['Yahiko'], 'يحي': ['Yahiko'], 'ياهيكو': ['Yahiko'],
    'كيشيموتو': ['Kishimoto'], 'كيشموتو': ['Kishimoto'], 'كشيموتو': ['Kishimoto'],

    // Dragon Ball Universe
    'غوكو': ['Goku', 'Son Goku'], 'جوكو': ['Goku'], 'قوكو': ['Goku'], 'غوك': ['Goku'],
    'فيجيتا': ['Vegeta'], 'فيغيتا': ['Vegeta'], 'فجيتا': ['Vegeta'], 'فيجت': ['Vegeta'],
    'غوهان': ['Gohan', 'Son Gohan'], 'جوهان': ['Gohan'], 'قوهان': ['Gohan'], 'غوهن': ['Gohan'],
    'بيكولو': ['Piccolo'], 'بيكلو': ['Piccolo'], 'بكولو': ['Piccolo'], 'بيكل': ['Piccolo'],
    'فريزا': ['Frieza', 'Freeza'], 'فريزر': ['Frieza'], 'فرزا': ['Frieza'], 'فريز': ['Frieza'],
    'سيل': ['Cell'], 'سل': ['Cell'], 'سيلل': ['Cell'],
    'بو': ['Buu', 'Majin Buu'], 'بوو': ['Buu'], 'بووو': ['Buu'], 'ماجين بو': ['Majin Buu'],
    'ترانكس': ['Trunks'], 'ترنكس': ['Trunks'], 'ترانك': ['Trunks'], 'تركس': ['Trunks'],
    'غوتين': ['Goten', 'Son Goten'], 'جوتين': ['Goten'], 'قوتين': ['Goten'], 'غوتن': ['Goten'],
    'كريلين': ['Krillin'], 'كريلن': ['Krillin'], 'كرلين': ['Krillin'], 'كريل': ['Krillin'],
    'ياموتشا': ['Yamcha'], 'يامتشا': ['Yamcha'], 'ياموش': ['Yamcha'], 'يامشا': ['Yamcha'],
    'تين شين هان': ['Tien', 'Tien Shinhan'], 'تين شين': ['Tien'], 'تن شين هان': ['Tien'],
    'برولي': ['Broly'], 'بروللي': ['Broly'], 'برول': ['Broly'], 'بروي': ['Broly'],
    'جيرين': ['Jiren'], 'جايرين': ['Jiren'], 'جرين': ['Jiren'], 'جيرن': ['Jiren'],
    'هيت': ['Hit'], 'هت': ['Hit'], 'هيط': ['Hit'],
    'بيروس': ['Beerus'], 'بيرس': ['Beerus'], 'بروس': ['Beerus'], 'بير': ['Beerus'],
    'ويس': ['Whis'], 'وايس': ['Whis'], 'ويز': ['Whis'], 'وس': ['Whis'],
    'زينو': ['Zeno'], 'زينو ساما': ['Zeno'], 'زن': ['Zeno'],
    'غوكو بلاك': ['Goku Black'], 'جوكو بلاك': ['Goku Black'], 'قوكو بلاك': ['Goku Black'],
    'زاماسو': ['Zamasu'], 'زاماس': ['Zamasu'], 'زمسو': ['Zamasu'],
    'غوغيتا': ['Gogeta'], 'جوجيتا': ['Gogeta'], 'قوقيتا': ['Gogeta'],
    'فيجيتو': ['Vegito'], 'فيغيتو': ['Vegito'], 'فجيتو': ['Vegito'],

    // One Piece Universe - Straw Hat Pirates
    'لوفي': ['Luffy', 'Monkey D Luffy'], 'لافي': ['Luffy'], 'لوف': ['Luffy'],
    'زورو': ['Zoro', 'Roronoa Zoro'], 'زرو': ['Zoro'], 'زور': ['Zoro'],
    'نامي': ['Nami'], 'نام': ['Nami'], 'نمي': ['Nami'],
    'سانجي': ['Sanji'], 'سانج': ['Sanji'], 'سنجي': ['Sanji'],
    'تشوبر': ['Chopper', 'Tony Tony Chopper'], 'تشوبير': ['Chopper'], 'تشوب': ['Chopper'],
    'روبين': ['Robin', 'Nico Robin'], 'روبن': ['Robin'], 'ربين': ['Robin'],
    'فرانكي': ['Franky'], 'فرانك': ['Franky'], 'فرنكي': ['Franky'],
    'بروك': ['Brook'], 'برك': ['Brook'], 'بروك': ['Brook'],
    'اوسوب': ['Usopp'], 'اوسب': ['Usopp'], 'اسوب': ['Usopp'],
    'جينبي': ['Jinbe'], 'جيمبي': ['Jinbe'], 'جنبي': ['Jinbe'],

    // One Piece - Major Characters
    'ايس': ['Ace', 'Portgas D Ace'], 'ايز': ['Ace'], 'اس': ['Ace'],
    'شانكس': ['Shanks'], 'شانك': ['Shanks'], 'شنكس': ['Shanks'],
    'كايدو': ['Kaido'], 'كايد': ['Kaido'], 'كيدو': ['Kaido'],
    'بيغ مام': ['Big Mom'], 'بيج مام': ['Big Mom'], 'بغ مام': ['Big Mom'],
    'دوفلامينغو': ['Doflamingo'], 'دوفلامينجو': ['Doflamingo'], 'دوفلمينغو': ['Doflamingo'],
    'كروكودايل': ['Crocodile'], 'كروكودال': ['Crocodile'], 'كركودايل': ['Crocodile'],
    'ميهوك': ['Mihawk'], 'ميهاوك': ['Mihawk'], 'مهوك': ['Mihawk'],
    'لو': ['Law', 'Trafalgar Law'], 'لاو': ['Law'], 'ترافلغار لو': ['Trafalgar Law'],
    'كيد': ['Kid', 'Eustass Kid'], 'كيدد': ['Kid'], 'كد': ['Kid'],
    'كيلر': ['Killer'], 'كيلار': ['Killer'], 'كلر': ['Killer'],
    'هوكينز': ['Hawkins', 'Basil Hawkins'], 'هوكنز': ['Hawkins'], 'هكينز': ['Hawkins'],
    'ابو': ['Apoo', 'Scratchmen Apoo'], 'ابوو': ['Apoo'], 'اب': ['Apoo'],
    'دريك': ['Drake', 'X Drake'], 'دراك': ['Drake'], 'درك': ['Drake'],
    'اورج': ['Urogue'], 'اورغ': ['Urogue'], 'ارج': ['Urogue'],
    'بونيه': ['Bonney', 'Jewelry Bonney'], 'بوني': ['Bonney'], 'بنيه': ['Bonney'],
    'كابوني': ['Capone', 'Capone Bege'], 'كابون': ['Capone'], 'كبوني': ['Capone'],
    'كاتاكوري': ['Katakuri', 'Charlotte Katakuri'], 'كتاكوري': ['Katakuri'], 'كاتكوري': ['Katakuri'],
    'كريكر': ['Cracker', 'Charlotte Cracker'], 'كركر': ['Cracker'], 'كريكار': ['Cracker'],
    'سموثي': ['Smoothie', 'Charlotte Smoothie'], 'سموث': ['Smoothie'], 'سمثي': ['Smoothie'],
    'كينغ': ['King', 'Alber'], 'كنغ': ['King'], 'كيج': ['King'],
    'كوين': ['Queen'], 'كوين': ['Queen'], 'كين': ['Queen'],
    'جاك': ['Jack'], 'جك': ['Jack'], 'جاكك': ['Jack'],
    'ياماتو': ['Yamato'], 'يامات': ['Yamato'], 'يمتو': ['Yamato'],
    'كوزوكي اودين': ['Oden', 'Kozuki Oden'], 'اودين': ['Oden'], 'ادين': ['Oden'],
    'رايلي': ['Rayleigh', 'Silvers Rayleigh'], 'رايل': ['Rayleigh'], 'ريلي': ['Rayleigh'],
    'وايت بيرد': ['Whitebeard', 'Edward Newgate'], 'اللحية البيضاء': ['Whitebeard'], 'وايتبيرد': ['Whitebeard'],
    'مارك': ['Marco'], 'مارك': ['Marco'], 'مرك': ['Marco'],
    'غارب': ['Garp', 'Monkey D Garp'], 'جارب': ['Garp'], 'قارب': ['Garp'],
    'سينغوكو': ['Sengoku'], 'سنغوكو': ['Sengoku'], 'سيغوكو': ['Sengoku'],
    'كيزارو': ['Kizaru', 'Borsalino'], 'كيزر': ['Kizaru'], 'كزارو': ['Kizaru'],
    'اكاينو': ['Akainu', 'Sakazuki'], 'اكاين': ['Akainu'], 'اكينو': ['Akainu'],
    'اوكيجي': ['Aokiji', 'Kuzan'], 'اوكج': ['Aokiji'], 'اكيجي': ['Aokiji'],
    'فوجيتورا': ['Fujitora', 'Issho'], 'فوجتورا': ['Fujitora'], 'فجيتورا': ['Fujitora'],
    'ريوكوغيو': ['Ryokugyu', 'Aramaki'], 'ريوكغيو': ['Ryokugyu'], 'ريكوغيو': ['Ryokugyu'],

    // Attack on Titan Universe
    'ايرين': ['Eren', 'Eren Yeager', 'Eren Jaeger'], 'ايرن': ['Eren'], 'ارين': ['Eren'],
    'ميكاسا': ['Mikasa', 'Mikasa Ackerman'], 'مكاسا': ['Mikasa'], 'ميكسا': ['Mikasa'],
    'ارمين': ['Armin', 'Armin Arlert'], 'ارمن': ['Armin'], 'رمين': ['Armin'],
    'ليفي': ['Levi', 'Levi Ackerman'], 'ليفاي': ['Levi'], 'لفي': ['Levi'],
    'انيا': ['Annie', 'Annie Leonhart'], 'اني': ['Annie'], 'انا': ['Annie'],
    'ريينر': ['Reiner', 'Reiner Braun'], 'راينر': ['Reiner'], 'رينر': ['Reiner'],
    'بيرتولت': ['Bertholdt', 'Bertholdt Hoover'], 'برتولت': ['Bertholdt'], 'بيرتلت': ['Bertholdt'],
    'هيستوريا': ['Historia', 'Historia Reiss'], 'هستوريا': ['Historia'], 'هيسترا': ['Historia'],
    'يمير': ['Ymir'], 'يمر': ['Ymir'], 'امير': ['Ymir'],
    'جان': ['Jean', 'Jean Kirstein'], 'جن': ['Jean'], 'جين': ['Jean'],
    'كوني': ['Connie', 'Connie Springer'], 'كون': ['Connie'], 'كني': ['Connie'],
    'ساشا': ['Sasha', 'Sasha Blouse'], 'سشا': ['Sasha'], 'ساش': ['Sasha'],
    'ايرفين': ['Erwin', 'Erwin Smith'], 'ايرون': ['Erwin'], 'ارفين': ['Erwin'],
    'هانجي': ['Hange', 'Hange Zoe'], 'هانج': ['Hange'], 'هنجي': ['Hange'],

    // Jujutsu Kaisen Universe
    'يوجي': ['Yuji', 'Yuji Itadori'], 'يوج': ['Yuji'], 'يجي': ['Yuji'],
    'ميغومي': ['Megumi', 'Megumi Fushiguro'], 'ميغوم': ['Megumi'], 'مغومي': ['Megumi'],
    'نوبارا': ['Nobara', 'Nobara Kugisaki'], 'نوبر': ['Nobara'], 'نبارا': ['Nobara'],
    'غوجو': ['Gojo', 'Satoru Gojo'], 'جوجو': ['Gojo'], 'قوجو': ['Gojo'],
    'ساتورو': ['Satoru', 'Satoru Gojo'], 'ساتر': ['Satoru'], 'سترو': ['Satoru'],
    'سوكونا': ['Sukuna', 'Ryomen Sukuna'], 'سوكن': ['Sukuna'], 'سكونا': ['Sukuna'],
    'ماكي': ['Maki', 'Maki Zenin'], 'مك': ['Maki'], 'ماك': ['Maki'],
    'توغي': ['Toge', 'Toge Inumaki'], 'توغ': ['Toge'], 'تغي': ['Toge'],
    'باندا': ['Panda'], 'بند': ['Panda'], 'بندا': ['Panda'],
    'يوتا': ['Yuta', 'Yuta Okkotsu'], 'يوت': ['Yuta'], 'يتا': ['Yuta'],
    'غيتو': ['Geto', 'Suguru Geto'], 'جيتو': ['Geto'], 'قيتو': ['Geto'],
    'نانامي': ['Nanami', 'Kento Nanami'], 'نانم': ['Nanami'], 'ننامي': ['Nanami'],

    // Demon Slayer Universe
    'تانجيرو': ['Tanjiro', 'Tanjiro Kamado'], 'تانجر': ['Tanjiro'], 'تنجيرو': ['Tanjiro'],
    'نيزوكو': ['Nezuko', 'Nezuko Kamado'], 'نيزك': ['Nezuko'], 'نزوكو': ['Nezuko'],
    'زينيتسو': ['Zenitsu', 'Zenitsu Agatsuma'], 'زينتسو': ['Zenitsu'], 'زنيتسو': ['Zenitsu'],
    'اينوسكي': ['Inosuke', 'Inosuke Hashibira'], 'اينسكي': ['Inosuke'], 'انوسكي': ['Inosuke'],
    'غيو': ['Giyu', 'Giyu Tomioka'], 'جيو': ['Giyu'], 'قيو': ['Giyu'],
    'رينغوكو': ['Rengoku', 'Kyojuro Rengoku'], 'رنغوكو': ['Rengoku'], 'رينجوكو': ['Rengoku'],
    'تينغين': ['Tengen', 'Tengen Uzui'], 'تنغين': ['Tengen'], 'تينجين': ['Tengen'],
    'ميتسوري': ['Mitsuri', 'Mitsuri Kanroji'], 'متسوري': ['Mitsuri'], 'ميتسر': ['Mitsuri'],
    'اوباناي': ['Obanai', 'Obanai Iguro'], 'ابناي': ['Obanai'], 'اوبن': ['Obanai'],
    'سانيمي': ['Sanemi', 'Sanemi Shinazugawa'], 'سنيمي': ['Sanemi'], 'سانم': ['Sanemi'],
    'موتشيرو': ['Muichiro', 'Muichiro Tokito'], 'متشيرو': ['Muichiro'], 'موتشر': ['Muichiro'],
    'غيومي': ['Gyomei', 'Gyomei Himejima'], 'جيومي': ['Gyomei'], 'قيومي': ['Gyomei'],
    'موزان': ['Muzan', 'Muzan Kibutsuji'], 'مزان': ['Muzan'], 'موزن': ['Muzan'],
    'اكازا': ['Akaza'], 'اكز': ['Akaza'], 'اكزا': ['Akaza'],
    'دوما': ['Doma'], 'دم': ['Doma'], 'دوم': ['Doma'],
    'كوكوشيبو': ['Kokushibo'], 'كوكشيبو': ['Kokushibo'], 'ككوشيبو': ['Kokushibo'],

    // My Hero Academia Universe
    'ديكو': ['Deku', 'Izuku Midoriya'], 'دك': ['Deku'], 'ديك': ['Deku'],
    'ايزوكو': ['Izuku', 'Izuku Midoriya'], 'ايزك': ['Izuku'], 'ازوكو': ['Izuku'],
    'باكوغو': ['Bakugo', 'Katsuki Bakugo'], 'باكغو': ['Bakugo'], 'بكوغو': ['Bakugo'],
    'كاتسوكي': ['Katsuki', 'Katsuki Bakugo'], 'كتسوكي': ['Katsuki'], 'كاتسك': ['Katsuki'],
    'اوراكا': ['Uraraka', 'Ochaco Uraraka'], 'اوركا': ['Uraraka'], 'ارك': ['Uraraka'],
    'ايدا': ['Iida', 'Tenya Iida'], 'ايد': ['Iida'], 'ادا': ['Iida'],
    'تودوروكي': ['Todoroki', 'Shoto Todoroki'], 'تودرك': ['Todoroki'], 'تدوروكي': ['Todoroki'],
    'كيريشيما': ['Kirishima', 'Eijiro Kirishima'], 'كيرشيما': ['Kirishima'], 'كرشيما': ['Kirishima'],
    'مومو': ['Momo', 'Momo Yaoyorozu'], 'موم': ['Momo'], 'مم': ['Momo'],
    'توكوياما': ['Tokoyami', 'Fumikage Tokoyami'], 'توكيامي': ['Tokoyami'], 'تكوياما': ['Tokoyami'],
    'اول مايت': ['All Might'], 'اولمايت': ['All Might'], 'ال مايت': ['All Might'],
    'ايرازر هيد': ['Eraser Head', 'Aizawa'], 'ايرزر هيد': ['Eraser Head'], 'ايزاوا': ['Aizawa'],

    // Death Note Universe
    'لايت': ['Light', 'Light Yagami'], 'لايط': ['Light'], 'لت': ['Light'],
    'ياغامي': ['Yagami', 'Light Yagami'], 'ياغم': ['Yagami'], 'يغامي': ['Yagami'],
    'ريوك': ['Ryuk'], 'ريك': ['Ryuk'], 'روك': ['Ryuk'],
    'ميسا': ['Misa', 'Misa Amane'], 'مس': ['Misa'], 'ميس': ['Misa'],
    'ال': ['L', 'L Lawliet'], 'لولييت': ['L Lawliet'], 'لوليت': ['L Lawliet'],
    'نير': ['Near'], 'نر': ['Near'], 'نيار': ['Near'],
    'ميلو': ['Mello'], 'مل': ['Mello'], 'ملو': ['Mello'],

    // Bleach Universe
    'ايتشيغو': ['Ichigo', 'Ichigo Kurosaki'], 'ايتشغو': ['Ichigo'], 'اتشيغو': ['Ichigo'],
    'كوروساكي': ['Kurosaki', 'Ichigo Kurosaki'], 'كورسكي': ['Kurosaki'], 'كرساكي': ['Kurosaki'],
    'روكيا': ['Rukia', 'Rukia Kuchiki'], 'ركيا': ['Rukia'], 'روك': ['Rukia'],
    'اورهيمي': ['Orihime', 'Orihime Inoue'], 'اورهم': ['Orihime'], 'ارهيمي': ['Orihime'],
    'تشاد': ['Chad', 'Yasutora Sado'], 'تشد': ['Chad'], 'شاد': ['Chad'],
    'ايشيدا': ['Ishida', 'Uryu Ishida'], 'اشيدا': ['Ishida'], 'ايشد': ['Ishida'],
    'ايزن': ['Aizen', 'Sosuke Aizen'], 'ازن': ['Aizen'], 'ايزين': ['Aizen'],
    'بياكويا': ['Byakuya', 'Byakuya Kuchiki'], 'بياكي': ['Byakuya'], 'بكويا': ['Byakuya'],
    'كينباتشي': ['Kenpachi', 'Kenpachi Zaraki'], 'كنباتشي': ['Kenpachi'], 'كينبتشي': ['Kenpachi'],

    // Hunter x Hunter Universe
    'غون': ['Gon', 'Gon Freecss'], 'جون': ['Gon'], 'قون': ['Gon'],
    'كيلوا': ['Killua', 'Killua Zoldyck'], 'كلوا': ['Killua'], 'كيل': ['Killua'],
    'كورابيكا': ['Kurapika'], 'كربيكا': ['Kurapika'], 'كورابك': ['Kurapika'],
    'ليوريو': ['Leorio'], 'ليور': ['Leorio'], 'لوريو': ['Leorio'],
    'هيسوكا': ['Hisoka'], 'هسوكا': ['Hisoka'], 'هيسك': ['Hisoka'],
    'نيتيرو': ['Netero', 'Isaac Netero'], 'نتيرو': ['Netero'], 'نيتر': ['Netero'],
    'ميرويم': ['Meruem'], 'مرويم': ['Meruem'], 'ميرم': ['Meruem'],
    'كرولو': ['Chrollo', 'Chrollo Lucilfer'], 'كرل': ['Chrollo'], 'كرولل': ['Chrollo'],

    // One Punch Man Universe
    'سايتاما': ['Saitama'], 'سيتاما': ['Saitama'], 'ستاما': ['Saitama'],
    'جينوس': ['Genos'], 'جنوس': ['Genos'], 'جين': ['Genos'],
    'كينغ': ['King'], 'كنغ': ['King'], 'كيج': ['King'],
    'تاتسوماكي': ['Tatsumaki'], 'تتسوماكي': ['Tatsumaki'], 'تاتسمكي': ['Tatsumaki'],
    'فوبوكي': ['Fubuki'], 'فبوكي': ['Fubuki'], 'فوبك': ['Fubuki'],
    'بانغ': ['Bang'], 'بنغ': ['Bang'], 'بج': ['Bang'],

    // Tokyo Ghoul Universe
    'كانيكي': ['Kaneki', 'Ken Kaneki'], 'كنيكي': ['Kaneki'], 'كانك': ['Kaneki'],
    'توكا': ['Touka', 'Touka Kirishima'], 'تكا': ['Touka'], 'توك': ['Touka'],
    'ريزي': ['Rize', 'Rize Kamishiro'], 'رز': ['Rize'], 'ريز': ['Rize'],

    // Chainsaw Man Universe
    'دينجي': ['Denji'], 'دنجي': ['Denji'], 'دينج': ['Denji'],
    'باور': ['Power'], 'بور': ['Power'], 'باو': ['Power'],
    'اكي': ['Aki', 'Aki Hayakawa'], 'اك': ['Aki'], 'اكي': ['Aki'],
    'ماكيما': ['Makima'], 'مكيما': ['Makima'], 'ماكم': ['Makima'],

    // Spy x Family Universe
    'لويد': ['Loid', 'Loid Forger'], 'لود': ['Loid'], 'لوي': ['Loid'],
    'يور': ['Yor', 'Yor Forger'], 'ير': ['Yor'], 'يو': ['Yor'],
    'انيا': ['Anya', 'Anya Forger'], 'انا': ['Anya'], 'ان': ['Anya'],
    'بوند': ['Bond'], 'بند': ['Bond'], 'بو': ['Bond'],

    // Fullmetal Alchemist Universe
    'ادوارد': ['Edward', 'Edward Elric'], 'ادورد': ['Edward'], 'ادوار': ['Edward'],
    'الفونس': ['Alphonse', 'Alphonse Elric'], 'الفنس': ['Alphonse'], 'الفون': ['Alphonse'],
    'روي': ['Roy', 'Roy Mustang'], 'ري': ['Roy'], 'رو': ['Roy'],
    'مستانغ': ['Mustang', 'Roy Mustang'], 'مستنغ': ['Mustang'], 'مستج': ['Mustang'],

    // Code Geass Universe
    'لولوش': ['Lelouch', 'Lelouch vi Britannia'], 'لولش': ['Lelouch'], 'لوش': ['Lelouch'],
    'سوزاكو': ['Suzaku', 'Suzaku Kururugi'], 'سزاكو': ['Suzaku'], 'سوزك': ['Suzaku'],
    'سي سي': ['C.C.'], 'سيسي': ['C.C.'], 'سي': ['C.C.'],

    // Mob Psycho 100 Universe
    'موب': ['Mob', 'Shigeo Kageyama'], 'مب': ['Mob'], 'موو': ['Mob'],
    'ريغين': ['Reigen', 'Arataka Reigen'], 'ريغن': ['Reigen'], 'رغين': ['Reigen'],
    'ديمبل': ['Dimple'], 'دمبل': ['Dimple'], 'ديمب': ['Dimple']
  };
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
  
  // Enhanced partial matching with better similarity thresholds
  for (const [key, values] of Object.entries(arabicToEnglish)) {
    if (key !== arabicName && key !== normalizedName) {
      const similarity = calculateSimilarity(normalizedName, normalizeArabicName(key));
      // Lower threshold for better recognition of variations
      if (similarity > 0.7) {
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
  
  // Try smart romanization
  const smartRomanized = smartRomanizeArabic(arabicName);
  if (smartRomanized !== arabicName && smartRomanized !== romanized) {
    searchTerms.push(smartRomanized);
  }
  
  // Remove duplicates and filter out empty/short terms
  return [...new Set(searchTerms)].filter(term => term && term.length >= 2);
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

handler.help = ['at', 'aa', 'sethost'];
handler.tags = ['anime', 'owner'];
handler.command = /^(at|aa|sethost)$/i;
handler.owner = true;

export default handler;