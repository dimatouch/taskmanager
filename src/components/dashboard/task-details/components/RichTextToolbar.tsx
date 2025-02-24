import { Editor } from '@tiptap/react';
import { Bold, Italic, List, ListOrdered, Quote, Code, CheckSquare, Square } from 'lucide-react';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { cn } from '../../../../lib/utils';

interface RichTextToolbarProps {
  editor: Editor;
}

export function RichTextToolbar({ editor }: RichTextToolbarProps) {
  if (!editor) return null;

  return (
    <div className="toolbar flex items-center gap-2 p-1">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(
          "p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900",
          editor.isActive('bold') && 'bg-gray-100 text-indigo-600'
        )}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(
          "p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900",
          editor.isActive('italic') && 'bg-gray-100 text-indigo-600'
        )}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900",
          editor.isActive('bulletList') && 'bg-gray-100 text-indigo-600'
        )}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900",
          editor.isActive('orderedList') && 'bg-gray-100 text-indigo-600'
        )}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={cn(
          "p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900",
          editor.isActive('blockquote') && 'bg-gray-100 text-indigo-600'
        )}
        title="Quote"
      >
        <Quote className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={cn(
          "p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900",
          editor.isActive('codeBlock') && 'bg-gray-100 text-indigo-600'
        )}
        title="Code Block"
      >
        <Code className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900"
        title="Horizontal Rule"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900",
          editor.isActive('taskList') && 'bg-gray-100 text-indigo-600'
        )}
        title="Task List"
      >
        <Square className="w-4 h-4" />
      </button>
    </div>
  );
}