import express from 'express';
const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// Remove this problematic line that disables TLS verification
// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import './config.js';
import {createRequire} from 'module';
import path, {join} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {platform} from 'process';
import * as ws from 'ws';
import {readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch} from 'fs';
import yargs from 'yargs';
import {spawn} from 'child_process';
import lodash from 'lodash';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import {tmpdir} from 'os';
import {format} from 'util';
import pino from 'pino';
import {Boom} from '@hapi/boom';
import {makeWASocket, protoType, serialize} from './lib/simple.js';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import {mongoDB, mongoDBV2} from './lib/mongoDB.js';
import cloudDBAdapter from './lib/cloudDBAdapter.js';
import store from './lib/store.js';
import qrcode from 'qrcode-terminal';

// FIXED IMPORTS FOR COMMONJS MODULES
import promotePkg from './plugins/promote.cjs';
const { promoteCommand, handlePromotionEvent } = promotePkg;

import demotePkg from './plugins/demote.cjs';
const { demoteCommand, handleDemotionEvent } = demotePkg;

const {proto} = (await import('@whiskeysockets/baileys')).default;
const {DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore} = await import('@whiskeysockets/baileys');
const {CONNECTING} = ws;
const {chain} = lodash;

protoType();
serialize();

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; 

global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
}; 

global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? {[apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '');

global.timestamp = {start: new Date};
global.videoList = [];
global.videoListXXX = [];

const __dirname = global.__dirname(import.meta.url);

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[' + (opts['prefix'] || '*/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\\-.@aA').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']');

const defaultData = {
  users: {},
  chats: {},
  stats: {},
  msgs: {},
  sticker: {},
  settings: {}
};

global.db = new Low(
  /https?:\/\//.test(opts['db'] || '') 
    ? new cloudDBAdapter(opts['db']) 
    : new JSONFile(`${opts._[0] ? opts._[0] + '_' : ''}database.json`),
  defaultData
);

global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise((resolve) => setInterval(async function() {
      if (!global.db.READ) {
        clearInterval(this);
        resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
      }
    }, 1 * 1000));
  }
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read().catch(console.error);
  global.db.READ = null;
  global.db.data ||= {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
  };
  global.db.chain = chain(global.db.data);
};
loadDatabase();

const defaultChatGPTData = {
  sessions: {},
  users: {}
};

global.chatgpt = new Low(
  new JSONFile(path.join(__dirname, '/db/chatgpt.json')),
  defaultChatGPTData
);

global.loadChatgptDB = async function loadChatgptDB() {
  if (global.chatgpt.READ) {
    return new Promise((resolve) =>
      setInterval(async function() {
        if (!global.chatgpt.READ) {
          clearInterval(this);
          resolve( global.chatgpt.data === null ? global.loadChatgptDB() : global.chatgpt.data );
        }
      }, 1 * 1000));
  }
  if (global.chatgpt.data !== null) return;
  global.chatgpt.READ = true;
  await global.chatgpt.read().catch(console.error);
  global.chatgpt.READ = null;
  global.chatgpt.data = {
    users: {},
    ...(global.chatgpt.data || {}),
  };
  global.chatgpt.chain = lodash.chain(global.chatgpt.data);
};
loadChatgptDB();

// Add delay function for better connection handling
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.authFile = `MyninoSession`;

// Force clear everything and start fresh to avoid 405 errors
try {
  if (existsSync('./MyninoSession')) {
    rmSync('./MyninoSession', { recursive: true, force: true });
    console.log(chalk.yellow('🗑️ Cleared old session directory'));
  }
} catch (error) {
  console.log(chalk.yellow('⚠️ Could not clear session directory:', error.message));
}

// Wait a bit before creating new session
await delay(2000);

// Clean up old session files before starting
cleanupSession();

// Suppress MongoDB deprecation warnings
process.env.MONGODB_SILENCE_DEPRECATION_WARNINGS = '1';

let state, saveState, saveCreds;
try {
  const authState = await useMultiFileAuthState(global.authFile);
  state = authState.state;
  saveState = authState.saveState;
  saveCreds = authState.saveCreds;
} catch (error) {
  console.log(chalk.red('❌ Error loading auth state:', error.message));
  // Create a new session if loading fails
  const authState = await useMultiFileAuthState(global.authFile);
  state = authState.state;
  saveState = authState.saveState;
  saveCreds = authState.saveCreds;
}

