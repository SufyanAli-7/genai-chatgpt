import app from '../backend/src/app/app.js';
import connectDB from '../backend/src/config/db.js';

export default async function handler(req, res) {
    try {
        await connectDB();
    } catch (error) {
        console.error('Database connection failed in serverless handler:', error);
    }
    return app(req, res);
}
