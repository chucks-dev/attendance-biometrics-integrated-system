import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import apiRouter from './routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiters';

export const app = express();

// Secure headers
app.use(helmet());

// CORS — restricted to the configured client origin
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(env.isProd ? 'combined' : 'dev'));

// General rate limit across all API routes; auth routes carry a stricter limit too
app.use('/api', apiLimiter);
app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
