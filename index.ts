import express, { Application } from 'express';
import eventsRouter from './routes/events.route';
import seatsRouter from './routes/seats.route';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/events', eventsRouter);
app.use('/seats', seatsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
