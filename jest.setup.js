import '@testing-library/jest-dom';

// Robust next/image mock
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt, fill, ...props }) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={alt} style={fill ? { objectFit: 'cover' } : {}} />;
    },
}));

// Polyfill TextEncoder/TextDecoder for Jest environment as well
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
