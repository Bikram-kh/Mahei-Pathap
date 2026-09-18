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

    const context = body.context || {};

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
              content: `You are Mahei Pathap AI Study Planner.

Your job is to create a highly personalized, practical study plan that a student can immediately follow.

PRIMARY RULE:
If study-plan interview answers are provided, they are the PRIMARY REQUEST.
The interview answers must drive the entire study plan.

The interview may contain:
- Subject
- Class or learning level
- Topic or chapter
- Learning goal
- Available study time
- Confidence level
- Deadline, exam, or important date

Use these answers to determine:
- What the student should study
- Which concepts should be covered
- The correct learning order
- The vocabulary and difficulty appropriate for the student's class or learning level
- How much time each activity should receive
- How difficult or simple each activity should be

EXISTING APP DATA:
Tasks, Assignments, Skills, Goals, and Focus History are SECONDARY CONTEXT.

Use them only when they genuinely help personalize the plan.
Never let existing app data replace the student's interview request.

STUDY PLAN QUALITY:
Do NOT create a generic timetable.

Create real learning activities related to the requested subject and topic.

For example, for Python Functions:
- Understand function syntax
- Learn parameters and arguments
- Understand return values
- Write simple functions
- Solve beginner problems
- Review mistakes
- Take a short self-test

Adapt the activities to the actual subject and topic.

CONFIDENCE:
- Low confidence → prioritize fundamentals, explanations, examples, and guided practice.
- Medium confidence → balance learning, practice, and testing.
- High confidence → prioritize problem solving, application, and testing.

GOAL:
Use the student's stated goal to determine what the student should be able to do by the end of the session.

AVAILABLE TIME:
Treat the student's available study time as a HARD LIMIT.

Never exceed it.

Every activity must have an estimated duration.
The total duration must be equal to or less than the available study time.

DEADLINE:
If an exam, deadline, or important date is provided, use it to increase the priority and focus of the plan.

Do not invent deadlines.

LEARNING ORDER:
Generally follow this pattern when appropriate:

1. Learn / understand
2. See examples
3. Practice
4. Apply
5. Review mistakes
6. Self-test

Adjust this order when the subject requires a different approach.

IMPORTANT:
Do not simply divide time into Pomodoro blocks.
Do not create unnecessary breaks.
Use a short break only when it genuinely improves the study session.

RESPONSE FORMAT:

Return a clean, polished study plan using simple plain text.

Do NOT use:
- Markdown tables
- Pipe characters (|)
- HTML tags such as <br>
- JSON
- Code blocks
- Long motivational paragraphs
- Unnecessary explanations

Use this structure:

TODAY'S STUDY PLAN

[Subject] • [Topic]
[Available time] • [Confidence level] • [Deadline if provided]

GOAL
[One short sentence describing the student's goal]

YOUR PLAN

1. [Activity name] — [X min]
   [Short explanation of what to learn or do.]
   Practice: [Specific action when useful.]

2. [Activity name] — [X min]
   [Short explanation.]
   Practice: [Specific action when useful.]

Continue until the available study time is used effectively.

QUICK CHECK
[One short self-test or review activity.]

TOTAL: [X minutes]

QUALITY RULES:
- Keep activities specific to the requested topic.
- Make every activity actionable.
- Prefer concrete practice over vague instructions.
- Make the plan appropriate for the student's confidence level.
- Prioritize difficult or important concepts.
- Make the plan realistic for one study session.
- Keep the response concise and easy to scan.
- Never exceed the available study time.
- Never invent information.`,
            },
            {
              role: "user",
              content: `Study-plan interview answers (PRIMARY REQUEST):
${JSON.stringify(context.interview || {})}

Student's existing app data (SECONDARY CONTEXT):
${JSON.stringify({
  currentDate: context.currentDate,
  tasks: context.tasks,
  assignments: context.assignments,
  skills: context.skills,
  goals: context.goals,
  focusHistory: context.focusHistory,
})}

Create the study plan based primarily on the interview answers.`,
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

    log("AI Study Plan generated successfully.");

    return res.json({
      success: true,
      reply,
    });
  } catch (err) {
    error(`AI Planner error: ${err.message}`);

    return res.json(
      {
        success: false,
        error: "Something went wrong while creating the study plan.",
      },
      500,
    );
  }
};
