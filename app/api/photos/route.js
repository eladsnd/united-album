import { NextResponse } from 'next/server';
import { getPhotos } from '../../../utils/photos';

export async function GET() {
    try {
        const photos = getPhotos();
        return NextResponse.json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
