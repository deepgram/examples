const { execSync } = require('child_process');

try {
  console.log('Running LiveKit Agent Node Test...');
  const output = execSync('node src/index.js', { encoding: 'utf-8' });
  console.log('Test Output:', output);
  process.exit(0);
} catch (error) {
  console.error('Test Failed:', error.message);
  process.exit(1);
}