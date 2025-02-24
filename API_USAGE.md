# Task and Idea Management API Usage Guide

This guide explains how to use the Task and Idea Management API in your application.

## Task Management

### Create a Task
```typescript
import { api } from './services/api';

// Create a basic task
const task = await api.createTask({
  title: 'Complete project documentation',
  description: 'Write comprehensive documentation for the project',
  status_id: 'todo-status-id',
});

// Create a task with all options
const taskWithOptions = await api.createTask({
  title: 'Important meeting',
  description: 'Team sync meeting',
  status_id: 'todo-status-id',
  due_date: '2024-02-20T10:00:00Z',
  project_id: 'project-id',
  priority: 2,
  responsible_id: 'user-id',
  coworkers: ['user-id-1', 'user-id-2'],
});
```

### Get Tasks
```typescript
// Get all tasks
const allTasks = await api.getTasks();

// Get tasks you're responsible for
const myTasks = await api.getTasks('my');

// Get tasks you created
const createdTasks = await api.getTasks('created');
```

### Update a Task
```typescript
const updatedTask = await api.updateTask('task-id', {
  title: 'Updated title',
  description: 'Updated description',
  priority: 3
});
```

### Delete a Task
```typescript
await api.deleteTask('task-id');
```

## Idea Management

### Create an Idea
```typescript
// Create an idea without a board
const idea = await api.createIdea({
  content: 'New feature idea: Add dark mode support'
});

// Create an idea in a specific board
const boardIdea = await api.createIdea({
  content: 'UI improvement ideas',
  board_id: 'board-id'
});
```

### Get Ideas
```typescript
// Get all ideas
const allIdeas = await api.getIdeas();

// Get ideas from a specific board
const boardIdeas = await api.getIdeas('board-id');
```

### Convert Idea to Task
```typescript
const task = await api.convertIdeaToTask('idea-id', {
  title: 'Implement dark mode',
  description: 'Add dark mode support to the application',
  status_id: 'todo-status-id',
  priority: 2
});
```

### Delete an Idea
```typescript
await api.deleteIdea('idea-id');
```

## Error Handling

The API methods will throw errors that you should handle in your application:

```typescript
try {
  const task = await api.createTask({
    title: 'New task',
    status_id: 'status-id'
  });
} catch (err) {
  console.error('Failed to create task:', err);
  // Show error to user
}
```

## Type Safety

The API is fully typed with TypeScript. You'll get autocomplete and type checking for all parameters and return values.

## Best Practices

1. **Error Handling**: Always wrap API calls in try/catch blocks
2. **Loading States**: Show loading indicators during API operations
3. **Optimistic Updates**: Update UI immediately, then revert if API call fails
4. **Validation**: Validate data before sending to API
5. **Refresh**: Refresh data after mutations to keep UI in sync

Example with loading and error states:

```typescript
const [isLoading, setIsLoading] = useState(false);
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
    onTaskCreated(task);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to create task');
  } finally {
    setIsLoading(false);
  }
};
```