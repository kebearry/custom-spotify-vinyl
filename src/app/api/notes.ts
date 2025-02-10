import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../lib/db';
import Note from '../model/Note';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await dbConnect();

  if (req.method === 'POST') {
    const { songId, note } = req.body;
    const newNote = new Note({ songId, note });
    await newNote.save();
    res.status(201).json(newNote);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}