const msgRetryCounterMap = MessageRetryMap ? new MessageRetryMap() : {};

let version;
try {
  const versionInfo = await fetchLatestBaileysVersion();
  version = versionInfo.version;
} catch (error) {
  console.log(chalk.yellow('⚠️ Could not fetch latest Baileys version, using default'));
  version = [2, 2413, 1];
}

const connectionOptions = {
  printQRInTerminal: true,
  patchMessageBeforeSending: (message) => {
    const requiresPatch = !!( message.buttonsMessage || message.templateMessage || message.listMessage );
    if (requiresPatch) {
      message = {viewOnceMessage: {message: {messageContextInfo: {deviceListMetadataVersion: 2, deviceListMetadata: {}}, ...message}}};
    }
    return message;
  },
  getMessage: async (key) => {
    if (store) {
      try {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      } catch (error) {
        return undefined;
      }
    }
    return proto.Message.fromObject({});
  },
  msgRetryCounterMap,
  logger: pino({level: 'fatal'}), // Changed from 'silent' to 'fatal'
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({level: 'fatal'})),
  },
  // Use WhatsApp Web browser signature (most important change)
  browser: ['WhatsApp Web', 'Chrome', '4.0.0'],
  version,
  // Disable problematic features causing 405
  syncFullHistory: false,
  markOnlineOnConnect: false,
  fireInitQueries: false,
  generateHighQualityLinkPreview: false,
  emitOwnEvents: false,
  receivedPendingNotifications: false,
  // Add mobile configuration
  mobile: false,
  // Add this critical fix for recent WhatsApp changes
  shouldSyncHistoryMessage: () => false,
  shouldIgnoreJid: () => false,
};

global.conn = makeWASocket(connectionOptions);
conn.isInit = false;
conn.well = false;
conn.logger.info(`Loading...\n`);

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write().catch(console.error);
      if (opts['autocleartmp'] && (global.support || {}).find) {
        const tmp = [tmpdir(), 'tmp', 'jadibts'];
        tmp.forEach((filename) => spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']));
      }
    }, 60 * 1000);
  }
}

if (opts['server']) (await import('./server.js')).default(global.conn, PORT);

function clearTmp() {
  const tmp = [tmpdir(), join(__dirname, './tmp')];
  const filename = [];
  tmp.forEach((dirname) => {
    try {
      readdirSync(dirname).forEach((file) => filename.push(join(dirname, file)));
    } catch (error) {
      // Directory might not exist, ignore error
    }
  });
  return filename.map((file) => {
    try {
      const stats = statSync(file);
      if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) {
        unlinkSync(file);
        return true;
      }
    } catch (error) {
      // File might not exist, ignore error
    }
    return false;
  });
}

function purgeSession() {
  try {
    let prekey = [];
    let directorio = readdirSync("./MyninoSession");
    let filesFolderPreKeys = directorio.filter(file => {
      return file.startsWith('pre-key-');
    });
    prekey = [...prekey, ...filesFolderPreKeys];
    filesFolderPreKeys.forEach(files => {
      try {
        unlinkSync(`./MyninoSession/${files}`);
      } catch (error) {
        console.log(chalk.yellow(`Could not delete ${files}:`, error.message));
      }
    });
  } catch (error) {
    console.log(chalk.yellow('Error in purgeSession:', error.message));
  }
}

function purgeSessionSB() {
  try {
    let listaDirectorios = readdirSync('./jadibts/');
    let SBprekey = [];
    listaDirectorios.forEach(directorio => {
      try {
        if (statSync(`./jadibts/${directorio}`).isDirectory()) {
          let DSBPreKeys = readdirSync(`./jadibts/${directorio}`).filter(fileInDir => {
            return fileInDir.startsWith('pre-key-');
          });
          SBprekey = [...SBprekey, ...DSBPreKeys];
          DSBPreKeys.forEach(fileInDir => {
            try {
              unlinkSync(`./jadibts/${directorio}/${fileInDir}`);
            } catch (error) {
              console.log(chalk.yellow(`Could not delete ${fileInDir}:`, error.message));
            }
          });
        }
      } catch (error) {
        console.log(chalk.yellow(`Error processing directory ${directorio}:`, error.message));
      }
    });
    if (SBprekey.length === 0) return;
  } catch (err) {
    console.log(chalk.bold.red(`=> Something went wrong during deletion, files not deleted`));
  }
}

