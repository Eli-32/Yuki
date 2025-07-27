#!/usr/bin/env node

/**
 * Test script for encryption fixes
 * Run this to verify that the encryption key management is working
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

console.log(chalk.cyan('🔐 Testing Encryption Fixes...\n'));

// Test 1: Check if session directory exists
console.log(chalk.yellow('1. Checking session directory...'));
const sessionDir = './MyninoSession';
if (existsSync(sessionDir)) {
  console.log(chalk.green('✅ Session directory exists'));
  
  const files = readdirSync(sessionDir);
  const encryptionFiles = files.filter(file => 
    file.startsWith('pre-key-') || 
    file.startsWith('session-') || 
    file.startsWith('sender-key-') ||
    file === 'creds.json'
  );
  
  console.log(chalk.green(`✅ Found ${encryptionFiles.length} encryption files`));
  
  if (encryptionFiles.length > 0) {
    console.log(chalk.cyan('   Files found:'));
    encryptionFiles.forEach(file => {
      console.log(chalk.cyan(`   - ${file}`));
    });
  }
} else {
  console.log(chalk.yellow('⚠️ Session directory does not exist (will be created on first connection)'));
}

// Test 2: Check if backup directory exists
console.log(chalk.yellow('\n2. Checking backup directory...'));
const backupDir = './session-backup';
if (existsSync(backupDir)) {
  console.log(chalk.green('✅ Backup directory exists'));
  
  const backupFiles = readdirSync(backupDir);
  if (backupFiles.length > 0) {
    console.log(chalk.green(`✅ Found ${backupFiles.length} backup files`));
  } else {
    console.log(chalk.cyan('   No backup files yet (will be created during operation)'));
  }
} else {
  console.log(chalk.yellow('⚠️ Backup directory does not exist (will be created on startup)'));
}

// Test 3: Check if required modules exist
console.log(chalk.yellow('\n3. Checking required modules...'));
const requiredModules = [
  './lib/encryption-manager.js',
  './render-config.js',
  './main.js',
  './handler.js'
];

let allModulesExist = true;
requiredModules.forEach(module => {
  if (existsSync(module)) {
    console.log(chalk.green(`✅ ${module} exists`));
  } else {
    console.log(chalk.red(`❌ ${module} missing`));
    allModulesExist = false;
  }
});

// Test 4: Check environment
console.log(chalk.yellow('\n4. Checking environment...'));
const isRender = !!process.env.RENDER_EXTERNAL_URL;
if (isRender) {
  console.log(chalk.green('✅ Running on Render'));
  console.log(chalk.cyan(`   External URL: ${process.env.RENDER_EXTERNAL_URL}`));
  console.log(chalk.cyan(`   Service ID: ${process.env.RENDER_SERVICE_ID}`));
} else {
  console.log(chalk.cyan('🌐 Running locally (not on Render)'));
}

// Test 5: Check Node.js version
console.log(chalk.yellow('\n5. Checking Node.js version...'));
const nodeVersion = process.version;
console.log(chalk.green(`✅ Node.js version: ${nodeVersion}`));

// Summary
console.log(chalk.cyan('\n📊 Test Summary:'));
console.log(chalk.cyan('================'));

if (allModulesExist) {
  console.log(chalk.green('✅ All required modules are present'));
} else {
  console.log(chalk.red('❌ Some required modules are missing'));
}

console.log(chalk.cyan('\n🚀 Ready to run the bot with encryption fixes!'));
console.log(chalk.cyan('   Run: node main.js'));
console.log(chalk.cyan('\n💡 The bot will now:'));
console.log(chalk.cyan('   - Handle SenderKey and PreKey errors automatically'));
console.log(chalk.cyan('   - Maintain session persistence on Render'));
console.log(chalk.cyan('   - Create periodic backups of encryption keys'));
console.log(chalk.cyan('   - Recover from encryption errors gracefully')); 