import { PrismaClient, Prisma } from '@prisma/client';
import express, { Request, Response } from 'express';
import cors from 'cors';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Get all chats
app.get('/api/chats', async (req: Request, res: Response) => {
  try {
    const chats = await prisma.chat.findMany({
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Create a new chat
app.post('/api/chats', async (req: Request, res: Response) => {
  try {
    const chat = await prisma.chat.create({
      data: {
        title: req.body.title || 'New Chat'
      },
      include: {
        messages: true
      }
    });
    res.json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Update chat title
app.put('/api/chats/:id', async (req: Request, res: Response) => {
  try {
    const chat = await prisma.chat.update({
      where: { id: req.params.id },
      data: { title: req.body.title },
      include: {
        messages: true
      }
    });
    res.json(chat);
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Get messages for a specific chat
app.get('/api/chats/:id/messages', async (req: Request, res: Response) => {
  try {
    const messages = await prisma.message.findMany({
      where: { chatId: req.params.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add a new message to a chat
app.post('/api/chats/:id/messages', async (req: Request, res: Response) => {
  try {
    const [message, _] = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdMessage = await tx.message.create({
        data: {
          content: req.body.content,
          role: req.body.role,
          chatId: req.params.id
        }
      });
      await tx.chat.update({
        where: { id: req.params.id },
        data: { updatedAt: new Date() }
      });
      return [createdMessage, tx];
    });
    res.json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete a chat
app.delete('/api/chats/:id', async (req: Request, res: Response) => {
  try {
    const chatId = req.params.id;
    
    // Delete the chat and all its messages in a transaction to ensure consistency
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete all messages first
      await tx.message.deleteMany({
        where: { chatId }
      });
      
      // Then delete the chat
      await tx.chat.delete({
        where: { id: chatId }
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ 
      error: 'Failed to delete chat',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
