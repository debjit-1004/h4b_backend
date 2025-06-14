import { Request, Response, NextFunction } from 'express';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!(await req.civicAuth.isLoggedIn())) 
    return res.status(401).send('Unauthorized');
  next();
};

