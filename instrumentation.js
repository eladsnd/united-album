/**
 * Next.js Instrumentation
 * This file runs once when the Next.js server starts
 * Perfect for environment validation
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { validateEnvironment } = await import('./lib/validateEnv.js');

        try {
            validateEnvironment();
        } catch (error) {
            console.error('\n⚠️  STARTUP ERROR:', error.message);
            console.error('Please check your .env.local file and ensure all required variables are set.\n');
            // Don't crash in development, just warn
            if (process.env.NODE_ENV === 'production') {
                throw error;
            }
        }
    }
}
