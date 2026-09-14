const GROQ_MODEL = "openai/gpt-oss-120b";

export default async ({ req, res, log, error }) => {
  try {
    if (req.method !== "POST") {
      return res.json(
        { success: false, error: "Only POST requests are allowed." },
        405
      );
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const message = String(body.message || "").trim();
    const context = body.context || {};

    if (!message) {
      return res.json(
        { success: false, error: "A message is required." },
        400
      );
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      error("GROQ_API_KEY is not configured.");

      return res.json(
        { success: false, error: "AI service is not configured." },
        500
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
              content: `You are Mahei Pathap AI Agent.

Your job is to understand what action a student wants to perform in the Mahei Pathap app.

You may identify these action types:

- create_task
- create_goal
- complete_task
- complete_assignment
- create_tasks_from_assignment
- plan_study_session
- none

Return ONLY valid JSON.

The JSON must have this structure:

{
  "action": "one of the allowed action types",
  "parameters": {},
  "reply": "short natural-language explanation"
}

Rules:
- Never invent IDs.
- Never invent deadlines.
- Never invent information that is not provided by the student or current app data.
- For create_task, identify the title, deadline, priority, category, estimated time, and notes only when available.
- For create_goal, identify the goal title and other available details.
- For complete_task and complete_assignment, use an existing ID from the supplied app data when one clearly matches.
- If you cannot safely determine the requested action, use "none".
- If the user is only asking a question, use "none".
- Do not execute actions yourself.
- Do not claim that an action was completed.
- Keep reply short.

The current app data is supplied by the user message context.`,
            },
            {
              role: "user",
              content: `Student request:
${message}

Current app data:
${JSON.stringify(context)}

Determine the safest action.`,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      error(`Groq API error: ${JSON.stringify(data)}`);

      return res.json(
        {
          success: false,
          error: "The AI service returned an error.",
        },
        502
      );
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.json(
        {
          success: false,
          error: "The AI returned an empty response.",
        },
        502
      );
    }

    let action;

    try {
      action = JSON.parse(reply);
    } catch {
      error(`Invalid AI JSON response: ${reply}`);

      return res.json(
        {
          success: false,
          error: "The AI returned an invalid action.",
        },
        502
      );
    }

    log(`AI Agent action detected: ${action.action || "none"}`);

    return res.json({
      success: true,
      action: action.action || "none",
      parameters: action.parameters || {},
      reply: action.reply || "",
    });
  } catch (err) {
    error(`AI Agent error: ${err.message}`);

    return res.json(
      {
        success: false,
        error: "Something went wrong while processing the AI action.",
      },
      500
    );
  }
};
