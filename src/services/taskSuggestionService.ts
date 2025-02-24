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

export const taskSuggestionService = {
  async getOrCreateAssistant() {
    try {
      console.log('Getting or creating assistant...');

      // Check if we already have an assistant
      const { data: existingAssistant, error } = await supabase
        .from('task_formatter_assistant')
        .select('openai_assistant_id')
        .limit(1)
        .maybeSingle();
      
      console.log('Existing assistant query result:', { data: existingAssistant, error });

      if (error) {
        console.error('Failed to fetch assistant:', error);
        throw error;
      }

      if (existingAssistant?.openai_assistant_id) {
        console.log('Found existing assistant:', existingAssistant.openai_assistant_id);
        return existingAssistant.openai_assistant_id;
      }

      console.log('Creating new assistant...');
      // Create new assistant
      const assistant = await openai.beta.assistants.create({
        name: "Task Breakdown Assistant",
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
}

Example responses in different languages:

English input: "Create a new landing page for our product"
{
  "subtasks": [
    {
      "title": "Gather requirements and brand guidelines",
      "description": "Collect all necessary brand assets, style guides, and content requirements",
      "priority": 3
    },
    {
      "title": "Create wireframe design",
      "description": "Design low-fidelity wireframes for desktop and mobile views",
      "priority": 2
    },
    {
      "title": "Develop HTML/CSS structure",
      "description": "Build responsive page structure following wireframes",
      "priority": 2
    },
    {
      "title": "Add interactive elements",
      "description": "Implement animations, forms, and other interactive features",
      "priority": 1
    },
    {
      "title": "Test and optimize",
      "description": "Perform cross-browser testing and optimize performance",
      "priority": 2
    }
  ]
}

Ukrainian input: "Створити нову цільову сторінку для нашого продукту"
{
  "subtasks": [
    {
      "title": "Зібрати вимоги та гайдлайни бренду",
      "description": "Зібрати всі необхідні матеріали бренду, стильові гайди та вимоги до контенту",
      "priority": 3
    },
    {
      "title": "Створити каркас дизайну",
      "description": "Розробити прототипи для десктопної та мобільної версій",
      "priority": 2
    },
    {
      "title": "Розробити HTML/CSS структуру",
      "description": "Створити адаптивну структуру сторінки згідно з прототипами",
      "priority": 2
    },
    {
      "title": "Додати інтерактивні елементи",
      "description": "Реалізувати анімації, форми та інші інтерактивні функції",
      "priority": 1
    },
    {
      "title": "Тестування та оптимізація",
      "description": "Виконати кросбраузерне тестування та оптимізувати продуктивність",
      "priority": 2
    }
  ]
}

Russian input: "Создать новую целевую страницу для нашего продукта"
{
  "subtasks": [
    {
      "title": "Собрать требования и гайдлайны бренда",
      "description": "Собрать все необходимые материалы бренда, стилевые гайды и требования к контенту",
      "priority": 3
    },
    {
      "title": "Создать каркас дизайна",
      "description": "Разработать прототипы для десктопной и мобильной версий",
      "priority": 2
    },
    {
      "title": "Разработать HTML/CSS структуру",
      "description": "Создать адаптивную структуру страницы согласно прототипам",
      "priority": 2
    },
    {
      "title": "Добавить интерактивные элементы",
      "description": "Реализовать анимации, формы и другие интерактивные функции",
      "priority": 1
    },
    {
      "title": "Тестирование и оптимизация",
      "description": "Выполнить кроссбраузерное тестирование и оптимизировать производительность",
      "priority": 2
    }
  ]
}`,
        model: "gpt-4",
        tools: [{ type: "code_interpreter" }]
      });
      console.log('Assistant created:', assistant);

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

      console.log('Assistant ID saved successfully');
      return assistant.id;
    } catch (err) {
      console.error('Failed to create/get assistant:', err);
      throw err;
    }
  },

  async suggestSubtasks(taskTitle: string, taskDescription: string | null): Promise<SubtaskSuggestion[]> {
    try {
      console.log('Starting subtask suggestion process for task:', { taskTitle, taskDescription });

      const assistantId = await this.getOrCreateAssistant();
      console.log('Got assistant ID:', assistantId);

      if (!assistantId) {
        console.error('No assistant ID returned');
        throw new Error('Failed to get or create assistant');
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