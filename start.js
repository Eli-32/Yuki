#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';

console.log(chalk.cyan('🚀 Starting WhatsApp Bot...'));

let restartCount = 0;
const maxRestarts = 5;

function startBot() {
  console.log(chalk.yellow(`📡 Attempt ${restartCount + 1}/${maxRestarts + 1}`));
  
  const bot = spawn('node', ['index.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  bot.on('close', (code) => {
    console.log(chalk.red(`❌ Bot process exited with code ${code}`));
    
    if (restartCount < maxRestarts) {
      restartCount++;
      console.log(chalk.yellow(`🔄 Restarting in 5 seconds...`));
      setTimeout(startBot, 5000);
    } else {
      console.log(chalk.red('🚫 Max restart attempts reached. Please check your configuration.'));
      process.exit(1);
    }
  });

  bot.on('error', (err) => {
    console.error(chalk.red('❌ Failed to start bot process:'), err);
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('⚠️ Shutting down...'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('⚠️ Shutting down...'));
  process.exit(0);
});

startBot(); 