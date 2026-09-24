import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import env from '../config/env.js';
import authRouter from '../routes/auth.routes.js';
import errorMiddleware from '../middleware/error.middleware.js';
import conversationRouter from '../routes/conversation.routes.js';


const app = express();

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || !env.CLIENT_URL || origin === env.CLIENT_URL || /\.vercel\.app$/.test(origin)) {
                callback(null, true);
            } else {
                callback(null, true);
            }
        },
        credentials: true,
    }),
);
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is healthy',
    });
});

app.use('/api/auth', authRouter);
app.use('/api/conversation', conversationRouter);

app.use(errorMiddleware);

export default app;