function purgeOldFiles() {
  const directories = ['./MyninoSession/', './jadibts/'];
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  directories.forEach(dir => {
    try {
      if (!existsSync(dir)) return;
      const files = readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        try {
          const stats = statSync(filePath);
          if (stats.isFile() && stats.mtimeMs < oneHourAgo && file !== 'creds.json') {
            unlinkSync(filePath);
            console.log(chalk.bold.green(`File ${file} successfully deleted`));
          }
        } catch (err) {
          console.log(chalk.bold.red(`File ${file} not deleted: ${err.message}`));
        }
      });
    } catch (err) {
      console.log(chalk.bold.red(`Error accessing directory ${dir}: ${err.message}`));
    }
  });
}

function cleanupSession() {
  try {
    const sessionDir = './MyninoSession';
    if (existsSync(sessionDir)) {
      const files = readdirSync(sessionDir);
      files.forEach(file => {
        if (file.endsWith('.json') && file !== 'creds.json') {
          const filePath = `${sessionDir}/${file}`;
          try {
            const stats = statSync(filePath);
            // Remove files older than 24 hours
            if (Date.now() - stats.mtimeMs > 24 * 60 * 60 * 1000) {
              unlinkSync(filePath);
              console.log(chalk.yellow(`🗑️ Cleaned up old session file: ${file}`));
            }
          } catch (error) {
            console.log(chalk.yellow(`Could not process ${file}:`, error.message));
          }
        }
      });
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️ Error cleaning session files:', error.message));
  }
}

// Initialize reconnection attempts
global.reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin, qr } = update;
  global.stopped = connection;
  
  if (isNewLogin) conn.isInit = true;
  
  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

  // Handle QR Code Display
  if (qr) {
    console.log(chalk.yellow('📱 Scan this QR code with your WhatsApp app:'));
    qrcode.generate(qr, { small: true });
    return;
  }

  // Handle successful connection
  if (connection === 'open') {
    global.reconnectAttempts = 0;
    global.startTime = Date.now();
    console.log(chalk.green('✅ Successfully connected to WhatsApp'));
    console.log(chalk.cyan(`👤 Connected as: ${conn.user?.name || 'Unknown'}`));
    console.log(chalk.cyan(`📱 Phone: ${conn.user?.id || 'Unknown'}`));
    
    // Set status after successful connection
    setTimeout(async () => {
      try {
        await conn.updateProfileStatus('Hey there! I am using WhatsApp.');
        console.log(chalk.green('✅ Status updated successfully'));
      } catch (error) {
        console.log(chalk.yellow('⚠️ Could not update profile status:', error.message));
      }
    }, 5000);
    return;
  }

  // Handle disconnections
  if (connection === 'close') {
    let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    console.log(chalk.red(`❌ Disconnected (${reason || code || 'unknown'})`));
    
    // Handle specific error codes
    if (reason === 405) {
      console.log(chalk.red('🚫 HTTP 405 Error - WhatsApp may have blocked this connection'));
      console.log(chalk.yellow('💡 This should be fixed with the new connection settings'));
      console.log(chalk.yellow('💡 If it persists, try the following:'));
      console.log(chalk.yellow('   1. Wait 5-10 minutes before reconnecting'));
      console.log(chalk.yellow('   2. Clear session files and scan QR again'));
      console.log(chalk.yellow('   3. Use a different network/IP if possible'));
      
      // Clear session and wait before retry
      try {
        const sessionDir = './MyninoSession';
        if (existsSync(sessionDir)) {
          rmSync(sessionDir, { recursive: true, force: true });
          console.log(chalk.yellow(`🗑️ Completely cleared session directory`));
        }
      } catch (error) {
        console.log(chalk.yellow('⚠️ Could not clear session files:', error.message));
      }
      
      // Wait shorter for 405 errors with new settings (5 minutes)
      console.log(chalk.yellow('⏳ Waiting 5 minutes before retry...'));
      setTimeout(() => {
        console.log(chalk.yellow('🔄 Retrying connection...'));
        process.send?.('reset') || process.exit(1);
      }, 300000); // 5 minutes
      return;
    }
    
    // Handle logged out scenario
    if (reason === DisconnectReason.loggedOut) {
      console.log(chalk.red('🚫 Logged out, please scan QR code again'));
      try {
        const sessionDir = './MyninoSession';
        if (existsSync(sessionDir)) {
          readdirSync(sessionDir).forEach(file => {
            if (file.endsWith('.json')) {
              unlinkSync(`${sessionDir}/${file}`);
            }
          });
        }
      } catch (error) {
        console.log(chalk.yellow('⚠️ Could not clear session files:', error.message));
      }
      setTimeout(() => process.send?.('reset') || process.exit(1), 3000);
      return;
    }

    // Handle rate limiting (429) and other connection issues
    if (reason === 429 || reason === 503) {
      console.log(chalk.red('🚫 Rate limited or service unavailable'));
      console.log(chalk.yellow('⏳ Waiting 5 minutes before retry...'));
      setTimeout(() => {
        console.log(chalk.yellow('🔄 Retrying connection...'));
        process.send?.('reset') || process.exit(1);
      }, 300000); // 5 minutes
      return;
    }

    // Handle other disconnection reasons with reconnection logic
    if (code && code !== DisconnectReason.loggedOut && conn?.ws?.socket == null) {
      global.reconnectAttempts++;
      
      if (global.reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        console.log(chalk.red(`Connection error: ${code}. Attempting to reconnect (${global.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`));
        
        // More conservative backoff with new settings
        const delay = Math.min(60000, 3000 * Math.pow(1.5, global.reconnectAttempts - 1));
        console.log(chalk.yellow(`⏳ Waiting ${delay/1000} seconds before reconnection...`));
        
        setTimeout(async () => {
          try {
            await global.reloadHandler(true);
            global.timestamp.connect = new Date();
          } catch (error) {
            console.error(chalk.red('❌ Reconnection failed:', error.message));
          }
        }, delay);
      } else {
        console.log(chalk.red('❌ Max reconnect attempts reached. Restarting process...'));
        setTimeout(() => process.send?.('reset') || process.exit(1), 3000);
      }
      return;
    }

    // Default reconnection for other cases
    setTimeout(() => {
      console.log(chalk.yellow('🔄 Attempting to reconnect...'));
      process.send?.('reset') || process.exit(1);
    }, 5000); // Wait 5 seconds with new settings
  }
}

