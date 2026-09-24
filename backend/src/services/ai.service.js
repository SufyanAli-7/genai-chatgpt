import OpenAI from "openai";
import env from "../config/env.js";
import Context from "../models/context.model.js";

const client = new OpenAI({
    baseURL: env.BASE_URL,
    apiKey: env.API_KEY,
});

export async function generateResponse(content) {
    const resp = await client.chat.completions.create({
        model: "gemini-3.7-flash",
        messages: [{ role: "user", content }],
    });

    return resp.choices[0]?.message?.content;
}

export async function generateTitle({ message }) {
    const response = await client.chat.completions.create({
        model: "gemini-3.7-flash",
        messages: [
            {
                role: "system",
                content: "Generate a short, concise conversation title (maximum 3 to 5 words, without quotes or punctuation) based on the user's message.",
            },
            {
                role: "user",
                content: message,
            },
        ],
    });

    const title = response.choices[0]?.message?.content?.trim() || "New Chat";
    return title.replace(/^["']|["']$/g, '');
}

export async function getStream({ messages, userId }) {
    let systemPrompt = `You are a helpful AI assistant.\nCurrent Date is ${new Date().toDateString()}`;

    if (userId) {
        const userContext = await Context.findOne({ user: userId });
        if (userContext?.context) {
            systemPrompt += `\n\nUser Context:\n${userContext.context}`;
        }
    }

    const formattedMessages = [
        {
            role: "system",
            content: systemPrompt,
        },
        ...messages.map((msg) => ({
            role: msg.author === "user" ? "user" : "assistant",
            content: msg.content,
        })),
    ];

    const stream = await client.chat.completions.create({
        model: "gemini-3.7-flash",
        messages: formattedMessages,
        stream: true,
    });

    return stream;
}

export { client };
export default client;