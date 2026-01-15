/**
 * Reset Test Data
 * Clears photos.json and faces.json for fresh testing
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const photosPath = path.join(dataDir, 'photos.json');
const facesPath = path.join(dataDir, 'faces.json');

// Backup existing data
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
if (fs.existsSync(photosPath)) {
    fs.copyFileSync(photosPath, path.join(dataDir, `photos.backup.${timestamp}.json`));
    console.log('✓ Backed up photos.json');
}
if (fs.existsSync(facesPath)) {
    fs.copyFileSync(facesPath, path.join(dataDir, `faces.backup.${timestamp}.json`));
    console.log('✓ Backed up faces.json');
}

// Reset to empty arrays
fs.writeFileSync(photosPath, '[]', 'utf8');
fs.writeFileSync(facesPath, '[]', 'utf8');

console.log('\n✅ Test data reset successfully!');
console.log('   photos.json: []');
console.log('   faces.json: []');
console.log('\nBackups created in data/ directory');
console.log('You can now test uploading photos with multiple faces.\n');
