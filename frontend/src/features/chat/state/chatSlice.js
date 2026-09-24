import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchConversationsApi, sendMessageApi } from '../api/chatApi.js';

const initialState = {
    conversations: [],
    selectedConversationId: null,
    messages: [],
    isLoadingConversations: false,
    isSending: false,
    error: null,
};

const syncCurrentMessagesToSelectedConversation = (state) => {
    if (!state.selectedConversationId) {
        return;
    }

    const conversation = state.conversations.find((item) => item.id === state.selectedConversationId);
    if (!conversation) {
        return;
    }

    conversation.messages = state.messages;
    conversation.updatedAt = new Date().toISOString();
};

const removePendingAssistantMessage = (state) => {
    const lastMessage = state.messages[ state.messages.length - 1 ];

    if (lastMessage?.author === 'ai' && !lastMessage.content) {
        state.messages.pop();
    }
};

export const fetchConversations = createAsyncThunk('chat/fetchConversations', async (_, { rejectWithValue }) => {
    try {
        const response = await fetchConversationsApi();
        return response.conversations || [];
    } catch (error) {
        return rejectWithValue(error.message || 'Unable to load conversations');
    }
});

export const sendMessage = createAsyncThunk(
    'chat/sendMessage',
    async ({ message }, { dispatch, getState, rejectWithValue }) => {
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
            return rejectWithValue('Message is required');
        }

        const previousConversationId = getState().chat.selectedConversationId;

        dispatch(appendUserMessage(trimmedMessage));
        dispatch(startAssistantMessage());

        try {
            const { conversationId, conversationTitle } = await sendMessageApi({
                message: trimmedMessage,
                conversationId: previousConversationId,
                onToken: (token) => {
                    dispatch(appendAssistantToken(token));
                },
            });

            return {
                conversationId,
                conversationTitle,
                previousConversationId,
            };
        } catch (error) {
            return rejectWithValue(error.message || 'Unable to send message');
        }
    },
);

const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        appendUserMessage: (state, action) => {
            state.messages.push({
                id: `user-${Date.now()}`,
                author: 'user',
                content: action.payload,
            });

            syncCurrentMessagesToSelectedConversation(state);
        },
        startAssistantMessage: (state) => {
            state.messages.push({
                id: `ai-${Date.now()}`,
                author: 'ai',
                content: '',
            });

            syncCurrentMessagesToSelectedConversation(state);
        },
        appendAssistantToken: (state, action) => {
            const lastMessage = state.messages[ state.messages.length - 1 ];

            if (lastMessage?.author === 'ai') {
                lastMessage.content += action.payload;
                return;
            }

            state.messages.push({
                id: `ai-${Date.now()}`,
                author: 'ai',
                content: action.payload,
            });
        },
        selectConversation: (state, action) => {
            const selectedConversationId = action.payload;
            state.selectedConversationId = selectedConversationId;

            const conversation = state.conversations.find((item) => item.id === selectedConversationId);
            state.messages = conversation ? [ ...conversation.messages ] : [];
        },
        clearChatError: (state) => {
            state.error = null;
        },
        resetChat: (state) => {
            state.selectedConversationId = null;
            state.messages = [];
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchConversations.pending, (state) => {
                state.isLoadingConversations = true;
                state.error = null;
            })
            .addCase(fetchConversations.fulfilled, (state, action) => {
                state.isLoadingConversations = false;
                state.conversations = action.payload;

                if (!state.selectedConversationId && action.payload.length > 0) {
                    state.selectedConversationId = action.payload[ 0 ].id;
                    state.messages = [ ...(action.payload[ 0 ].messages || []) ];
                    return;
                }

                if (state.selectedConversationId) {
                    const selectedConversation = action.payload.find((item) => item.id === state.selectedConversationId);
                    state.messages = selectedConversation ? [ ...(selectedConversation.messages || []) ] : [];
                    if (!selectedConversation) {
                        state.selectedConversationId = null;
                    }
                }
            })
            .addCase(fetchConversations.rejected, (state, action) => {
                state.isLoadingConversations = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(sendMessage.pending, (state) => {
                state.isSending = true;
                state.error = null;
            })
            .addCase(sendMessage.fulfilled, (state, action) => {
                state.isSending = false;

                const { conversationId, conversationTitle, previousConversationId } = action.payload || {};

                if (!conversationId) {
                    return;
                }

                if (!previousConversationId) {
                    state.selectedConversationId = conversationId;
                    state.conversations.unshift({
                        id: conversationId,
                        title: conversationTitle || 'New chat',
                        messages: [ ...state.messages ],
                        updatedAt: new Date().toISOString(),
                    });
                    return;
                }

                const existingConversation = state.conversations.find((item) => item.id === conversationId);
                if (existingConversation) {
                    existingConversation.messages = [ ...state.messages ];
                    existingConversation.updatedAt = new Date().toISOString();

                    if (conversationTitle) {
                        existingConversation.title = conversationTitle;
                    }

                    state.conversations = [
                        existingConversation,
                        ...state.conversations.filter((item) => item.id !== conversationId),
                    ];
                    return;
                }

                state.conversations.unshift({
                    id: conversationId,
                    title: conversationTitle || 'New chat',
                    messages: [ ...state.messages ],
                    updatedAt: new Date().toISOString(),
                });
            })
            .addCase(sendMessage.rejected, (state, action) => {
                state.isSending = false;
                state.error = action.payload || action.error.message;
                removePendingAssistantMessage(state);
            });
    },
});

export const {
    appendUserMessage,
    startAssistantMessage,
    appendAssistantToken,
    selectConversation,
    clearChatError,
    resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;
