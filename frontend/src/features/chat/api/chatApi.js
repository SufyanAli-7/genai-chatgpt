const parseErrorResponse = async (response) => {
    try {
        const data = await response.json();
        return data?.message || 'Failed to send message';
    } catch {
        return 'Failed to send message';
    }
};

const parseJsonResponse = async (response) => {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || 'Request failed');
    }

    return data;
};

const readSseChunk = (chunk) => {
    const lines = chunk.split('\n');
    const dataLines = [];

    for (const line of lines) {
        if (!line.startsWith('data:')) {
            continue;
        }

        // Server writes "data: ${text}", so remove only the protocol prefix and one separator space.
        let value = line.slice(5);
        if (value.startsWith(' ')) {
            value = value.slice(1);
        }

        dataLines.push(value);
    }

    return dataLines.join('\n');
};

/**
 * Sends a chat message and streams token chunks from backend SSE response.
 *
 * @param {{message: string, conversationId?: string | null, onToken?: (token: string, fullText: string) => void}} params
 * @returns {Promise<{conversationId: string | null, reply: string}>}
 */
export const sendMessageApi = async ({ message, conversationId, onToken }) => {
    const response = await fetch('/api/conversation', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, conversationId }),
    });

    if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
    }

    const nextConversationId = response.headers.get('x-conversation-id') || conversationId || null;
    const rawTitle = response.headers.get('x-conversation-title');
    let conversationTitle = null;
    if (rawTitle) {
        try {
            conversationTitle = decodeURIComponent(rawTitle);
        } catch {
            conversationTitle = rawTitle;
        }
    }

    if (!response.body) {
        return {
            conversationId: nextConversationId,
            conversationTitle,
            reply: '',
        };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullReply = '';
    let pendingBatch = '';
    let animationFrameId = null;

    const flushBatch = () => {
        if (pendingBatch) {
            const batch = pendingBatch;
            pendingBatch = '';
            fullReply += batch;
            onToken?.(batch, fullReply);
        }
        animationFrameId = null;
    };

    const scheduleBatch = (token) => {
        pendingBatch += token;
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(flushBatch);
        }
    };

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            buffer += decoder.decode();
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
            const token = readSseChunk(chunk);

            if (!token) {
                continue;
            }

            scheduleBatch(token);
        }
    }

    if (buffer) {
        const token = readSseChunk(buffer);

        if (token) {
            pendingBatch += token;
        }
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    flushBatch();

    return {
        conversationId: nextConversationId,
        conversationTitle,
        reply: fullReply,
    };
};

/**
 * Fetches all conversations and their messages for the authenticated user.
 *
 * @returns {Promise<{conversations: Array<any>}>}
 */
export const fetchConversationsApi = async () => {
    const response = await fetch('/api/conversation', {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    return parseJsonResponse(response);
};
