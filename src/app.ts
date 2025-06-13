import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import router from './routes';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI not set in environment variables');
}

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api', router);

app.get('/', (req, res) => {
  res.json({ message: 'Sorbonash backend running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
