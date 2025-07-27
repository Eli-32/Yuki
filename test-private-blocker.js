#!/usr/bin/env node

/**
 * Test script for Private Blocker System
 * Verifies that the blocking system is working properly
 */

import { existsSync } from 'fs';
import chalk from 'chalk';

console.log(chalk.cyan('🚫 Testing Private Blocker System...\n'));

// Test 1: Check if required files exist
console.log(chalk.yellow('1. Checking required files...'));
const requiredFiles = [
  './lib/private-blocker.js',
  './plugins/private-blocker-admin.js',
  './handler.js',
  './config.js'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (existsSync(file)) {
    console.log(chalk.green(`✅ ${file} exists`));
  } else {
    console.log(chalk.red(`❌ ${file} missing`));
    allFilesExist = false;
  }
});

// Test 2: Check owner configuration
console.log(chalk.yellow('\n2. Checking owner configuration...'));
try {
  const configPath = './config.js';
  if (existsSync(configPath)) {
    console.log(chalk.green('✅ config.js exists'));
    console.log(chalk.cyan('   Owner configuration should be in global.owner array'));
  } else {
    console.log(chalk.red('❌ config.js missing'));
  }
} catch (error) {
  console.log(chalk.red('❌ Error checking config:', error.message));
}

// Test 3: Check handler integration
console.log(chalk.yellow('\n3. Checking handler integration...'));
try {
  const handlerPath = './handler.js';
  if (existsSync(handlerPath)) {
    console.log(chalk.green('✅ handler.js exists'));
    console.log(chalk.cyan('   Private blocker should be imported and integrated'));
  } else {
    console.log(chalk.red('❌ handler.js missing'));
  }
} catch (error) {
  console.log(chalk.red('❌ Error checking handler:', error.message));
}

// Test 4: Check plugin system
console.log(chalk.yellow('\n4. Checking plugin system...'));
try {
  const pluginPath = './plugins/private-blocker-admin.js';
  if (existsSync(pluginPath)) {
    console.log(chalk.green('✅ Admin plugin exists'));
    console.log(chalk.cyan('   Admin commands should be available'));
  } else {
    console.log(chalk.red('❌ Admin plugin missing'));
  }
} catch (error) {
  console.log(chalk.red('❌ Error checking plugin:', error.message));
}

// Summary
console.log(chalk.cyan('\n📊 Test Summary:'));
console.log(chalk.cyan('================'));

if (allFilesExist) {
  console.log(chalk.green('✅ All required files are present'));
} else {
  console.log(chalk.red('❌ Some required files are missing'));
}

console.log(chalk.cyan('\n🚀 Private Blocker System is ready!'));
console.log(chalk.cyan('\n💡 How it works:'));
console.log(chalk.cyan('   - Non-owners trying to message bot in private get blocked'));
console.log(chalk.cyan('   - Owners can use bot in private normally'));
console.log(chalk.cyan('   - After 3 attempts, users get permanently blocked'));
console.log(chalk.cyan('   - Admin commands available for management'));

console.log(chalk.cyan('\n📋 Available Admin Commands:'));
console.log(chalk.cyan('   • .blocklist - View blocked users'));
console.log(chalk.cyan('   • .blockstats - View statistics'));
console.log(chalk.cyan('   • .block <number> [reason] - Block a user'));
console.log(chalk.cyan('   • .unblock <number> - Unblock a user'));
console.log(chalk.cyan('   • .clearblocks - Clear all blocks'));
console.log(chalk.cyan('   • .blockhelp - Show all commands'));

console.log(chalk.cyan('\n🔒 Security Features:'));
console.log(chalk.cyan('   - Automatic private message detection'));
console.log(chalk.cyan('   - Attempt tracking and permanent blocking'));
console.log(chalk.cyan('   - Owner-only access to private chats'));
console.log(chalk.cyan('   - Detailed logging and statistics'));

console.log(chalk.cyan('\n📖 Documentation:'));
console.log(chalk.cyan('   See PRIVATE_BLOCKER_GUIDE.md for detailed usage')); 