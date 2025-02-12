import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Create cached connection variable
let cachedClient: MongoClient | null = null;

// Function to connect to database
async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('Please define MONGODB_URI environment variable');
  }

  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

export async function POST(request: Request) {
  try {
    const { trackId, note } = await request.json();
    
    const client = await connectToDatabase();
    const database = client.db('vinyl-player');
    const notes = database.collection('notes');

    const result = await notes.insertOne({
      trackId,
      content: note.content,
      timestamp: new Date(),
      reactions: {},
      isShared: true  // Add this if you want all notes to be shared by default
    });

    return NextResponse.json({ success: true, noteId: result.insertedId });
  } catch (error) {
    console.error('Failed to save note:', error);
    return NextResponse.json({ 
      error: 'Failed to save note',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    console.log('Fetching notes for trackId:', trackId); // Debug log

    const client = await connectToDatabase();
    const database = client.db('vinyl-player');
    const notes = database.collection('notes');

    // Get all shared notes for this track
    const trackNotes = await notes
      .find({ 
        trackId,
        isShared: true
      })
      .sort({ timestamp: -1 })
      .toArray();

    console.log('Found notes:', trackNotes.length); // Debug log

    return NextResponse.json({ notes: trackNotes });
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch notes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
} 