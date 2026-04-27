import { NextRequest, NextResponse } from 'next/server';

// ── In-memory cache ──
interface CacheEntry {
  result: { technical: string; nonTechnical: string; commentSummary: string };
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return String(hash);
}

function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not set in environment' },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { taskId, taskName, description, comments, delayInfo, skipCache } = body;

  if (!taskId || !comments || !Array.isArray(comments)) {
    return NextResponse.json(
      { error: 'taskId and comments (array) are required' },
      { status: 400 }
    );
  }

  // Build cache key
  const cacheKey = simpleHash(
    taskId +
    comments.map((c: any) => c.text || '').join('|') +
    JSON.stringify(delayInfo || {})
  );

  // Check cache (unless skipCache)
  if (!skipCache) {
    cleanExpiredCache();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.result);
    }
  }

  // Build context for the prompt
  const commentTexts = comments
    .map((c: any, i: number) => `[Comment ${i + 1} by ${c.user || 'Unknown'}]: ${c.text}`)
    .join('\n');

  const delayContext = delayInfo
    ? `
Delay Data:
- Starting Delay: ${delayInfo.startingDelayDays ?? 'N/A'} days (task started late)
- Project Length Delay: ${delayInfo.projectLengthDelayDays ?? 'N/A'} days (took longer than planned)
- Completion Delay: ${delayInfo.completionDelayDays ?? 'N/A'} days (finished after due date)
- Planned Duration: ${delayInfo.plannedDays ?? 'N/A'} days
- Actual Duration: ${delayInfo.executionDays ?? 'N/A'} days
`
    : 'No delay data available.';

  const systemPrompt = `You are a project audit assistant.

Analyze the task delay using ONLY the provided data.
Do NOT assume missing information.
If no clear reason exists in the comments, say "No explicit reason found in comments."

Output ONLY valid JSON (no markdown, no code fences):

{
  "technical": "...",
  "nonTechnical": "...",
  "commentSummary": "..."
}

Rules:
- technical: Mention dependencies, blockers, engineering issues, rework, bugs, tooling. Be specific. Reference actual comments if possible.
- nonTechnical: Explain in very simple, everyday words. Imagine you are explaining to a friend who knows nothing about tech. No jargon, no buzzwords, no corporate speak. Use short sentences.
- commentSummary: Summarize what people said in the comments using plain, simple language anyone can understand. No technical terms. Write like you are telling a story to a 10 year old.
- Max 4 sentences each field.
- Do NOT invent information not present in the data.`;

  const userPrompt = `Task: "${taskName || 'Untitled'}"

Description: ${description || 'No description provided.'}

${delayContext}

Comments:
${commentTexts || 'No comments.'}`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${openaiRes.status} - ${errText}` },
        { status: openaiRes.status }
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let parsed: { technical: string; nonTechnical: string; commentSummary: string };
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback if JSON parsing fails
      parsed = {
        technical: content,
        nonTechnical: content,
        commentSummary: 'Could not parse structured response.',
      };
    }

    const result = {
      technical: parsed.technical || 'No analysis available.',
      nonTechnical: parsed.nonTechnical || 'No analysis available.',
      commentSummary: parsed.commentSummary || 'No summary available.',
    };

    // Store in cache
    cache.set(cacheKey, { result, timestamp: Date.now() });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to analyze: ${err.message}` },
      { status: 500 }
    );
  }
}
