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
app.use(
  cors({
    origin: [
      process.env.BASE_URL,
      process.env.BASE_URL1,
      `http://localhost:5173`
    ].filter(Boolean),
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
});

export default app;
