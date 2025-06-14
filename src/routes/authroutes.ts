import { Request, Response, Router} from 'express';
const router = Router();

router.get('/admin/hello', async (req: Request, res: Response) => {
  const user = await req.civicAuth.getUser();
  res.send(`Hello, ${user?.name}!`);
});

export default router;