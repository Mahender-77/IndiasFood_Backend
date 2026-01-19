import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './utils/db';
import allRoutes from './routes';

dotenv.config();
connectDB();

const app = express();

app.use(express.json());

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://indias-food-front-end.vercel.app']
    : [
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:3000',
      ];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use('/api', allRoutes);

// error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// ✅ START SERVER ALWAYS
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
