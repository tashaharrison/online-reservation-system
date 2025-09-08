import { Router } from 'express';
import { createEvent, getEvent } from '../controllers/events.controller';

const eventsRouter = Router();

// Create a new event.
eventsRouter.post('/create', createEvent);

// Get a single event.
eventsRouter.get('/:id', getEvent);

export default eventsRouter;
