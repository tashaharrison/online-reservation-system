import { Router, Request, Response } from 'express';
const eventsRouter = Router();

eventsRouter.post('/create', (req: Request, res: Response) => {
  res.send('Hello World');
});

export default eventsRouter;
