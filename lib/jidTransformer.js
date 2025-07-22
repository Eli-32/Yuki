import { jidDecode } from '@whiskeysockets/baileys';

/**
 * JID Transformer - Automatically converts numbers to @lid and stores mappings
 * This library handles the complex JID transformations that WhatsApp uses
 */
class JidTransformer {
  constructor() {
    this.numberToLid = new Map(); // phone number -> @lid JID
    this.lidToNumber = new Map(); // @lid JID -> phone number
    this.numberToJid = new Map(); // phone number -> @s.whatsapp.net JID
    this.jidToNumber = new Map(); // @s.whatsapp.net JID -> phone number
    this.contactCache = new Map(); // cached contact information
    this.groupParticipants = new Map(); // group -> participants mapping
  }

  /**
   * Transform a phone number to its @lid counterpart
   * This is the core function that "knows" how to convert numbers to @lid
   */
  async transformNumberToLid(phoneNumber, conn) {
    if (!phoneNumber || !conn) return null;
    
    // Clean the phone number
    const cleanNumber = this.cleanPhoneNumber(phoneNumber);
    
    // Check if we already have this mapping
    if (this.numberToLid.has(cleanNumber)) {
      return this.numberToLid.get(cleanNumber);
    }

    try {
      // Try to get the contact info from WhatsApp
      const contact = await this.getContactInfo(cleanNumber, conn);
      
      if (contact && contact.lid) {
        // We found a @lid for this number
        const lidJid = `${contact.lid}@lid`;
        this.addMapping(cleanNumber, lidJid);
        return lidJid;
      } else if (contact && contact.jid) {
        // We have the regular JID
        const regularJid = contact.jid;
        this.addMapping(cleanNumber, regularJid);
        return regularJid;
      }
      
      // If we can't get contact info, try to construct a possible @lid
      // This is a fallback method based on common patterns
      const possibleLid = await this.constructPossibleLid(cleanNumber, conn);
      if (possibleLid) {
        this.addMapping(cleanNumber, possibleLid);
        return possibleLid;
      }
      
    } catch (error) {
      // Silent error handling - no console logs
    }

    return null;
  }

  /**
   * Get contact information from WhatsApp
   */
  async getContactInfo(phoneNumber, conn) {
    try {
      // Try to get contact from the connection
      const contact = conn.contacts?.[`${phoneNumber}@s.whatsapp.net`] || 
                     conn.contacts?.[`${phoneNumber}@lid`];
      
      if (contact) {
        return contact;
      }

      // Try to fetch contact info if the method exists
      if (typeof conn.getContactInfo === 'function') {
        const jid = `${phoneNumber}@s.whatsapp.net`;
        const contactInfo = await conn.getContactInfo(jid).catch(() => null);
        
        if (contactInfo) {
          return contactInfo;
        }
      }

      // Check if we have this in our cache
      return this.contactCache.get(phoneNumber);
      
    } catch (error) {
      // Silent error handling - no console logs
      return null;
    }
  }

  /**
   * Construct a possible @lid based on patterns and group participants
   */
  async constructPossibleLid(phoneNumber, conn) {
    try {
      // Check all group participants we know about
      for (const [groupId, participants] of this.groupParticipants) {
        for (const participant of participants) {
          const decoded = jidDecode(participant.id);
          if (decoded && decoded.user === phoneNumber) {
            // Found a participant with this number
            this.addMapping(phoneNumber, participant.id);
            return participant.id;
          }
        }
      }

      // Try to find in current group if we're in one
      if (conn.chats) {
        for (const [chatId, chat] of Object.entries(conn.chats)) {
          if (chat.metadata && chat.metadata.participants) {
            for (const participant of chat.metadata.participants) {
              const decoded = jidDecode(participant.id);
              if (decoded && decoded.user === phoneNumber) {
                this.addMapping(phoneNumber, participant.id);
                return participant.id;
              }
            }
          }
        }
      }

    } catch (error) {
      // Silent error handling - no console logs
    }

    return null;
  }

  /**
   * Add a mapping to our storage
   */
  addMapping(phoneNumber, jid) {
    if (!phoneNumber || !jid) return;
    
    const cleanNumber = this.cleanPhoneNumber(phoneNumber);
    
    if (jid.endsWith('@lid')) {
      this.numberToLid.set(cleanNumber, jid);
      this.lidToNumber.set(jid, cleanNumber);
    } else if (jid.endsWith('@s.whatsapp.net')) {
      this.numberToJid.set(cleanNumber, jid);
      this.jidToNumber.set(jid, cleanNumber);
    }
  }