// Enhanced process signal handlers
process.on('SIGTERM', () => {
  console.log(chalk.yellow('⚠️ Received SIGTERM, shutting down gracefully...'));
  if (global.conn?.ws?.close) {
    global.conn.ws.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('⚠️ Received SIGINT, shutting down gracefully...'));
  if (global.conn?.ws?.close) {
    global.conn.ws.close();
  }
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error(chalk.red('❌ Uncaught Exception:'), err);
  // Give some time for cleanup before exiting
  setTimeout(() => process.exit(1), 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  // Don't exit immediately for unhandled rejections
});

let isInit = true;
let handler = await import('./handler.js');

global.reloadHandler = async function(restatConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Object.keys(Handler || {}).length) handler = Handler;
  } catch (e) {
    console.error('Error reloading handler:', e);
  }
  
  if (restatConn) {
    const oldChats = global.conn?.chats || {};
    try {
      if (global.conn?.ws?.close) {
        global.conn.ws.close();
      }
    } catch (error) {
      console.log(chalk.yellow('Error closing old connection:', error.message));
    }
    
    if (global.conn?.ev?.removeAllListeners) {
      conn.ev.removeAllListeners();
    }
    
    global.conn = makeWASocket(connectionOptions, {chats: oldChats});
    isInit = true;
  }
  
  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler);
    conn.ev.off('group-participants.update', conn.participantsUpdate);
    conn.ev.off('groups.update', conn.groupsUpdate);
    conn.ev.off('message.delete', conn.onDelete);
    conn.ev.off('call', conn.onCall);
    conn.ev.off('connection.update', conn.connectionUpdate);
    conn.ev.off('creds.update', conn.credsUpdate);
  }

  conn.handler = handler.handler.bind(global.conn);
  conn.participantsUpdate = handler.participantsUpdate.bind(global.conn);
  conn.groupsUpdate = handler.groupsUpdate.bind(global.conn);
  conn.onDelete = handler.deleteUpdate.bind(global.conn);
  conn.onCall = handler.callUpdate.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn, true);

  conn.ev.on('messages.upsert', conn.handler);
  conn.ev.on('group-participants.update', conn.participantsUpdate);
  conn.ev.on('groups.update', conn.groupsUpdate);
  conn.ev.on('message.delete', conn.onDelete);
  conn.ev.on('call', conn.onCall);
  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);
  
  isInit = false;
  return true;
};

