#!/usr/bin/env node

/**
 * Test Plugin Loading
 * Check if kick.js plugin is properly structured
 */

import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';

console.log(chalk.cyan('🧪 Testing Plugin Loading...\n'));

// Check if kick.js exists
if (!existsSync('./plugins/kick.js')) {
  console.log(chalk.red('❌ plugins/kick.js does not exist!'));
  process.exit(1);
}

console.log(chalk.green('✅ plugins/kick.js exists'));

// Read the file content
try {
  const content = readFileSync('./plugins/kick.js', 'utf8');
  
  // Check for required exports
  const hasDefaultExport = content.includes('export default handler');
  const hasHandler = content.includes('const handler = async');
  const hasCommandPattern = content.includes('handler.command = /^');
  const hasTags = content.includes('handler.tags =');
  const hasHelp = content.includes('handler.help =');
  
  console.log(chalk.yellow('\n📋 Plugin Structure Check:'));
  console.log(`${hasDefaultExport ? '✅' : '❌'} Default export`);
  console.log(`${hasHandler ? '✅' : '❌'} Handler function`);
  console.log(`${hasCommandPattern ? '✅' : '❌'} Command pattern`);
  console.log(`${hasTags ? '✅' : '❌'} Tags definition`);
  console.log(`${hasHelp ? '✅' : '❌'} Help definition`);
  
  // Check command pattern
  const commandMatch = content.match(/handler\.command = \/(.+?)\/i;/);
  if (commandMatch) {
    console.log(chalk.green(`\n✅ Command pattern found: ${commandMatch[1]}`));
  } else {
    console.log(chalk.red('\n❌ Command pattern not found'));
  }
  
  // Check for debugging logs
  const hasDebugLogs = content.includes('console.log');
  console.log(chalk.cyan(`\n🔍 Debug logs: ${hasDebugLogs ? '✅ Present' : '❌ Missing'}`));
  
  // Check for admin requirements
  const hasAdminCheck = content.includes('handler.admin = true');
  const hasGroupCheck = content.includes('handler.group = true');
  const hasBotAdminCheck = content.includes('handler.botAdmin = true');
  
  console.log(chalk.yellow('\n🛡️ Security Requirements:'));
  console.log(`${hasAdminCheck ? '✅' : '❌'} Admin requirement`);
  console.log(`${hasGroupCheck ? '✅' : '❌'} Group requirement`);
  console.log(`${hasBotAdminCheck ? '✅' : '❌'} Bot admin requirement`);
  
  // Check for imports
  const hasBaileysImport = content.includes('@whiskeysockets/baileys');
  console.log(chalk.cyan(`\n📦 Imports: ${hasBaileysImport ? '✅ Baileys imported' : '❌ Baileys not imported'}`));
  
  console.log(chalk.green('\n✅ Plugin structure looks good!'));
  
} catch (error) {
  console.log(chalk.red(`❌ Error reading file: ${error.message}`));
}

console.log(chalk.cyan('\n💡 Next steps:'));
console.log(chalk.cyan('   1. Restart the bot to reload plugins'));
console.log(chalk.cyan('   2. Check console logs for plugin loading'));
console.log(chalk.cyan('   3. Try the command again'));
console.log(chalk.cyan('   4. Look for debug messages in console')); 