  /**
   * Get the best available JID for a phone number (prefer @lid)
   */
  getBestJid(phoneNumber) {
    const cleanNumber = this.cleanPhoneNumber(phoneNumber);
    
    // Prefer @lid if available
    const lidJid = this.numberToLid.get(cleanNumber);
    if (lidJid) {
      return lidJid;
    }
    
    // Fallback to regular JID
    const regularJid = this.numberToJid.get(cleanNumber);
    if (regularJid) {
      return regularJid;
    }
    
    return null;
  }

  /**
   * Get phone number from any JID format
   */
  getNumberFromJid(jid) {
    if (jid.endsWith('@lid')) {
      return this.lidToNumber.get(jid);
    } else if (jid.endsWith('@s.whatsapp.net')) {
      return this.jidToNumber.get(jid);
    }
    return null;
  }

  /**
   * Update group participants mapping
   */
  updateGroupParticipants(groupId, participants) {
    this.groupParticipants.set(groupId, participants);
    
    // Extract mappings from participants
    for (const participant of participants) {
      const decoded = jidDecode(participant.id);
      if (decoded && decoded.user) {
        this.addMapping(decoded.user, participant.id);
      }
    }
  }

  /**
   * Process a message and extract all JID mappings
   */
  processMessage(m, conn) {
    try {
      // Process sender
      if (m.sender) {
        const decoded = jidDecode(m.sender);
        if (decoded && decoded.user) {
          this.addMapping(decoded.user, m.sender);
        }
      }

      // Process participant (for group messages)
      if (m.participant) {
        const decoded = jidDecode(m.participant);
        if (decoded && decoded.user) {
          this.addMapping(decoded.user, m.participant);
        }
      }

      // Process mentioned users
      if (m.mentionedJid && m.mentionedJid.length > 0) {
        for (const mentionedJid of m.mentionedJid) {
          const decoded = jidDecode(mentionedJid);
          if (decoded && decoded.user) {
            this.addMapping(decoded.user, mentionedJid);
          }
        }
      }

      // Process quoted message sender
      if (m.quoted && m.quoted.sender) {
        const decoded = jidDecode(m.quoted.sender);
        if (decoded && decoded.user) {
          this.addMapping(decoded.user, m.quoted.sender);
        }
      }

    } catch (error) {
      // Silent error handling - no console logs
    }
  }

  /**
   * Transform a list of phone numbers to their JID counterparts
   */
  async transformNumbers(numbers, conn) {
    const results = [];
    
    for (const number of numbers) {
      const cleanNumber = this.cleanPhoneNumber(number);
      
      // First check if we already have a mapping
      let jid = this.getBestJid(cleanNumber);
      
      // If not, try to transform it
      if (!jid) {
        jid = await this.transformNumberToLid(cleanNumber, conn);
      }
      
      if (jid) {
        results.push({
          number: cleanNumber,
          jid: jid,
          type: jid.endsWith('@lid') ? 'lid' : 'regular'
        });
      } else {
        results.push({
          number: cleanNumber,
          jid: null,
          type: 'unknown'
        });
      }
    }
    
    return results;
  }

  /**
   * Clean phone number format - Let WhatsApp handle @lid transformation naturally
   */
  cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    
    // Simple cleaning - let WhatsApp handle the @lid transformation
    return phoneNumber.toString()
      .replace(/^\+/, '')
      .replace(/@s\.whatsapp\.net$/, '')
      .replace(/@lid$/, '')
      .replace(/[^0-9]/g, '');
  }

  /**
   * Get all mappings for debugging
   */
  getAllMappings() {
    return {
      numberToLid: Object.fromEntries(this.numberToLid),
      lidToNumber: Object.fromEntries(this.lidToNumber),
      numberToJid: Object.fromEntries(this.numberToJid),
      jidToNumber: Object.fromEntries(this.jidToNumber),
      groupParticipants: Object.fromEntries(this.groupParticipants),
      contactCache: Object.fromEntries(this.contactCache)
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
    this.contactCache.clear();
    this.groupParticipants.clear();
  }

  /**
   * Get statistics about mappings
   */
  getStats() {
    return {
      totalMappings: this.numberToLid.size + this.numberToJid.size,
      lidMappings: this.numberToLid.size,
      regularMappings: this.numberToJid.size,
      groupsTracked: this.groupParticipants.size,
      contactsCached: this.contactCache.size
    };
  }
}

// Create global instance
const jidTransformer = new JidTransformer();

export default jidTransformer; 