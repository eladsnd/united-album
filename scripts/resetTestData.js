const fs = require('fs');
const path = require('path');

console.log('[Reset] Resetting all test data...');

// Keep photos.json but clear faces.json
const facesFile = path.join(process.cwd(), 'data', 'faces.json');
fs.writeFileSync(facesFile, JSON.stringify([], null, 2));

console.log('[Reset] ✓ Cleared faces.json');
console.log('[Reset] ✓ Photos.json unchanged');
console.log('');
console.log('Next steps:');
console.log('1. Delete all photos from the app');
console.log('2. Upload new photos - face numbering will start from person_1');
