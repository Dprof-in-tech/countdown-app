import type { APIRoute } from 'astro';
import { parseExams } from '../../lib/parse';

export const prerender = false;

/** POST /api/parse  { text: string } → { success, exams } | { success: false, errors } */
export const POST: APIRoute = async ({ request }) => {
  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return Response.json({ success: false, errors: [{ line: 0, message: 'Body must be JSON: { "text": "..." }' }] }, { status: 400 });
  }
  if (typeof text !== 'string') {
    return Response.json({ success: false, errors: [{ line: 0, message: '"text" must be a string' }] }, { status: 400 });
  }
  const result = parseExams(text);
  if (!result.success) return Response.json({ success: false, errors: result.errors }, { status: 422 });
  return Response.json({ success: true, exams: result.exams });
};
