const GROQ_MODEL = "openai/gpt-oss-120b";

export default async ({ req, res, log, error }) => {
  try {
    if (req.method !== "POST") {
      return res.json(
        { success: false, error: "Only POST requests are allowed." },
        405,
      );
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const message = String(body.message || "").trim();
    const context = body.context || {};

    if (!message || message.length > 2000) {
      return res.json({ success: false, error: "Enter a message of up to 2,000 characters." }, 400);
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      error("GROQ_API_KEY is not configured.");

      return res.json(
        { success: false, error: "AI service is not configured." },
        500,
      );
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: `You are Mahei Assistance, a friendly and practical assistant inside the Mahei Pathap student app.

Help students:
- understand what to study
- break difficult work into smaller steps
- overcome procrastination
- stay focused
- plan study sessions
- understand their tasks, assignments, calendar events, goals, notes, analytics, focus history, and AI Teacher progress

Give clean, concise, actionable answers.
Use simple language and short paragraphs.
Prefer a short numbered list or bullet points over large tables.
Do not repeat the student's data unnecessarily.
Only include details that help answer the student's question.
Use the student's provided data when relevant, and never invent personal information.
When teacherLearning is available, use its current topic, roadmap status, and latest result to suggest the most relevant next learning step. Do not claim to change AI Teacher progress.
Use calendarEvents when answering schedule questions. Keep event dates and times exactly as supplied in the student data.
Use studentProfile to match explanations and plans to the student's class or level, preferred language, and daily study target. Do not repeat private profile details unless they are directly relevant.
The action router handles requested app changes before you are called. Do not claim that you created, completed, saved, opened, or updated anything.
Keep most responses under 150 words unless the student asks for a detailed plan. Do not invent specific clock times or schedules unless the student provides their available time or asks for a schedule. For simple questions, give only the most important 1–3 priorities. Do not add unnecessary sections, tips, or motivational closing statements.
The current date is provided as currentDate in the student data. Use it to correctly identify overdue, due today, due tomorrow, and upcoming items. Never describe an old date as "today" or "tomorrow".
Lead with a direct answer in familiar words. Explain unfamiliar terms briefly.
Use light Markdown: short headings only when helpful, numbered steps for a process, and occasional bold key terms. Leave blank lines between paragraphs. Never output HTML tags or decorative separators. Avoid tables unless the student explicitly requests a comparison.
For teaching questions, focus on one concept, give one small worked example and ask at most one practice question. For a follow-up, answer the specific doubt without repeating the introduction.
Avoid excessive emojis, generic praise, and motivational sign-offs.`,
            },
            {
              role: "user",
              content: `Student's current data:
              ${JSON.stringify(context).slice(0, 30000)}

              Student's question:
              ${message}`,
            },
          ],
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      error(`Groq API error: ${JSON.stringify(data)}`);

      return res.json(
        {
          success: false,
          error: "The AI service returned an error.",
        },
        502,
      );
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.json(
        {
          success: false,
          error: "The AI returned an empty response.",
        },
        502,
      );
    }

    log("Mahei Assistance response generated successfully.");

    return res.json({
      success: true,
      reply,
    });
  } catch (err) {
    error(`Mahei Assistance error: ${err.message}`);

    return res.json(
      {
        success: false,
        error: "Something went wrong while contacting the AI coach.",
      },
      500,
    );
  }
};
