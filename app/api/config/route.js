import { NextResponse } from 'next/server';
import { getLocalIP } from '../../../utils/network';

export async function GET() {
    const localIP = getLocalIP();
    return NextResponse.json({ localIP });
}
