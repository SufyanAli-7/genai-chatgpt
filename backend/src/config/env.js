import dotenv from 'dotenv';

dotenv.config();

const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 3000,
    MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/genai_chatgpt',
    JWT_SECRET: process.env.JWT_SECRET || 'change_this_secret_in_production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    COOKIE_NAME: process.env.COOKIE_NAME || 'token',
    BASE_URL: process.env.BASE_URL,
    API_KEY: process.env.API_KEY,
};

export default env;
