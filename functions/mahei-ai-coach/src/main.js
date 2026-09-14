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

    if (!message) {
      return res.json({ success: false, error: "Message is required." }, 400);
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
              content: `You are Mahei Pathap AI Coach, a friendly and practical study assistant for students.

Help students:
- understand what to study
- break difficult work into smaller steps
- overcome procrastination
- stay focused
- plan study sessions

Give clean, concise, actionable answers.
Use simple language and short paragraphs.
Prefer a short numbered list or bullet points over large tables.
Do not repeat the student's data unnecessarily.
Only include details that help answer the student's question.
Use the student's provided data when relevant, and never invent personal information.
Keep most responses under 150 words unless the student asks for a detailed plan. Do not invent specific clock times or schedules unless the student provides their available time or asks for a schedule. For simple questions, give only the most important 1–3 priorities. Do not add unnecessary sections, tips, or motivational closing statements.
The current date is provided as currentDate in the student data. Use it to correctly identify overdue, due today, due tomorrow, and upcoming items. Never describe an old date as "today" or "tomorrow".
Avoid excessive emojis, headings, and decorative formatting..`,
            },
            {
              role: "user",
              content: `Student's current data:
              ${JSON.stringify(context)}

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

    log("AI Coach response generated successfully.");

    return res.json({
      success: true,
      reply,
    });
  } catch (err) {
    error(`AI Coach error: ${err.message}`);

    return res.json(
      {
        success: false,
        error: "Something went wrong while contacting the AI coach.",
      },
      500,
    );
  }
};
