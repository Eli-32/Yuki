#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔧 Testing FFmpeg installation...');

// Test 1: Check if ffmpeg is available
console.log('\n1. Checking FFmpeg availability...');
const ffmpeg = spawn('ffmpeg', ['-version']);

ffmpeg.on('error', (error) => {
  console.log('❌ FFmpeg not found:', error.message);
  process.exit(1);
});

ffmpeg.on('close', (code) => {
  if (code === 0) {
    console.log('✅ FFmpeg is available');
    
    // Test 2: Create a simple test
    console.log('\n2. Testing FFmpeg conversion...');
    testConversion();
  } else {
    console.log('❌ FFmpeg test failed with code:', code);
    process.exit(1);
  }
});

async function testConversion() {
  try {
    // Create a simple test image
    const testDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testFile = path.join(testDir, 'test.webp');
    const outputFile = path.join(testDir, 'test.png');
    
    // Create a simple test webp file (just for testing)
    const testData = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'utf8');
    fs.writeFileSync(testFile, testData);
    
    console.log('Testing conversion from webp to png...');
    
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', testFile,
        '-vf', 'scale=512:512',
        outputFile
      ]);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg error:', error);
        reject(error);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ FFmpeg conversion test successful');
          resolve();
        } else {
          console.error('❌ FFmpeg conversion failed with code:', code);
          console.error('Error output:', stderr);
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });
    
    // Clean up
    try {
      fs.unlinkSync(testFile);
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    console.log('\n🎉 FFmpeg is working correctly!');
    
  } catch (error) {
    console.error('❌ FFmpeg test failed:', error.message);
    process.exit(1);
  }
} 