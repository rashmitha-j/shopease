import mongoose from 'mongoose';

const connectDB = async (uri = process.env.MONGO_URI) => {
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

export default connectDB;
