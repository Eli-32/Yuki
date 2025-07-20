// WhatsApp Admin Monitor Plugin
// Pure monitoring - watches for unauthorized admin changes and punishes them

const adminMonitor = {
    isActive: false,
    sock: null,
    eventHandler: null,
    stats: {
        totalViolations: 0,
        totalPunishments: 0,
        startTime: null
    }
};

// Initialize admin monitor when plugin loads
function initializeAdminMonitor(sock) {
    if (adminMonitor.sock) {
        console.log('Admin Monitor already initialized - skipping...');
        return;
    }
    

    adminMonitor.sock = sock;
    
    // Create the event handler function for admin changes
    adminMonitor.eventHandler = async (update) => {
        if (adminMonitor.isActive) {
            await monitorAdminChanges(sock, update);
        }
    };
}

async function monitorAdminChanges(sock, update) {
    try {
        console.log('Group participants update received:', update);
        
        const { id: groupId, participants, action, author } = update;
        
        // Only monitor promote/demote actions
        if (action !== 'promote' && action !== 'demote') return;
        
        // Skip if no author (WhatsApp system actions)
        if (!author) return;
        
        // Get group info
        const groupMetadata = await sock.groupMetadata(groupId);
        const botNumber = sock.user.id.replace(/:\d+/, '');
        const creator = groupMetadata.owner;
        const botCreator = '96176337375@s.whatsapp.net'; // Bot owner/creator
        
        // Check if action was done by authorized users
        const authorIsBot = author.includes(botNumber);
        const authorIsGroupCreator = author.includes(creator);
        const authorIsBotCreator = author.includes(botCreator);
        
        // If authorized, allow the action
        if (authorIsBot || authorIsGroupCreator || authorIsBotCreator) {
            return;
        }
        
        // Count the violation
        adminMonitor.stats.totalViolations++;
        
        // UNAUTHORIZED ACTION DETECTED - Execute punishment
        await punishUnauthorizedUser(sock, groupId, author, participants, action);
        
    } catch (error) {
        console.error('Error monitoring admin changes:', error);
    }
}

async function punishUnauthorizedUser(sock, groupId, perpetrator, affectedUsers, action) {
    try {
        console.log(`🚨 PUNISHING UNAUTHORIZED ${action.toUpperCase()} by ${perpetrator}`);
        
        // Send warning
        await sock.sendMessage(groupId, {
            text: `🚨 **SECURITY VIOLATION DETECTED** 🚨\n\n` +
                  `@${perpetrator.split('@')[0]} made unauthorized ${action} action!\n\n` +
                  `⚡ Executing punishment...`,
            mentions: [perpetrator]
        });
        
        // Small delay for dramatic effect
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Demote the perpetrator immediately
        await sock.groupParticipantsUpdate(groupId, [perpetrator], 'demote');
        console.log(`✅ Demoted perpetrator: ${perpetrator}`);
        adminMonitor.stats.totalPunishments++;
        
        // If they promoted someone, demote that person too
        if (action === 'promote') {
            for (const user of affectedUsers) {
                await sock.groupParticipantsUpdate(groupId, [user], 'demote');
                console.log(`✅ Reversed unauthorized promotion: ${user}`);
                adminMonitor.stats.totalPunishments++;
            }
            
            await sock.sendMessage(groupId, {
                text: `✅ **Justice Served!**\n\n` +
                      `• @${perpetrator.split('@')[0]} has been demoted\n` +
                      `• Unauthorized promotions reversed\n` +
                      `• Only group creator and bot can manage admins`,
                mentions: [perpetrator, ...affectedUsers]
            });
        } else {
            await sock.sendMessage(groupId, {
                text: `✅ **Perpetrator Punished!**\n\n` +
                      `@${perpetrator.split('@')[0]} has been demoted for unauthorized demote action!\n\n` +
                      `Only group creator and bot can manage admins.`,
                mentions: [perpetrator]
            });
        }
        
    } catch (error) {
        console.error('Error executing punishment:', error);
        await sock.sendMessage(groupId, {
            text: `❌ Security enforcement failed: ${error.message}`
        });
    }
}

// Simple function to check if a user is authorized
async function isAuthorizedAdmin(conn, groupId, userId) {
    try {
        const groupMetadata = await conn.groupMetadata(groupId);
        const botNumber = conn.user.id.replace(/:\d+/, '');
        const creator = groupMetadata.owner;
        const botCreator = '96176337375@s.whatsapp.net'; // Bot owner/creator
        
        // Check if user is:
        // 1. Group creator
        // 2. Bot itself
        // 3. Bot creator/owner
        const isGroupCreator = userId.includes(creator);
        const isBot = userId.includes(botNumber);
        const isBotCreator = userId.includes(botCreator);
        
        return isGroupCreator || isBot || isBotCreator;
    } catch (error) {
        console.error('Error checking authorization:', error);
        return false;
    }
}

// Control functions
function startProt() {
    if (adminMonitor.isActive) {
        console.log('⚠️  Admin Protection is already running!');
        return false;
    }
    
    if (!adminMonitor.sock) {
        console.log('❌ Socket not initialized. Call initialize() first.');
        return false;
    }
    
    // Add the event listener
    adminMonitor.sock.ev.on('group-participants.update', adminMonitor.eventHandler);
    adminMonitor.isActive = true;
    adminMonitor.stats.startTime = new Date();
    
    console.log('🟢 Admin Protection STARTED - Now watching for unauthorized admin changes');
    return true;
}

