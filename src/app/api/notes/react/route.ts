import { NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

// Move client creation into a function
async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable');
  }
  return new MongoClient(uri);
}

export async function POST(request: Request) {
  const client = await getMongoClient();
  
  try {
    const { noteId, emoji, userId } = await request.json();

    await client.connect();
    const database = client.db('vinyl-player');
    const notes = database.collection('notes');

    // Get the current note
    const note = await notes.findOne({ _id: new ObjectId(noteId) });
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Initialize reactions if they don't exist
    if (!note.reactions) {
      note.reactions = {};
    }

    // Initialize this emoji's reactions if they don't exist
    if (!note.reactions[emoji]) {
      note.reactions[emoji] = { count: 0, users: [] };
    }

    // Toggle the reaction
    const hasReacted = note.reactions[emoji].users.includes(userId);
    
    if (hasReacted) {
      // Remove reaction
      note.reactions[emoji].count--;
      note.reactions[emoji].users = note.reactions[emoji].users.filter(
        (id: string) => id !== userId
      );
      
      // Clean up empty reactions
      if (note.reactions[emoji].count === 0) {
        delete note.reactions[emoji];
      }
    } else {
      // Add reaction
      note.reactions[emoji].count++;
      note.reactions[emoji].users.push(userId);
    }

    // Update the note in the database
    await notes.updateOne(
      { _id: new ObjectId(noteId) },
      { $set: { reactions: note.reactions } }
    );

    return NextResponse.json({ reactions: note.reactions });
  } catch (error) {
    console.error('Failed to toggle reaction:', error);
    return NextResponse.json({ error: 'Failed to toggle reaction' }, { status: 500 });
  } finally {
    await client.close();
  }
} 