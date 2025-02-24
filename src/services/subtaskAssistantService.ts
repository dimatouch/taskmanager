import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

const openai = new OpenAI({
  apiKey: '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',
  dangerouslyAllowBrowser: true
});

interface SubtaskSuggestion {
  title: string;
  description: string | null;
  priority: number;
}

export const subtaskAssistantService = {
  async getOrCreateAssistant() {
    try {
      console.log('Getting or creating subtask assistant...');

      // Check if we already have an assistant
      const { data: existingAssistant, error } = await supabase
        .from('subtask_assistant')
        .select('openai_assistant_id')
        .limit(1)
        .maybeSingle();
      
      console.log('Existing assistant query result:', { data: existingAssistant, error });

      if (error) {
        console.error('Failed to fetch assistant:', error);
        throw error;
      }

      if (existingAssistant?.openai_assistant_id) {
        console.log('Found existing subtask assistant:', existingAssistant.openai_assistant_id);
        return existingAssistant.openai_assistant_id;
      }

      console.log('Creating new subtask assistant...');
      // Create new assistant
      const assistant = await openai.beta.assistants.create({
        name: "Subtask Breakdown Assistant",
        instructions: `You are a task breakdown specialist. Your job is to analyze tasks and suggest logical subtasks that will help complete the main task efficiently.

CRITICAL REQUIREMENTS:

1. Language:
   - Detect the language of the input (en, uk, ru)
   - NEVER translate - keep the same language as input
   - Respond in the SAME language as input

2. Analysis:
   - Break down the task into 3-7 logical subtasks
   - Each subtask should be clear and actionable
   - Maintain proper sequence/dependencies
   - Consider standard project phases
   - Suggest priority levels (0-3) based on dependencies

3. Format each subtask as:
   - Title: Clear, concise (max 100 chars)
   - Description: Optional details/instructions
   - Priority: 0 (none) to 3 (high)

Output format:
{
  "subtasks": [
    {
      "title": "...",
      "description": "..." | null,
      "priority": 0-3
    }
  ]
}`,
        model: "gpt-4",
        tools: [{ type: "code_interpreter" }]
      });
      console.log('Subtask assistant created:', assistant);

      // Save assistant ID
      const { error: insertError } = await supabase
        .from('subtask_assistant')
        .insert({
          openai_assistant_id: assistant.id
        });

      if (insertError) {
        console.error('Failed to save assistant ID:', insertError);
        throw insertError;
      }

      console.log('Subtask assistant ID saved successfully');
      return assistant.id;
    } catch (err) {
      console.error('Failed to create/get subtask assistant:', err);
      throw err;
    }
  },

  async suggestSubtasks(taskTitle: string, taskDescription: string | null): Promise<SubtaskSuggestion[]> {
    try {
      console.log('Starting subtask suggestion process for task:', { taskTitle, taskDescription });

      const assistantId = await this.getOrCreateAssistant();
      console.log('Got subtask assistant ID:', assistantId);

      if (!assistantId) {
        console.error('No subtask assistant ID returned');
        throw new Error('Failed to get or create subtask assistant');
      }

      // Create a thread
      console.log('Creating thread...');
      const thread = await openai.beta.threads.create();
      console.log('Thread created:', thread);

      // Prepare task content
      const taskContent = `Task Title: ${taskTitle}\n${taskDescription ? `Description: ${taskDescription}` : ''}`;
      console.log('Prepared task content:', taskContent);

      // Add message to thread
      console.log('Adding message to thread...');
      const message = await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: taskContent
      });
      console.log('Message added:', message);

      if (!message) {
        console.error('No message returned from OpenAI');
        throw new Error('Failed to create message');
      }

      // Run the assistant
      console.log('Starting assistant run...');
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId
      });
      console.log('Run created:', run);

      // Wait for completion
      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      console.log('Waiting for run completion...');

      while (runStatus.status !== 'completed') {
        console.log('Run status:', runStatus.status, `(attempt ${attempts + 1}/${maxAttempts})`);
        
        if (attempts >= maxAttempts) {
          console.error('Run timed out after', maxAttempts, 'attempts');
          throw new Error('Suggestion timeout - please try again');
        }
        if (runStatus.status === 'failed') {
          console.error('Run failed:', runStatus);
          throw new Error('Suggestion failed - please try again');
        }
        if (runStatus.status === 'cancelled') {
          console.error('Run was cancelled');
          throw new Error('Suggestion was cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        attempts++;
      }

      console.log('Run completed successfully');

      // Get the messages
      console.log('Retrieving messages...');
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data[0];
      console.log('Retrieved last message:', lastMessage);

      if (!lastMessage?.content[0]?.text?.value) {
        console.error('No content in last message');
        throw new Error('No suggestions received - please try again');
      }

      // Parse the response
      let suggestions;
      try {
        console.log('Parsing response:', lastMessage.content[0].text.value);
        const response = JSON.parse(lastMessage.content[0].text.value);
        suggestions = response.subtasks;
        console.log('Parsed suggestions:', suggestions);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Invalid response format - please try again');
      }

      return suggestions;
    } catch (err) {
      console.error('Failed to suggest subtasks:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to suggest subtasks');
    }
  }
};