function stopProt() {
    if (!adminMonitor.isActive) {
        console.log('⚠️  Admin Protection is already stopped!');
        return false;
    }
    
    // Remove the event listener
    if (adminMonitor.sock && adminMonitor.eventHandler) {
        adminMonitor.sock.ev.off('group-participants.update', adminMonitor.eventHandler);
    }
    adminMonitor.isActive = false;
    
    console.log('🔴 Admin Protection STOPPED - No longer monitoring admin changes');
    return true;
}

function getProtStatus() {
    const uptime = adminMonitor.stats.startTime ? 
        Math.floor((new Date() - adminMonitor.stats.startTime) / 1000) : 0;
    
    return {
        status: adminMonitor.isActive ? '🟢 ACTIVE' : '🔴 STOPPED',
        isActive: adminMonitor.isActive,
        uptime: formatUptime(uptime),
        stats: {
            totalViolations: adminMonitor.stats.totalViolations,
            totalPunishments: adminMonitor.stats.totalPunishments,
            startTime: adminMonitor.stats.startTime
        }
    };
}

function resetStats() {
    adminMonitor.stats.totalViolations = 0;
    adminMonitor.stats.totalPunishments = 0;
    adminMonitor.stats.startTime = adminMonitor.isActive ? new Date() : null;
    console.log('📊 Statistics reset');
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

// Main handler function
const handler = async (m, { conn, command, text, args, usedPrefix }) => {
    
    try {
        // Initialize monitor if not already done
        if (!adminMonitor.sock && conn) {
            initializeAdminMonitor(conn);
        }
        
        const groupId = m.chat;
        const senderId = m.sender;
        
        // Only respond in groups
        if (!groupId || !groupId.includes('@g.us')) {
            return m.reply('❌ This command can only be used in groups!');
        }
        
        // Check if user is authorized to use protection commands
        const authorized = await isAuthorizedAdmin(conn, groupId, senderId);
        
        // Handle different commands
        switch(command.toLowerCase()) {
            case 'startprot':
            case 'start-prot':
                if (!authorized) {
                    return m.reply('❌ Only group creator, bot creator, and bot can control protection settings!');
                }
                
                const started = startProt();
                const startMsg = started ? 
                    '🟢 **Admin Protection STARTED**\n\nNow monitoring for unauthorized admin changes!' :
                    '⚠️ Admin Protection is already running!';
                return m.reply(startMsg);
                
            case 'stopprot':
            case 'stop-prot':
                if (!authorized) {
                    return m.reply('❌ Only group creator, bot creator, and bot can control protection settings!');
                }
                
                const stopped = stopProt();
                const stopMsg = stopped ? 
                    '🔴 **Admin Protection STOPPED**\n\nNo longer monitoring admin changes.' :
                    '⚠️ Admin Protection is already stopped!';
                return m.reply(stopMsg);
                
            case 'protstatus':
            case 'prot-status':
            case 'protectionstatus':
                if (!authorized) {
                    return m.reply('❌ Only group creator, bot creator, and bot can view protection status!');
                }
                
                const status = getProtStatus();
                const statusMsg = `📊 **Admin Protection Status**\n\n` +
                                `Status: ${status.status}\n` +
                                `Uptime: ${status.uptime}\n` +
                                `Violations Detected: ${status.stats.totalViolations}\n` +
                                `Punishments Executed: ${status.stats.totalPunishments}`;
                return m.reply(statusMsg);
                
            case 'resetstats':
            case 'reset-stats':
                if (!authorized) {
                    return m.reply('❌ Only group creator, bot creator, and bot can reset statistics!');
                }
                
                resetStats();
                const resetMsg = '📊 **Statistics Reset**\n\nAll violation and punishment counters have been reset to zero.';
                return m.reply(resetMsg);
                
            default:
                const helpMsg = `❓ Unknown command: ${command}\n\nAvailable commands:\n• ${usedPrefix}startprot\n• ${usedPrefix}stopprot\n• ${usedPrefix}protstatus\n• ${usedPrefix}resetstats`;
                return m.reply(helpMsg);
        }
        
    } catch (error) {
        console.error('Error in admin control handler:', error);
        console.error('Error stack:', error.stack);
        return m.reply(`❌ An error occurred while processing your request: ${error.message}`);
    }
};

// Initialize the monitor when the plugin loads
if (typeof global !== 'undefined' && global.conn && !global.adminMonitorInitialized) {

    initializeAdminMonitor(global.conn);
    global.adminMonitorInitialized = true;
}

// Plugin metadata
handler.help = ['startprot', 'stopprot', 'protstatus', 'resetstats'];
handler.tags = ['security']; // Removed 'admin' tag to prevent skipping
handler.command = /^(startprot|start-prot|stopprot|stop-prot|protstatus|prot-status|protectionstatus|resetstats|reset-stats)$/i;
handler.group = true; // Only works in groups
handler.admin = false; // We handle authorization manually
handler.botAdmin = false; // We handle this manually too

export default handler;