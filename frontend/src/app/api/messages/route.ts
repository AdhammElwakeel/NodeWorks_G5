import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Message, Conversation } from "@/lib/models";
import { verifyToken } from "@/lib/auth";

interface LeanMessageDoc {
  _id: { toString(): string };
  senderId: { toString(): string };
  receiverId: { toString(): string };
  content: string;
  readAt?: Date | string | null;
  createdAt: Date | string;
}

interface PopulatedParticipant {
  _id: { toString(): string };
  name: string | null;
  avatar: string | null;
}

interface PopulatedConversation {
  _id: { toString(): string };
  participants: PopulatedParticipant[];
  lastMessage?: string;
  lastMessageAt?: Date | string;
}

// GET /api/messages — list conversations or get thread
// ?with=userId → get conversation with that user
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = payload.userId;
    const { searchParams } = new URL(req.url);
    const withUserId = searchParams.get("with");

    // Get thread with specific user
    if (withUserId) {
      const conversation = await Conversation.findOne({
        participants: { $all: [userId, withUserId] },
      });

      if (!conversation) {
        return NextResponse.json({ messages: [] });
      }

      const messages = (await Message.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .lean()) as unknown as LeanMessageDoc[];

      // Mark as read
      await Message.updateMany(
        { conversationId: conversation._id, receiverId: userId, readAt: null },
        { readAt: new Date() }
      );

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m._id.toString(),
          senderId: m.senderId.toString(),
          receiverId: m.receiverId.toString(),
          content: m.content,
          readAt: m.readAt,
          createdAt: m.createdAt,
        })),
      });
    }

    // List all conversations
    const conversations = (await Conversation.find({
      participants: userId,
    })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name email avatar")
      .lean()) as unknown as PopulatedConversation[];

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c._id.toString(),
        participants: c.participants.map((p) => ({
          id: p._id.toString(),
          name: p.name,
          avatar: p.avatar,
        })),
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch messages";
    console.error("Messages GET error:", message);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

// POST /api/messages — send a message
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { receiverId, content } = body;

    if (!receiverId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const senderId = payload.userId;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    // Update conversation metadata
    conversation.lastMessage = content.slice(0, 100);
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId,
      content,
    });

    return NextResponse.json(
      {
        message: {
          id: message._id.toString(),
          senderId: message.senderId.toString(),
          receiverId: message.receiverId.toString(),
          content: message.content,
          createdAt: message.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    console.error("Messages POST error:", message);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}