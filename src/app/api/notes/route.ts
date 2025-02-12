import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// Create cached connection variable
let cachedClient: MongoClient | null = null;

// Function to connect to database
async function connectToDatabase() {
  if (cachedClient) {
    console.log('Using cached MongoDB connection');
    return cachedClient;
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not defined');
    throw new Error('Please define MONGODB_URI environment variable');
  }

  try {
    console.log('Attempting to connect to MongoDB...');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('Successfully connected to MongoDB');
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
    console.log('Attempting to save note for trackId:', trackId);
    
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

    console.log('Successfully saved note with ID:', result.insertedId);
    return NextResponse.json({ success: true, noteId: result.insertedId });
  } catch (error) {
    console.error('Failed to save note:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json({ 
      error: 'Failed to save note',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}

export async function GET(request: Request) {
  console.log('Starting GET request for notes...');
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      console.log('No trackId provided');
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    console.log('Fetching notes for trackId:', trackId);
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

    const client = await connectToDatabase();
    console.log('Connected to database');
    
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

    console.log(`Found ${trackNotes.length} notes for trackId:`, trackId);

    return NextResponse.json({ 
      notes: trackNotes,
      debug: {
        trackId,
        notesCount: trackNotes.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to fetch notes. Error details:');
    console.error('Error type:', typeof error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Raw error:', error);
    }

    return NextResponse.json({ 
      error: 'Failed to fetch notes',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        mongodbUri: process.env.MONGODB_URI ? 'exists' : 'missing',
        timestamp: new Date().toISOString()
      }
    }, { 
      status: 500 
    });
  }
} 