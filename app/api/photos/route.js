import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const photosPath = path.join(process.cwd(), 'data', 'photos.json');
        if (!fs.existsSync(photosPath)) {
            return NextResponse.json([]);
        }
        const photos = JSON.parse(fs.readFileSync(photosPath, 'utf8'));
        return NextResponse.json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
