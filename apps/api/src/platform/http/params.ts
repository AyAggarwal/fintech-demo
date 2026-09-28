import { z } from 'zod';

export const entityIdParamsSchema = z.object({
  id: z.string().min(1).max(64),
});