async function handleGroupParticipantUpdate(sock, update) {
  console.log('Group participant update:', JSON.stringify(update, null, 2));
  try {
    const { id, participants, action, author } = update;
    if (!id.endsWith('@g.us')) return;
    
    if (action === 'promote') {
      await handlePromotionEvent(sock, id, participants, author);
      return;
    }
    
    if (action === 'demote') {
      await handleDemotionEvent(sock, id, participants, author);
      return;
    }
  } catch (err) {
    console.error('Error in handleGroupParticipantUpdate:', err);
  }
}

const pluginFolder = global.__dirname(join(__dirname, './plugins/index'));
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function filesInit() {
  for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      const file = global.__filename(join(pluginFolder, filename));
      const module = await import(file);
      global.plugins[filename] = module.default || module;
    } catch (e) {
      conn.logger.error('Error loading plugin:', filename, e);
      delete global.plugins[filename];
    }
  }
}

filesInit().then((_) => Object.keys(global.plugins)).catch(console.error);

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true);
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(` updated plugin - '${filename}'`);
      else {
        conn.logger.warn(`deleted plugin - '${filename}'`);
        return delete global.plugins[filename];
      }
    } else conn.logger.info(`new plugin - '${filename}'`);
    
    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    });
    
    if (err) conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`);
    else {
      try {
        const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
        global.plugins[filename] = module.default || module;
      } catch (e) {
        conn.logger.error(`error require plugin '${filename}\n${format(e)}'`);
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
      }
    }
  }
};

Object.freeze(global.reload);
watch(pluginFolder, global.reload);
await global.reloadHandler();

async function _quickTest() {
  const test = await Promise.all([
    spawn('ffmpeg'),
    spawn('ffprobe'),
    spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    spawn('convert'),
    spawn('magick'),
    spawn('gm'),
    spawn('find', ['--version']),
  ].map((p) => {
    return Promise.race([
      new Promise((resolve) => {
        p.on('close', (code) => {
          resolve(code !== 127);
        });
      }),
      new Promise((resolve) => {
        p.on('error', (_) => resolve(false));
      })]);
  }));
  
  const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;
  const s = global.support = {ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find};
  Object.freeze(global.support);
}

// Cleanup intervals with better error handling
setInterval(async () => {
  try {
    if (global.stopped === 'close' || !conn || !conn.user) return;
    const a = await clearTmp();
    console.log(chalk.cyanBright(`\nAUTOCLEARTMP\n\nFILES DELETED ✅\n\n`));
  } catch (error) {
    console.log(chalk.yellow('Error in clearTmp interval:', error.message));
  }
}, 180000);

setInterval(async () => {
  try {
    if (global.stopped === 'close' || !conn || !conn.user) return;
    await purgeSession();
    console.log(chalk.cyanBright(`\nAUTOPURGESESSIONS\n\nFILES DELETED ✅\n\n`));
  } catch (error) {
    console.log(chalk.yellow('Error in purgeSession interval:', error.message));
  }
}, 1000 * 60 * 60);

setInterval(async () => {
  try {
    if (global.stopped === 'close' || !conn || !conn.user) return;
    await purgeSessionSB();
    console.log(chalk.cyanBright(`\nAUTO_PURGE_SESSIONS_SUB-BOTS\n\nFILES DELETED ✅\n\n`));
  } catch (error) {
    console.log(chalk.yellow('Error in purgeSessionSB interval:', error.message));
  }
}, 1000 * 60 * 60);

setInterval(async () => {
  try {
    if (global.stopped === 'close' || !conn || !conn.user) return;
    await purgeOldFiles();
    console.log(chalk.cyanBright(`\nAUTO_PURGE_OLDFILES\n\nFILES DELETED ✅\n\n`));
  } catch (error) {
    console.log(chalk.yellow('Error in purgeOldFiles interval:', error.message));
  }
}, 1000 * 60 * 60);

setInterval(async () => {
  try {
    if (global.stopped === 'close' || !conn || !conn.user) return;
    const bio = `Hey there! I am using WhatsApp.`;
    await conn.updateProfileStatus(bio);
  } catch (error) {
    // Silently handle errors to avoid spam
  }
}, 7200000);

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return [d, ' day(s) ', h, ' hour(s) ', m, ' minute(s) ', s, ' second(s) '].map((v) => v.toString().padStart(2, '0')).join('');
}

_quickTest().catch(console.error);