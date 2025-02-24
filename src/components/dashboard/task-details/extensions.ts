import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

export const extensions = [
  StarterKit,
  TaskList.configure({ 
    itemTypeName: 'taskItem', 
    HTMLAttributes: { class: 'task-list-container' } 
  }),
  TaskItem.configure({ 
    nested: true, 
    onReadOnlyChecked: false, 
    HTMLAttributes: { class: 'task-item' } 
  })
];