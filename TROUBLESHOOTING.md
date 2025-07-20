# WhatsApp Bot Troubleshooting Guide

## Common Issues and Solutions

### 1. 401 Authentication Error
**Problem**: Bot gets disconnected with 401 error
**Solutions**:
- Clear session files: Delete the `MyninoSession` folder
- Scan QR code again
- Check if your phone number is banned
- Use the stable start script: `npm run start:stable`

### 2. SIGTERM Errors
**Problem**: Bot receives SIGTERM signals and restarts
**Solutions**:
- Use the stable start script: `npm run start:stable`
- Check system resources (CPU, memory)
- Ensure proper Node.js version (v16+)

### 3. Connection Issues
**Problem**: Bot can't connect to WhatsApp
**Solutions**:
- Check internet connection
- Clear session files and rescan QR
- Try different network (mobile data vs WiFi)
- Check if WhatsApp Web is working in browser

### 4. Session Management
**Problem**: Authentication keeps failing
**Solutions**:
- Delete `MyninoSession` folder completely
- Restart the bot
- Scan QR code with fresh session
- Check if multiple instances are running

## Quick Fix Commands

```bash
# Clear session and restart
rm -rf MyninoSession
npm run start:stable

# Check for multiple processes
tasklist | findstr node
# Kill all node processes (Windows)
taskkill /f /im node.exe

# Check Node.js version
node --version
```

## Recommended Startup

Use the stable start script for better reliability:
```bash
npm run start:stable
```

This script includes:
- Automatic restart on crashes
- Better error handling
- Graceful shutdown
- Session cleanup

## Environment Variables

Make sure these are set if needed:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
NODE_ENV=production
```

## Support

If issues persist:
1. Check the console output for specific error messages
2. Clear session files and try again
3. Update dependencies: `npm update`
4. Check for Node.js updates 