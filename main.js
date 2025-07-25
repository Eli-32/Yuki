import express from 'express';
const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
import './config.js';
import {createRequire} from 'module';
import path, {join} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {platform} from 'process';
import * as ws from 'ws';
import {readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch, stat} from 'fs';
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
}; global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
}; global.__require = function require(dir = import.meta.url) {
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

global.authFile = `MyninoSession`;
// Clean up old session files before starting
cleanupSession();
const {state, saveState, saveCreds} = await useMultiFileAuthState(global.authFile);
const msgRetryCounterMap = (MessageRetryMap) => { };
const {version} = await fetchLatestBaileysVersion();

const connectionOptions = {
  printQRInTerminal: true, // Enable QR code display
  patchMessageBeforeSending: (message) => {
    const requiresPatch = !!( message.buttonsMessage || message.templateMessage || message.listMessage );
    if (requiresPatch) {
      message = {viewOnceMessage: {message: {messageContextInfo: {deviceListMetadataVersion: 2, deviceListMetadata: {}}, ...message}}};
    }
    return message;
  },
  getMessage: async (key) => {
    if (store) {
      const msg = await store.loadMessage(key.remoteJid, key.id);
      return conn.chats[key.remoteJid] && conn.chats[key.remoteJid].messages[key.id] ? conn.chats[key.remoteJid].messages[key.id].message : undefined;
    }
    return proto.Message.fromObject({});
  },
  msgRetryCounterMap,
  logger: pino({level: 'silent'}),
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({level: 'silent'})),
  },
  // Simplified browser identification
  browser: ['Chrome (Linux)', '', ''],
  version,
  defaultQueryTimeoutMs: 60_000,
  // Remove problematic options
  syncFullHistory: false,
  markOnlineOnConnect: false,
  fireInitQueries: false,
  generateHighQualityLinkPreview: false,
  emitOwnEvents: false,
  // Add connection timeout
  connectTimeoutMs: 60_000,
  // Add retry options
  retryRequestDelayMs: 250,
  maxRetries: 5,
};

global.conn = makeWASocket(connectionOptions);
conn.isInit = false;
conn.well = false;
conn.logger.info(`Loading...\n`);

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write();
      if (opts['autocleartmp'] && (global.support || {}).find) {
        const tmp = [tmpdir(), 'tmp', 'jadibts'];
        tmp.forEach((filename) => spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']));
      }
    }, 60 * 1000); // Increased from 30s to 60s to reduce I/O operations
  }
}

if (opts['server']) (await import('./server.js')).default(global.conn, PORT);

function clearTmp() {
  const tmp = [tmpdir(), join(__dirname, './tmp')];
  const filename = [];
  tmp.forEach((dirname) => readdirSync(dirname).forEach((file) => filename.push(join(dirname, file))));
  return filename.map((file) => {
    const stats = statSync(file);
    if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) return unlinkSync(file); // 3 minutes
    return false;
  });
}

function purgeSession() {
let prekey = []
let directorio = readdirSync("./MyninoSession")
let filesFolderPreKeys = directorio.filter(file => {
return file.startsWith('pre-key-') /*|| file.startsWith('session-') || file.startsWith('sender-') || file.startsWith('app-') */
})
prekey = [...prekey, ...filesFolderPreKeys]
filesFolderPreKeys.forEach(files => {
unlinkSync(`./MyninoSession/${files}`)
})
}

function purgeSessionSB() {
try {
let listaDirectorios = readdirSync('./jadibts/');
let SBprekey = []
listaDirectorios.forEach(directorio => {
if (statSync(`./jadibts/${directorio}`).isDirectory()) {
let DSBPreKeys = readdirSync(`./jadibts/${directorio}`).filter(fileInDir => {
return fileInDir.startsWith('pre-key-') /*|| fileInDir.startsWith('app-') || fileInDir.startsWith('session-')*/
})
SBprekey = [...SBprekey, ...DSBPreKeys]
DSBPreKeys.forEach(fileInDir => {
unlinkSync(`./jadibts/${directorio}/${fileInDir}`)
})
}
})
if (SBprekey.length === 0) return;
} catch (err) {
console.log(chalk.bold.red(`=> Something went wrong during deletion, files not deleted`))
}}

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

