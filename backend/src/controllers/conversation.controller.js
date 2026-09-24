import ConversationModel from "../models/conversation.model.js";
import MessageModel from "../models/message.model.js";
import { generateTitle, getStream } from "../services/ai.service.js";


export const getConversations = async (req, res, next) => {
    try {
        const conversations = await ConversationModel.find({ user: req.user.id })
            .sort({ updatedAt: -1 })
            .lean();

        if (!conversations.length) {
            return res.status(200).json({
                success: true,
                conversations: [],
            });
        }

        const conversationIds = conversations.map((conversation) => conversation._id);

        const messages = await MessageModel.find({
            conversation: { $in: conversationIds },
        })
            .sort({ createdAt: 1 })
            .lean();

        const messagesByConversation = new Map();

        for (const message of messages) {
            const key = message.conversation.toString();
            if (!messagesByConversation.has(key)) {
                messagesByConversation.set(key, []);
            }

            messagesByConversation.get(key).push({
                id: message._id,
                author: message.author,
                content: message.content,
                createdAt: message.createdAt,
            });
        }

        const responseConversations = conversations.map((conversation) => ({
            id: conversation._id,
            title: conversation.title,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            messages: messagesByConversation.get(conversation._id.toString()) || [],
        }));

        return res.status(200).json({
            success: true,
            conversations: responseConversations,
        });
    } catch (error) {
        next(error);
    }
};


export const handleMessage = async (req, res) => {
    const { message, conversationId } = req.body;
    const user = req.user;

    let conversation = null

    if (!conversationId) {
        const title = await generateTitle({ message })

        conversation = await ConversationModel.create({
            title,
            user: req.user.id,
        })
    } else {
        conversation = await ConversationModel.findOne({
            _id: conversationId,
            user: req.user.id,
        })

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            })
        }
    }


    const userMessage = await MessageModel.create({
        conversation: conversation._id,
        content: message,
        author: 'user'
    })

    const messages = await MessageModel.find({ conversation: conversation._id })

    const stream = await getStream({ messages, userId: user.id })


    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');


    res.setHeader('X-Conversation-Id', conversation._id.toString());
    res.setHeader('X-Conversation-Title', conversation.title);
    res.setHeader('Access-Control-Expose-Headers', 'X-Conversation-Id, X-Conversation-Title');

    let assistantReply = '';

    for await (const chunk of stream) {
        const tokenText = chunk?.choices?.[0]?.delta?.content || '';
        if (!tokenText) continue;

        assistantReply += tokenText;

        const lines = tokenText.split('\n');
        for (const line of lines) {
            res.write(`data: ${line}\n`);
        }
        res.write('\n');
    }

    if (assistantReply.trim()) {
        await MessageModel.create({
            conversation: conversation._id,
            content: assistantReply,
            author: 'ai',
        });
    }

    await ConversationModel.updateOne(
        { _id: conversation._id },
        { $set: { updatedAt: new Date() } },
    );

    res.end();

}