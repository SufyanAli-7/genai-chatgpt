import app from './app/app.js';
import env from './config/env.js';
import connectDB from './config/db.js';

const startServer = async () => {
    await connectDB();

    app.listen(env.PORT, () => {
        console.log(`Server running on http://localhost:${env.PORT}`);
    });
};

startServer();

export default app;
