import {resolve, dirname as _dirname} from 'path';
import _fs, {existsSync, readFileSync} from 'fs';
const {promises: fs} = _fs;

class Database {
  /**
     * Create new Database
     * @param {String} filepath Path to specified json database
     * @param  {...any} args JSON.stringify arguments
     */
  constructor(filepath, ...args) {
    this.file = resolve(filepath);
    this.logger = console;

    this._load();

    this._jsonargs = args;
    this._state = false;
    this._queue = [];
    this._interval = setInterval(async () => {
      if (!this._state && this._queue && this._queue[0]) {
        this._state = true;
        await this[this._queue.shift()]().catch(this.logger.error);
        this._state = false;
      }
    }, 1000);
  }

  get data() {
    return this._data;
  }

  set data(value) {
    this._data = value;
    this.save();
  }

  /**
     * Queue Load
     */
  load() {
    this._queue.push('_load');
  }

  /**
     * Queue Save
     */
  save() {
    this._queue.push('_save');
  }

  _load() {
    try {
      return this._data = existsSync(this.file) ? JSON.parse(readFileSync(this.file)) : {};
    } catch (e) {
      this.logger.error(e);
      return this._data = {};
    }
  }

  async _save() {
    const dirname = _dirname(this.file);
    if (!existsSync(dirname)) await fs.mkdir(dirname, {recursive: true});
    await fs.writeFile(this.file, JSON.stringify(this._data, ...this._jsonargs));
    return this.file;
  }
}

/**
 * Decode JID to handle @lid and multi-device formats
 * @param {string} jid - The JID to decode
 * @param {object} conn - Baileys connection object (optional)
 * @returns {string} - Decoded JID in @s.whatsapp.net format
 */
async function decodeJid(jid, conn = null) {
  if (!jid) return jid;
  
  // If we have a connection object, use its decodeJid method
  if (conn && typeof conn.decodeJid === 'function') {
    try {
      return await conn.decodeJid(jid);
    } catch (error) {
      // console.log('Failed to decode JID with conn.decodeJid:', error.message);
    }
  }
  
  // Fallback: manual decoding
  // If JID ends with @lid, replace it with @s.whatsapp.net
  if (jid.endsWith('@lid')) {
    return jid.replace(/@lid$/, '@s.whatsapp.net');
  }
  
  // If JID has a device (e.g. user:12345@server), decode it
  if (/:\d+@/.test(jid)) {
    try {
      const { jidDecode } = require('@whiskeysockets/baileys');
      let decoded = jidDecode(jid) || {};
      return decoded.user && decoded.server
        ? `${decoded.user}@${decoded.server}`
        : jid;
    } catch (error) {
      // console.log('Failed to decode device JID:', error.message);
      return jid;
    }
  }
  
  // Otherwise leave JID as-is (should already be in standard form)
  return jid;
}

/**
 * JID Mapping System - Maps phone numbers to their @lid identifiers
 * This allows the bot to work with @lid JIDs directly without conversion
 */
class JidMapper {
  constructor() {
    this.numberToLid = new Map(); // phone number -> @lid JID
    this.lidToNumber = new Map(); // @lid JID -> phone number
    this.numberToJid = new Map(); // phone number -> @s.whatsapp.net JID
    this.jidToNumber = new Map(); // @s.whatsapp.net JID -> phone number
  }

  /**
   * Add a mapping between phone number and JID (either @lid or @s.whatsapp.net)
   */
  addMapping(phoneNumber, jid) {
    if (!phoneNumber || !jid) return;
    
    // Clean phone number (remove + and @s.whatsapp.net)
    const cleanNumber = phoneNumber.replace(/^\+/, '').replace(/@s\.whatsapp\.net$/, '');
    
    if (jid.endsWith('@lid')) {
      // @lid mapping
      this.numberToLid.set(cleanNumber, jid);
      this.lidToNumber.set(jid, cleanNumber);
    } else if (jid.endsWith('@s.whatsapp.net')) {
      // @s.whatsapp.net mapping
      this.numberToJid.set(cleanNumber, jid);
      this.jidToNumber.set(jid, cleanNumber);
    }
  }

  /**
   * Get @lid JID for a phone number
   */
  getLidByNumber(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/^\+/, '').replace(/@s\.whatsapp\.net$/, '');
    return this.numberToLid.get(cleanNumber);
  }

  /**
   * Get @s.whatsapp.net JID for a phone number
   */
  getJidByNumber(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/^\+/, '').replace(/@s\.whatsapp\.net$/, '');
    return this.numberToJid.get(cleanNumber);
  }

  /**
   * Get phone number for a @lid JID
   */
  getNumberByLid(lidJid) {
    return this.lidToNumber.get(lidJid);
  }

  /**
   * Get phone number for a @s.whatsapp.net JID
   */
  getNumberByJid(jid) {
    return this.jidToNumber.get(jid);
  }

  /**
   * Get any available JID (prefer @lid if available)
   */
  getAnyJid(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/^\+/, '').replace(/@s\.whatsapp\.net$/, '');
    return this.numberToLid.get(cleanNumber) || this.numberToJid.get(cleanNumber);
  }

  /**
   * Get phone number from any JID format
   */
  getNumberFromAnyJid(jid) {
    if (jid.endsWith('@lid')) {
      return this.getNumberByLid(jid);
    } else if (jid.endsWith('@s.whatsapp.net')) {
      return this.getNumberByJid(jid);
    }
    return null;
  }

  /**
   * Check if we have a mapping for this JID
   */
  hasMapping(jid) {
    if (jid.endsWith('@lid')) {
      return this.lidToNumber.has(jid);
    } else if (jid.endsWith('@s.whatsapp.net')) {
      return this.jidToNumber.has(jid);
    }
    return false;
  }

  /**
   * Get all mappings for debugging
   */
  getAllMappings() {
    return {
      numberToLid: Object.fromEntries(this.numberToLid),
      lidToNumber: Object.fromEntries(this.lidToNumber),
      numberToJid: Object.fromEntries(this.numberToJid),
      jidToNumber: Object.fromEntries(this.jidToNumber)
    };
  }

  /**
   * Clear all mappings
   */
  clear() {
    this.numberToLid.clear();
    this.lidToNumber.clear();
    this.numberToJid.clear();
    this.jidToNumber.clear();
  }
}

// Global JID mapper instance
global.jidMapper = new JidMapper();

export default Database;

