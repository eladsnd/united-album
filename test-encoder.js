const { TextEncoder } = require('util');
console.log('Testing TextEncoder from util:');
try {
    const encoder = new TextEncoder();
    console.log('Success: TextEncoder instantiated');
} catch (e) {
    console.log('Error: TextEncoder failed', e.message);
}

console.log('Testing global.TextEncoder:');
if (typeof global.TextEncoder !== 'undefined') {
    try {
        const encoder = new global.TextEncoder();
        console.log('Success: global.TextEncoder instantiated');
    } catch (e) {
        console.log('Error: global.TextEncoder failed', e.message);
    }
} else {
    console.log('global.TextEncoder is undefined');
}
