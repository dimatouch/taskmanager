import { useState } from 'react';
import { Code, ChevronDown, ChevronRight, Lightbulb, CheckSquare, FileText, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: 'typescript' | 'json' | 'bash';
}

export function ApiGuidePage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    tasks: true,
    ideas: true,
    errors: true,
    curl: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const taskExamples: CodeExample[] = [
    {
      title: 'Create a Basic Task',
      description: 'Create a simple task with just the required fields',
      code: `const task = await api.createTask({
  title: 'Complete project documentation',
  description: 'Write comprehensive documentation',
  status_id: 'todo-status-id'
});`,
      language: 'typescript'
    },
    {
      title: 'Create a Full Task',
      description: 'Create a task with all available options',
      code: `const task = await api.createTask({
  title: 'Important team meeting',
  description: 'Quarterly planning session',
  status_id: 'todo-status-id',
  due_date: '2024-02-20T10:00:00Z',
  project_id: 'project-id',
  priority: 2,
  responsible_id: 'user-id',
  coworkers: ['user-id-1', 'user-id-2']
});`,
      language: 'typescript'
    },
    {
      title: 'Get Tasks',
      description: 'Fetch tasks with different filters',
      code: `// Get all tasks
const allTasks = await api.getTasks();

// Get tasks you're responsible for
const myTasks = await api.getTasks('my');

// Get tasks you created
const createdTasks = await api.getTasks('created');`,
      language: 'typescript'
    },
    {
      title: 'Update a Task',
      description: 'Update an existing task',
      code: `const updatedTask = await api.updateTask('task-id', {
  title: 'Updated title',
  description: 'Updated description',
  priority: 3
});`,
      language: 'typescript'
    }
  ];

  const ideaExamples: CodeExample[] = [
    {
      title: 'Create an Idea',
      description: 'Create a new idea with optional board assignment',
      code: `// Create a simple idea
const idea = await api.createIdea({
  content: 'Add dark mode support'
});

// Create an idea in a specific board
const boardIdea = await api.createIdea({
  content: 'UI improvement ideas',
  board_id: 'board-id'
});`,
      language: 'typescript'
    },
    {
      title: 'Get Ideas',
      description: 'Fetch ideas with optional board filtering',
      code: `// Get all ideas
const allIdeas = await api.getIdeas();

// Get ideas from a specific board
const boardIdeas = await api.getIdeas('board-id');`,
      language: 'typescript'
    },
    {
      title: 'Convert Idea to Task',
      description: 'Convert an existing idea into a task',
      code: `const task = await api.convertIdeaToTask('idea-id', {
  title: 'Implement dark mode',
  description: 'Add dark mode support to the application',
  status_id: 'todo-status-id',
  priority: 2
});`,
      language: 'typescript'
    }
  ];

  const errorHandlingExample: CodeExample = {
    title: 'Error Handling',
    description: 'Proper error handling with loading states',
    code: `const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleCreateTask = async () => {
  try {
    setIsLoading(true);
    setError(null);
    
    const task = await api.createTask({
      title: 'New task',
      status_id: 'status-id'
    });
    
    // Success! Update UI
    onSuccess(task);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to create task');
  } finally {
    setIsLoading(false);
  }
};`,
    language: 'typescript'
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Code className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Documentation</h1>
          <p className="text-sm text-gray-500">
            Complete guide to using the Task and Idea Management API
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Overview Section */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <button
            onClick={() => toggleSection('overview')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">Overview</h2>
            </div>
            {openSections.overview ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {openSections.overview && (
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                The API provides comprehensive functionality for managing tasks and ideas in your application.
                It's built on top of Supabase and provides real-time updates, type safety, and proper error handling.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-medium text-gray-900">Key Features:</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Full TypeScript support</li>
                  <li>Real-time updates via Supabase</li>
                  <li>Proper error handling</li>
                  <li>Loading state management</li>
                  <li>Secure authentication checks</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Task Management Section */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <button
            onClick={() => toggleSection('tasks')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">Task Management</h2>
            </div>
            {openSections.tasks ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {openSections.tasks && (
            <div className="p-6 space-y-6">
              {taskExamples.map((example, index) => (
                <div key={index} className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900">{example.title}</h3>
                  <p className="text-gray-600">{example.description}</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{example.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Idea Management Section */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <button
            onClick={() => toggleSection('ideas')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">Idea Management</h2>
            </div>
            {openSections.ideas ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {openSections.ideas && (
            <div className="p-6 space-y-6">
              {ideaExamples.map((example, index) => (
                <div key={index} className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900">{example.title}</h3>
                  <p className="text-gray-600">{example.description}</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{example.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Handling Section */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <button
            onClick={() => toggleSection('errors')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">Error Handling</h2>
            </div>
            {openSections.errors ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {openSections.errors && (
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Proper error handling is crucial for a good user experience. Here's how to handle errors and loading states:
              </p>
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">{errorHandlingExample.title}</h3>
                <p className="text-gray-600">{errorHandlingExample.description}</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{errorHandlingExample.code}</code>
                </pre>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-amber-800 mb-2">Best Practices</h4>
                <ul className="list-disc list-inside text-amber-700 space-y-1">
                  <li>Always wrap API calls in try/catch blocks</li>
                  <li>Show loading indicators during API operations</li>
                  <li>Update UI immediately, then revert if API call fails</li>
                  <li>Validate data before sending to API</li>
                  <li>Refresh data after mutations to keep UI in sync</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* cURL Examples Section */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <button
            onClick={() => toggleSection('curl')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">cURL Examples</h2>
            </div>
            {openSections.curl ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {openSections.curl && (
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Authentication</h3>
                <p className="text-gray-600">
                  All API requests require authentication. Here's how to get the required tokens:
                </p>
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">1. Get Access Token</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{`// First sign in to get a session
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'your@email.com',
  password: 'your-password'
});

// Get access token from session
const accessToken = session?.access_token;`}</code>
                  </pre>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">2. Required Headers</h4>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li><code className="text-indigo-600">apikey</code>: Your project's anon/public key</li>
                  <li><code className="text-indigo-600">Authorization</code>: Bearer token from session (access_token)</li>
                </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">3. Example Sign In Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{`curl -X POST 'https://ljkabmsuwjgigawvskuh.supabase.co/auth/v1/token?grant_type=password' \\
 -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
 -H "Content-Type: application/json" \\
 -d '{
   "email": "your@email.com",
   "password": "your-password"
 }'`}</code>
                  </pre>
                  <p className="text-sm text-gray-600">
                    This will return a response containing the access_token that you can use in subsequent requests.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Get Tasks</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{`curl -X GET 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1/tasks?select=*' \\
 -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}</code>
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Create Task</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{`curl -X POST 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1/tasks' \\
 -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
 -H "Content-Type: application/json" \\
 -H "Prefer: return=minimal" \\
 -d '{
   "title": "New Task",
   "description": "Task description",
   "status_id": "status-uuid",
   "priority": 1
 }'`}</code>
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Update Task</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{`curl -X PATCH 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1/tasks?id=eq.TASK_ID' \\
 -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
 -H "Content-Type: application/json" \\
 -H "Prefer: return=minimal" \\
 -d '{
   "title": "Updated Task",
   "description": "Updated description"
 }'`}</code>
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Delete Task</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{`curl -X DELETE 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1/tasks?id=eq.TASK_ID' \\
 -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}</code>
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Get Ideas</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{`curl -X GET 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1/ideas?select=*' \\
 -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}</code>
                </pre>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Create Idea</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{`curl -X POST 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1/ideas' \\
 -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
 -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
 -H "Content-Type: application/json" \\
 -H "Prefer: return=minimal" \\
 -d '{
   "content": "New idea content",
   "board_id": "optional-board-uuid"
 }'`}</code>
                </pre>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Important Notes</h4>
                <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
                  <li>Replace <code className="text-blue-800">YOUR_ACCESS_TOKEN</code> with the access_token from sign in</li>
                  <li>Replace UUIDs (like <code className="text-blue-800">TASK_ID</code>) with actual IDs</li>
                  )
                  <li>The <code className="text-blue-800">Prefer: return=minimal</code> header optimizes response size</li>
                  <li>All endpoints require authentication</li>
                  <li>Access tokens expire after 1 hour - you'll need to sign in again to get a new token</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}