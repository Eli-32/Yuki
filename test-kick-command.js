#!/usr/bin/env node

/**
 * Test Kick Command Pattern
 * Simple test to verify command recognition
 */

const commandPattern = /^(kick|طرد|دزمها|انقلع|بنعالي|bulkkick|طردجماعي|إخراججماعي)$/i;

console.log('🧪 Testing Kick Command Pattern...\n');

const testCommands = [
  '.kick',
  '.طرد',
  '.دزمها', 
  '.انقلع',
  '.بنعالي',
  '.bulkkick',
  '.طردجماعي',
  '.إخراججماعي',
  '.kick @user',
  '.طرد @user',
  '.بنعالي @17189257098',
  '.طرد @17189257098 عشانه حمار',
  'kick',
  'طرد',
  'بنعالي',
  'طردجماعي',
  'random text',
  '.menu',
  '.help'
];

testCommands.forEach(cmd => {
  // Remove the prefix if it exists
  const cleanCmd = cmd.startsWith('.') ? cmd.slice(1) : cmd;
  
  // Test if it matches the pattern
  const match = cleanCmd.match(commandPattern);
  
  if (match) {
    console.log(`✅ "${cmd}" -> MATCHES (${match[1]})`);
  } else {
    console.log(`❌ "${cmd}" -> NO MATCH`);
  }
});

console.log('\n📊 Pattern Analysis:');
console.log('==================');
console.log('✅ Commands that should match: .kick, .طرد, .دزمها, .انقلع, .بنعالي, .bulkkick, .طردجماعي, .إخراججماعي');
console.log('❌ Commands that should NOT match: random text, .menu, .help');
console.log('\n💡 If your command is not matching, check:');
console.log('   1. Command prefix (should start with .)');
console.log('   2. Command spelling');
console.log('   3. Handler registration in main.js');
console.log('   4. Plugin loading order'); 