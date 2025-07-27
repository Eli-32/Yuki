#!/usr/bin/env node

// Test command recognition patterns
const testCommands = [
  '.kick @user',
  '.طرد @user', 
  '.دزمها @user',
  '.انقلع @user',
  '.بنعالي @user',
  'kick @user',
  'طرد @user',
  'دزمها @user',
  'انقلع @user',
  'بنعالي @user'
];

// Simulate the prefix regex from main.js
const prefixRegex = new RegExp('^[' + ('*/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\\-.@aA').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']');

// Simulate the command regex from kick.js
const commandRegex = /^(kick|طرد|دزمها|انقلع|بنعالي)$/i;

console.log('🔍 Testing Command Recognition\n');
console.log('Prefix Regex:', prefixRegex);
console.log('Command Regex:', commandRegex);
console.log('');

testCommands.forEach(testCmd => {
  console.log(`Testing: "${testCmd}"`);
  
  // Test prefix matching
  const prefixMatch = testCmd.match(prefixRegex);
  console.log(`  Prefix match: ${prefixMatch ? prefixMatch[0] : 'NO MATCH'}`);
  
  if (prefixMatch) {
    // Remove prefix and get command
    const noPrefix = testCmd.replace(prefixMatch[0], '');
    const [command, ...args] = noPrefix.trim().split(' ').filter(v => v);
    
    console.log(`  Command after prefix removal: "${command}"`);
    console.log(`  Args: [${args.join(', ')}]`);
    
    // Test command matching
    const commandMatch = commandRegex.test(command);
    console.log(`  Command match: ${commandMatch ? 'YES' : 'NO'}`);
    
    if (commandMatch) {
      console.log(`  ✅ FULL MATCH - This command should work!`);
    } else {
      console.log(`  ❌ Command not recognized`);
    }
  } else {
    console.log(`  ❌ No prefix match`);
  }
  
  console.log('');
});

// Test specific patterns that might be causing issues
console.log('🔍 Testing Specific Patterns:');
console.log('============================');

const specificTests = [
  { input: '.kick', expected: true },
  { input: '.طرد', expected: true },
  { input: '.دزمها', expected: true },
  { input: '.انقلع', expected: true },
  { input: '.بنعالي', expected: true },
  { input: 'kick', expected: false }, // No prefix
  { input: 'طرد', expected: false }, // No prefix
  { input: '.kick @user', expected: true },
  { input: '.طرد @user', expected: true }
];

specificTests.forEach(test => {
  const prefixMatch = test.input.match(prefixRegex);
  let result = false;
  
  if (prefixMatch) {
    const noPrefix = test.input.replace(prefixMatch[0], '');
    const [command] = noPrefix.trim().split(' ').filter(v => v);
    result = commandRegex.test(command);
  }
  
  const status = result === test.expected ? '✅' : '❌';
  console.log(`${status} "${test.input}" -> ${result} (expected: ${test.expected})`);
});

console.log('\n🎯 Conclusion:');
console.log('==============');
console.log('If commands are not working, possible issues:');
console.log('1. Bot needs restart to load new plugin');
console.log('2. Plugin file has syntax errors');
console.log('3. Handler system not recognizing the plugin');
console.log('4. Prefix/command regex mismatch');
console.log('5. Plugin requirements not met (admin, group, etc.)'); 