import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import connectDB from './utils/db';
import allRoutes from './routes';


connectDB();

const app = express();

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const baseUrl1 = process.env.BASE_URL1;
  const baseUrl = process.env.BASE_URL;

  if (baseUrl1 && req.headers.origin === baseUrl1) {
    if (baseUrl) {
      console.log(`Redirecting request from ${baseUrl1} to ${baseUrl}`);
      res.redirect(302, baseUrl);
      return;
    } else {
      console.warn('BASE_URL is not defined, cannot perform redirect from BASE_URL1.');
    }
  }
  next();
});

app.use(
  cors({
    origin: [
      process.env.BASE_URL,
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
