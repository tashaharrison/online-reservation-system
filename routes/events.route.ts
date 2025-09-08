import { Router } from 'express';
import { createEvent, getEvent } from '../controllers/events.controller';

const eventsRouter = Router();

eventsRouter.post('/create', createEvent);
eventsRouter.get('/:id', getEvent);

export default eventsRouter;
