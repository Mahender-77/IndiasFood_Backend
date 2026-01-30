import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import connectDB from './utils/db';
import allRoutes from './routes';

connectDB();

const app = express();

// ✅ IMPORTANT: Apply middleware in correct order
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORS Configuration for Vercel
const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [
        'https://indias-food-front-end.vercel.app',
        'https://indias-food-front-end.vercel.app/',
      ]
    : [
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:3000',
      ];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
  })
);

// ✅ Handle preflight requests explicitly
app.options('*', cors());

// ✅ Routes
app.use('/api', allRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Server is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ✅ 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
});

// ✅ Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Something broke!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ✅ Only start server if not on Vercel (Vercel handles this)
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

export default app;