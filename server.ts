import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import connectDB from './utils/db';
import allRoutes from './routes';


connectDB();

const app = express();

app.use(express.json());

// CORS configuration - must be before routes
// Allow both www and non-www versions of the domain
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.BASE_URL,
        process.env.BASE_URL1,
        'http://localhost:5173',
        'https://indiasfood.com',
        'https://www.indiasfood.com',
      ].filter(Boolean);

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Also check if it's a www/non-www variant
        const baseUrl = process.env.BASE_URL || 'https://indiasfood.com';
        const baseUrl1 = process.env.BASE_URL1 || 'https://www.indiasfood.com';
        
        if (origin === baseUrl || origin === baseUrl1) {
          callback(null, true);
        } else if (origin === 'https://www.indiasfood.com' || origin === 'https://indiasfood.com') {
          callback(null, true);
        } else {
          console.log(`CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
  })
);

app.use('/api', allRoutes);
app.use('/heakth', (req: Request, res: Response) => {
  res.send('server is running');
});

// error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// ✅ START SERVER ALWAYS
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed origins: ${process.env.BASE_URL}, ${process.env.BASE_URL1}, https://indiasfood.com, https://www.indiasfood.com`);
});

export default app;
