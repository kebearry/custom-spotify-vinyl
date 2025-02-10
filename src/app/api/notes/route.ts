import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

export async function POST(request: Request) {
  try {
    const { trackId, note } = await request.json();

    await client.connect();
    const database = client.db('vinyl-player');
    const notes = database.collection('notes');

    const result = await notes.insertOne({
      trackId,
      content: note.content,
      timestamp: new Date(),
      reactions: {}  // Initialize empty reactions
    });

    return NextResponse.json({ success: true, noteId: result.insertedId });
  } catch (error) {
    console.error('Failed to save note:', error);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  } finally {
    await client.close();
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    await client.connect();
    const database = client.db('vinyl-player');
    const notes = database.collection('notes');

    // Get all shared notes for this track
    const trackNotes = await notes
      .find({ 
        trackId,
        isShared: true // Only get shared notes
      })
      .sort({ timestamp: -1 })
      .toArray();

    return NextResponse.json({ notes: trackNotes });
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  } finally {
    await client.close();
  }
} 