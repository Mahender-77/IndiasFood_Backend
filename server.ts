import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './utils/db';
import allRoutes from './routes';

dotenv.config();

connectDB();

const app = express();

app.use(express.json());
app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use('/api', allRoutes);

// Basic error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

export default app; // ✅ IMPORTANT
