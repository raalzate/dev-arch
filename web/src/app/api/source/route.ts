import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
        return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }

    try {
        // Basic security check: ensure it's a file and not a directory
        // In a real production app, we would restrict this to a specific sandbox directory
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            return NextResponse.json({ error: 'Path is not a file' }, { status: 400 });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        return NextResponse.json({ content });
    } catch (error) {
        console.error('Error reading source file:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: `Failed to read file: ${errorMessage}` }, { status: 500 });
    }
}