// Add session cleanup function
function cleanupSession() {
  try {
    const sessionDir = './MyninoSession';
    if (existsSync(sessionDir)) {
      const files = readdirSync(sessionDir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = `${sessionDir}/${file}`;
          const stats = statSync(filePath);
          // Remove files older than 24 hours
          if (Date.now() - stats.mtimeMs > 24 * 60 * 60 * 1000) {
            unlinkSync(filePath);
            console.log(chalk.yellow(`🗑️ Cleaned up old session file: ${file}`));
          }
        }
      });
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️ Error cleaning session files:', error.message));
  }
}

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

  // === Robust reconnection logic ===
  let reconnectAttempts = global.reconnectAttempts || 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
    reconnectAttempts++;
    global.reconnectAttempts = reconnectAttempts;
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      console.log(chalk.red(`Connection error: ${code}. Attempting to reconnect (${reconnectAttempts})...`));
      setTimeout(async () => {
        await global.reloadHandler(true).catch(console.error);
        global.timestamp.connect = new Date();
      }, Math.min(30000, 2000 * reconnectAttempts)); // Exponential backoff, max 30s
    } else {
      console.log(chalk.red('Max reconnect attempts reached. Possible session corruption. Deleting session files and resetting...'));
      // Delete all session files to force re-authentication
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
      process.send('reset');
    }
    return;
  }
  // On successful connect, reset attempts and update startTime
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
  }

  let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

  if (connection === 'close') {
    console.log(chalk.red(`❌ Disconnected (${reason || 'unknown'}), attempting to reconnect...`));
    
    // Add delay before reconnecting to avoid rapid reconnection attempts
    setTimeout(() => {
      if (reason === DisconnectReason.loggedOut) {
        console.log(chalk.red('🚫 Logged out, please scan QR code again'));
        // Clear session files if logged out
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
      }
      process.send('reset');
    }, 3000);
  }
}

// Add process signal handlers to prevent unexpected termination
process.on('SIGTERM', () => {
  console.log(chalk.yellow('⚠️ Received SIGTERM, shutting down gracefully...'));
  if (global.conn) {
    global.conn.ws.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('⚠️ Received SIGINT, shutting down gracefully...'));
  if (global.conn) {
    global.conn.ws.close();
  }
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error(chalk.red('❌ Uncaught Exception:'), err);
  // Don't exit immediately, let the connection handler deal with it
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  // Don't exit immediately, let the connection handler deal with it
});

let isInit = true;
let handler = await import('./handler.js');
global.reloadHandler = async function(restatConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Object.keys(Handler || {}).length) handler = Handler;
  } catch (e) {
    console.error(e);
  }
  if (restatConn) {
    const oldChats = global.conn.chats;
    try {
      global.conn.ws.close();
    } catch { }
    conn.ev.removeAllListeners();
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

  const currentDateTime = new Date();
  const messageDateTime = new Date(conn.ev);
  if (currentDateTime >= messageDateTime) {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);
  } else {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);
  }

  conn.ev.on('messages.upsert', conn.handler);
  conn.ev.on('group-participants.update', conn.participantsUpdate);
  conn.ev.on('groups.update', conn.groupsUpdate);
  conn.ev.on('message.delete', conn.onDelete);
  conn.ev.on('call', conn.onCall);
  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);
  
  // Outgoing message logging is now handled in handler.js
  isInit = false;
  return true;
};

async function handleGroupParticipantUpdate(sock, update) {
    console.log('Group participant update:', JSON.stringify(update, null, 2));
    try {
        const { id, participants, action, author } = update;
        // Check if it's a group
        if (!id.endsWith('@g.us')) return;
        // Handle promotion events
        if (action === 'promote') {
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }
        // Handle demotion events
        if (action === 'demote') {
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }
        // ... you can add more group participant event handling here if needed ...
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
      conn.logger.error(e);
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

setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  const a = await clearTmp();
  console.log(chalk.cyanBright(`\nAUTOCLEARTMP\n\nFILES DELETED ✅\n\n`));
}, 180000);

setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  await purgeSession();
  console.log(chalk.cyanBright(`\nAUTOPURGESESSIONS\n\nFILES DELETED ✅\n\n`));
}, 1000 * 60 * 60);

setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  await purgeSessionSB();
  console.log(chalk.cyanBright(`\nAUTO_PURGE_SESSIONS_SUB-BOTS\n\nFILES DELETED ✅\n\n`));
}, 1000 * 60 * 60);

setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  await purgeOldFiles();
  console.log(chalk.cyanBright(`\nAUTO_PURGE_OLDFILES\n\nFILES DELETED ✅\n\n`));
}, 1000 * 60 * 60);

setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  // Update status less frequently to improve performance
  const bio = `Hey there! I am using WhatsApp.`;
  try {
    await conn.updateProfileStatus(bio);
  } catch (error) {
    // Silently handle errors to avoid spam
  }
}, 7200000); // Update every 2 hours instead of every hour

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return [d, ' day(s) ', h, ' hour(s) ', m, ' minute(s) ', s, ' second(s) '].map((v) => v.toString().padStart(2, '0')).join('');
}

_quickTest().catch(console.error);