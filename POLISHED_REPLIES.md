# Clearer AI replies

This update fixes raw Markdown showing in AI Teacher and AI Coach, and adjusts future explanations to be easier to follow. Existing saved replies are formatted when displayed; their stored text and student progress are unchanged.

## Apply to your existing website

Keep your current `.env` and hosting environment variables. In particular, retain:

```dotenv
VITE_APPWRITE_AI_TEACHER_FUNCTION_ID=6aabcb0d002e4ba0de25
```

Copy these files from this updated project into your working project:

- `src/components/AiResponse.jsx` (new)
- `src/components/AiResponse.css` (new)
- `src/lib/aiFormatting.js` (new)
- `src/components/AiTeacher.jsx`
- `src/components/AiTeacher.css`
- `src/App.jsx`
- `package.json`
- `package-lock.json`

If you have made other source edits since the supplied project, merge these changes rather than overwriting those edits.

Run `npm ci`, then `npm run build`, and redeploy your website normally. For local development, restart `npm run dev`.

This website change is what fixes visible `**`, `###`, table pipes, and `<br>` in existing messages. Redeploying only the Appwrite function will not fix the display.

## Update the AI Teacher function

In the existing AI Teacher function, choose **Deployments → Create deployment → Manual**. Upload the supplied `mahei-ai-teacher-polished.tar.gz`, use `src/main.js` as the entrypoint and `npm install` as the build command, then activate the successful deployment.

Keep all existing function variables, storage, permissions and the same function ID. No database changes are required. Future chat replies will use the clearer teaching instructions. Old replies are formatted but are not rewritten.

The source folder `functions/mahei-ai-coach` also contains improved Coach instructions. If you use that older Coach feature, its separate function can be updated using `mahei-ai-coach-polished.tar.gz`. This is optional for AI Teacher.

## What changes

- One small concept per lesson, with an explanation, worked example and one practice question.
- Shorter paragraphs and direct answers to follow-up questions.
- Readable headings, bold terms, numbered steps, code blocks and comparison tables.
- Tables are avoided in new lessons unless the student asks for a comparison.
- Previously generated HTML line-break tags render as line breaks, while code examples preserve literal tags.
- Raw HTML is not executed and remote images in AI output are not loaded.
- No new model/provider is required.

The implementation uses [react-markdown](https://github.com/remarkjs/react-markdown) and [remark-gfm](https://github.com/remarkjs/remark-gfm). No raw-HTML rendering plugin is enabled.

## Checks

Production build and the 10 existing backend tests passed. Browser checks covered headings, emphasis, lists, saved tables, HTML line breaks, literal code, blocked executable HTML and unsafe links, and phone-width layout. The preview uses sample lesson text; new live AI output has not been evaluated against your deployed Groq service.
