import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
    if (!apiKey) {
        return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    try {
        const { content, type, notes } = await req.json();

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        if (type === 'merge') {
            const prompt = `Analyze these notes and identify if any 2 or more are about the SAME specific topic/idea and should be merged.
            
            Notes:
            ${JSON.stringify(notes)}
            
            If yes, return JSON:
            {
              "shouldMerge": true,
              "noteIds": ["id1", "id2"],
              "mergedTitle": "New Title",
              "mergedContent": "Combined and refined content..."
            }
            
            If no strong match, return:
            { "shouldMerge": false }`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            return NextResponse.json(JSON.parse(text));
        }

        if (!content) {
            return NextResponse.json({ error: 'Content required' }, { status: 400 });
        }

        const prompt = `Analyze the following note content and extract:
1. A one-line summary (max 10 words).
2. 3-5 relevant short tags (lowercase, single word).
3. A mood emoji if the content conveys strong emotion (optional).

Return JSON in this format:
{
  "summary": "...",
  "tags": ["tag1", "tag2"],
  "mood": "😊" (or null)
}

Note Content:
${content}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const analysis = JSON.parse(cleanText);

        return NextResponse.json(analysis);

    } catch (error) {
        console.error('Gemini API Error:', error);
        return NextResponse.json({ error: 'Failed to process note' }, { status: 500 });
    }
}
