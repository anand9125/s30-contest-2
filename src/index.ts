import express from "express"
import {authRoutes} from "./routes/userRouter.js"
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

