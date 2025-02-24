import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({
  apiKey: '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',
  dangerouslyAllowBrowser: true
});

interface FormattedTask {
  title: string;
  description: string;
  priority: number;
  suggestedProject: string | null;
  suggestedDueDate: string | null;
  language: string;
}

export const taskFormatterService = {
  async getOrCreateAssistant() {
    try {
      // Check if we already have an assistant
      const { data: existingAssistant, error } = await supabase
        .from('task_formatter_assistant')
        .select('openai_assistant_id')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch assistant:', error);
        throw error;
      }

      if (existingAssistant?.openai_assistant_id) {
        return existingAssistant.openai_assistant_id;
      }

      // Create new assistant
      const assistant = await openai.beta.assistants.create({
        name: "Task Formatter",
        instructions: `You are a task formatting specialist. Your job is to convert idea text into a well-structured task.

CRITICAL REQUIREMENTS:
1. Language:
   - Detect the language of the input (en, uk, ru)
   - NEVER translate - keep the same language as input
   - Respond in the SAME language as input
   - Include detected language code in response

2. Date Handling:
   - Convert ALL relative dates to absolute YYYY-MM-DD
   - "tomorrow" = current_date + 1 day
   - "next week" = current_date + 7 days
   - "next month" = current_date + 30 days
   - "next year" = current_date + 365 days
   - Keep exact dates as is
   - Use UTC for consistency

3. Format idea into:
   - Title: Clear, concise (max 100 chars)
   - Description: Main points and details
   - Priority (0-3) based on urgency words
   - Project suggestion from content
   - Due date from time references

Output format:
{
  "title": "...",
  "description": "...",
  "priority": 0-3,
  "suggestedProject": null | string,
  "suggestedDueDate": null | "YYYY-MM-DD",
  "language": "en" | "uk" | "ru"
}

Example responses in different languages:

English input: "Need to update the website design tomorrow"
{
  "title": "Update website design",
  "description": "Complete website design update",
  "priority": 2,
  "suggestedProject": "Website Redesign",
  "suggestedDueDate": "2024-02-12",
  "language": "en"
}

Ukrainian input: "Треба оновити дизайн сайту завтра"
{
  "title": "Оновити дизайн сайту",
  "description": "Виконати оновлення дизайну сайту",
  "priority": 2,
  "suggestedProject": "Редизайн сайту",
  "suggestedDueDate": "2024-02-12",
  "language": "uk"
}

Russian input: "Нужно обновить дизайн сайта завтра"
{
  "title": "Обновить дизайн сайта",
  "description": "Выполнить обновление дизайна сайта",
  "priority": 2,
  "suggestedProject": "Редизайн сайта",
  "suggestedDueDate": "2024-02-12",
  "language": "ru"
}`,
        model: "gpt-4",
        tools: [{ type: "code_interpreter" }]
      });

      // Save assistant ID
      const { error: insertError } = await supabase
        .from('task_formatter_assistant')
        .insert({
          openai_assistant_id: assistant.id
        });

      if (insertError) {
        console.error('Failed to save assistant ID:', insertError);
        throw insertError;
      }

      return assistant.id;
    } catch (err) {
      console.error('Failed to create/get assistant:', err);
      throw err;
    }
  },

  async formatIdea(ideaContent: string): Promise<FormattedTask> {
    try {
      const assistantId = await this.getOrCreateAssistant();

      if (!assistantId) {
        throw new Error('Failed to get or create assistant');
      }

      // Create a thread
      const thread = await openai.beta.threads.create();

      // Add message to thread
      const message = await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: ideaContent
      });

      if (!message) {
        throw new Error('Failed to create message');
      }

      // Run the assistant
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId
      });

      // Wait for completion
      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      while (runStatus.status !== 'completed') {
        if (attempts >= maxAttempts) {
          throw new Error('Formatting timeout - please try again');
        }
        if (runStatus.status === 'failed') {
          throw new Error('Formatting failed - please try again');
        }
        if (runStatus.status === 'cancelled') {
          throw new Error('Formatting was cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        attempts++;
      }

      // Get the messages
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data[0];

      if (!lastMessage?.content[0]?.text?.value) {
        throw new Error('No formatted result received - please try again');
      }

      // Parse the response
      let formattedTask;
      try {
        formattedTask = JSON.parse(lastMessage.content[0].text.value) as FormattedTask;
      } catch (parseError) {
        console.error('Failed to parse assistant response:', parseError);
        throw new Error('Invalid response format - please try again');
      }

      return formattedTask;
    } catch (err) {
      console.error('Failed to format idea:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to format idea');
    }
  }
};