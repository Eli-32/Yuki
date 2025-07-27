import { existsSync, readdirSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Encryption Key Manager for WhatsApp Bot
 * Handles SenderKey and PreKey management to prevent decryption errors
 */
class EncryptionManager {
  constructor(sessionDir = './MyninoSession') {
    this.sessionDir = sessionDir;
    this.keyCache = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Initialize encryption key management
   */
  async initialize() {
    try {
      // Ensure session directory exists
      if (!existsSync(this.sessionDir)) {
        console.log(chalk.yellow('⚠️ Session directory not found, encryption keys will be created on first connection'));
        return;
      }

      // Load existing encryption keys
      await this.loadEncryptionKeys();
      
      // Set up periodic cleanup
      setInterval(() => {
        this.cleanupOldKeys();
      }, this.cleanupInterval);

      console.log(chalk.green('✅ Encryption key manager initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Error initializing encryption manager:', error.message));
    }
  }

  /**
   * Load existing encryption keys from session files
   */
  async loadEncryptionKeys() {
    try {
      const files = readdirSync(this.sessionDir);
      
      for (const file of files) {
        if (file.startsWith('sender-key-') || file.startsWith('pre-key-') || file.startsWith('session-')) {
          const filePath = join(this.sessionDir, file);
          const stats = statSync(filePath);
          
          // Cache key metadata
          this.keyCache.set(file, {
            path: filePath,
            lastModified: stats.mtimeMs,
            size: stats.size
          });
        }
      }
      
      console.log(chalk.cyan(`📦 Loaded ${this.keyCache.size} encryption keys`));
    } catch (error) {
      console.error(chalk.red('❌ Error loading encryption keys:', error.message));
    }
  }

  /**
   * Handle SenderKey record issues
   */
  async handleSenderKeyIssue(jid, error) {
    try {
      console.log(chalk.yellow(`🔑 Handling SenderKey issue for ${jid}`));
      
      // Force session refresh for this JID
      if (global.forceSessionRefresh) {
        await global.forceSessionRefresh(jid);
      }
      
      // Clear any cached sender keys for this JID
      this.clearCachedKeys(jid, 'sender-key');
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error handling SenderKey issue for ${jid}:`, error.message));
      return false;
    }
  }

  /**
   * Handle PreKey ID issues
   */
  async handlePreKeyIssue(jid, error) {
    try {
      console.log(chalk.yellow(`🔑 Handling PreKey issue for ${jid}`));
      
      // Request fresh PreKey bundle
      if (global.conn && global.conn.requestPreKeyBundle) {
        await global.conn.requestPreKeyBundle(jid).catch(() => {});
      }
      
      // Clear any cached pre-keys for this JID
      this.clearCachedKeys(jid, 'pre-key');
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error handling PreKey issue for ${jid}:`, error.message));
      return false;
    }
  }

  /**
   * Clear cached keys for a specific JID and type
   */
  clearCachedKeys(jid, keyType) {
    try {
      const jidHash = this.hashJid(jid);
      
      for (const [filename, metadata] of this.keyCache.entries()) {
        if (filename.includes(keyType) && filename.includes(jidHash)) {
          this.keyCache.delete(filename);
          console.log(chalk.cyan(`🗑️ Cleared cached key: ${filename}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error clearing cached keys:', error.message));
    }
  }

  /**
   * Hash JID for consistent key naming
   */
  hashJid(jid) {
    let hash = 0;
    for (let i = 0; i < jid.length; i++) {
      const char = jid.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clean up old encryption keys
   */
  cleanupOldKeys() {
    try {
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      let cleanedCount = 0;

      for (const [filename, metadata] of this.keyCache.entries()) {
        if (now - metadata.lastModified > maxAge) {
          try {
            if (existsSync(metadata.path)) {
              unlinkSync(metadata.path);
              cleanedCount++;
            }
            this.keyCache.delete(filename);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(chalk.cyan(`🧹 Cleaned up ${cleanedCount} old encryption keys`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error during key cleanup:', error.message));
    }
  }

  /**
   * Get encryption key statistics
   */
  getKeyStats() {
    const stats = {
      total: this.keyCache.size,
      senderKeys: 0,
      preKeys: 0,
      sessions: 0
    };

    for (const filename of this.keyCache.keys()) {
      if (filename.startsWith('sender-key-')) stats.senderKeys++;
      else if (filename.startsWith('pre-key-')) stats.preKeys++;
      else if (filename.startsWith('session-')) stats.sessions++;
    }

    return stats;
  }

  /**
   * Log encryption key statistics
   */
  logKeyStats() {
    const stats = this.getKeyStats();
    console.log(chalk.cyan('📊 Encryption Key Statistics:'));
    console.log(chalk.cyan(`   Total Keys: ${stats.total}`));
    console.log(chalk.cyan(`   Sender Keys: ${stats.senderKeys}`));
    console.log(chalk.cyan(`   Pre Keys: ${stats.preKeys}`));
    console.log(chalk.cyan(`   Sessions: ${stats.sessions}`));
  }
}

// Create global instance
const encryptionManager = new EncryptionManager();

// Export for use in main.js
export default encryptionManager;

// Global error handler for encryption issues
export const handleEncryptionError = async (error, jid) => {
  if (!jid) return false;

  const errorMessage = error.message || error.toString();
  
  if (errorMessage.includes('No SenderKeyRecord found for decryption')) {
    return await encryptionManager.handleSenderKeyIssue(jid, error);
  }
  
  if (errorMessage.includes('Invalid PreKey ID')) {
    return await encryptionManager.handlePreKeyIssue(jid, error);
  }
  
  return false;
}; 