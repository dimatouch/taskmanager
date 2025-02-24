import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus,
  Loader2,
  ChevronRight,
  Lightbulb,
  MoreVertical,
  Check,
  Clock,
  Trash2,
  AlertCircle,
  Layout,
  Grid,
  Wand2,
  Mic,
  StopCircle,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { QuickTaskModal } from '../components/dashboard/QuickTaskModal';
import { IdeaToTaskModal } from '../components/ideas/IdeaToTaskModal';
import { useTranslation } from '../lib/i18n/useTranslation';

interface Idea {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  converted_to_task: boolean;
  task_id?: string;
  board_id?: string;
}

interface Board {
  id: string;
  name: string;
  created_at: string;
}

export function IdeasPage() {
  const { t } = useTranslation();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [boardsMap, setBoardsMap] = useState<Record<string, Board>>({});
  const [error, setError] = useState<string | null>(null);
  const [newIdea, setNewIdea] = useState('');
  const [newBoard, setNewBoard] = useState('');
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState<{id: string; name: string} | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [editingIdea, setEditingIdea] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const navigate = useNavigate();

  // Fetch data on mount and when selected board changes
  // Fetch data on mount and when selected board changes
  useEffect(() => {
    fetchIdeas();
    fetchBoards();
    fetchStatuses();
    fetchUsers();
  }, [selectedBoard]);

  async function fetchBoards() {
    try {
      const { data: boards, error } = await supabase
        .from('idea_boards')
        .select('*')
        .order('created_at');

      if (error) throw error;
      
      // Create a map of board IDs to boards for easy lookup
      const boardsMap = (boards || []).reduce((acc, board) => {
        acc[board.id] = board;
        return acc;
      }, {} as Record<string, Board>);
      
      setBoards(boards || []);
      setBoardsMap(boardsMap);
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    }
  }

  async function fetchStatuses() {
    const { data } = await supabase
      .from('task_statuses')
      .select('*')
      .order('position');
    setStatuses(data || []);
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('user_profiles')
      .select('*');
    setUsers(data || []);
  }

  async function fetchIdeas() {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to view ideas');
        return;
      }

      let query = supabase
        .from('ideas')
        .select('*');

      // If a board is selected, filter by board_id
      // Otherwise, show all ideas
      if (selectedBoard) {
        query = query.eq('board_id', selectedBoard);
      }

      // Add ordering
      query = query.order('created_at', { ascending: false });

      const { data: ideas, error } = await query;

      if (error) throw error;
      setIdeas(ideas || []);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ideas');
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateBoard = async () => {
    if (!newBoard.trim()) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('idea_boards')
        .insert({
          name: newBoard.trim(),
          user_id: user.id
        });

      if (error) throw error;

      setNewBoard('');
      setIsCreatingBoard(false);
      fetchBoards();
    } catch (err) {
      console.error('Failed to create board:', err);
    }
  };

  const handleCreateIdea = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && newIdea.trim()) {
      e.preventDefault();
      
      // Remove HTML tags from content
      const cleanContent = newIdea.trim().replace(/<[^>]*>/g, '');
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        // Create idea with current board context
        const { error } = await supabase
          .from('ideas')
          .insert({
            content: cleanContent,
            user_id: user.id,
            board_id: selectedBoard // Will be null for "All Ideas"
          });

        if (error) throw error;

        setNewIdea('');
        fetchIdeas();
      } catch (err) {
        console.error('Failed to create idea:', err);
      }
    }
  };

  const handleUpdateIdea = async (ideaId: string, newContent: string) => {
    try {
      if (!newContent.trim()) return;
      
      const { error } = await supabase
        .from('ideas')
        .update({ content: newContent.trim() })
        .eq('id', ideaId);

      if (error) throw error;
      
      setEditingIdea(null);
      setEditedContent('');
      fetchIdeas();
    } catch (err) {
      console.error('Failed to update idea:', err);
    }
  };

  const handleConvertToTask = (idea: Idea) => {
    // Split content into title and description
    const lines = idea.content.split('\n');
    const title = lines[0];
    const description = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';

    setSelectedIdea(idea);
    setIsQuickTaskOpen(true);
  };

  const handleTaskCreated = async () => {
    if (!selectedIdea) return;

    // Get the most recently created task
    const { data: task } = await supabase
      .from('tasks')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    try {
      // Mark idea as converted
      const { error } = await supabase
        .from('ideas')
        .update({ 
          converted_to_task: true,
          task_id: task?.id
        })
        .eq('id', selectedIdea.id);

      if (error) throw error;

      // Refresh ideas list
      fetchIdeas();
    } catch (err) {
      console.error('Failed to update idea:', err);
    } finally {
      setIsQuickTaskOpen(false);
      setSelectedIdea(null);
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    try {
      setIsDeleting(ideaId);
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', ideaId);

      if (error) throw error;
      fetchIdeas();
    } catch (err) {
      console.error('Failed to delete idea:', err);
    } finally {
      setIsDeleting(null);
      setConfirmDelete(null);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      const { error } = await supabase
        .from('idea_boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;

      // If we're currently viewing the deleted board, reset selection
      if (selectedBoard === boardId) {
        setSelectedBoard(null);
      }

      fetchBoards();
    } catch (err) {
      console.error('Failed to delete board:', err);
    } finally {
      setConfirmDeleteBoard(null);
    }
  };

  const startRecording = () => {
    try {
      console.log('Initializing speech recognition...');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('Speech recognition not supported');
        alert('Speech recognition is not supported in your browser');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'uk-UA'; // Set to Ukrainian

      console.log('Speech recognition configured:', {
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang
      });
      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsRecording(true);
        setTranscript('');
      };

      recognition.onresult = (event) => {
        console.log('Speech recognition result:', event);
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            console.log('Final transcript part:', transcript);
            finalTranscript += transcript + ' ';
          }
        }
        
        if (finalTranscript) {
          setTranscript(finalTranscript.trim());
          setNewIdea(finalTranscript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', {
          error: event.error,
          message: event.message
        });
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        setRecognition(null);
      };

      recognition.onend = async () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
        setRecognition(null);
      };

      console.log('Starting speech recognition...');
      recognition.start();
      setRecognition(recognition);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Failed to start voice recording');
    }
  };

  const handleFinishRecording = async () => {
    if (recognition) {
      recognition.stop();
    }
    
    // Remove HTML tags from transcript
    const cleanTranscript = transcript.trim().replace(/<[^>]*>/g, '');

    if (cleanTranscript) {
      setIsProcessingVoice(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        console.log('Saving voice idea to Supabase...');
        const { error } = await supabase
          .from('ideas')
          .insert({
            content: cleanTranscript,
            user_id: user.id,
            board_id: selectedBoard
          });

      console.error('Failed to start recording:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        name: err instanceof Error ? err.name : 'Unknown'
      });
        if (error) throw error;
        console.log('Voice idea saved successfully');
        fetchIdeas();
        setNewIdea('');
        setTranscript('');
      } catch (err) {
        console.error('Failed to save voice idea:', err);
      } finally {
        setIsProcessingVoice(false);
      }
    } else {
      setNewIdea('');
      setTranscript('');
    }
  };

  const stopRecording = () => {
    if (recognition) {
      console.log('Stopping speech recognition...');
      setIsProcessingVoice(true);
      handleFinishRecording();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('ideas.title')}</h1>
      </div>

      {/* Boards List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* All Ideas Board */}
        <div
          onClick={() => setSelectedBoard(null)}
          className={cn(
            "bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-4 cursor-pointer group",
            selectedBoard === null && "ring-2 ring-indigo-500"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Layout className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">{t('ideas.allIdeas')}</h3>
          </div>
          <p className="text-xs text-gray-500">
            {t('ideas.viewAllIdeas')}
          </p>
        </div>

        {boards.map(board => (
          <div
            key={board.id}
            onClick={() => setSelectedBoard(board.id)}
            className={cn(
              "bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-4 cursor-pointer group",
              selectedBoard === board.id && "ring-2 ring-indigo-500"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Layout className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">{board.name}</h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteBoard({ id: board.id, name: board.name });
                }}
                className={cn(
                  "p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50",
                  "opacity-0 group-hover:opacity-100 transition-opacity"
                )}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Created {new Date(board.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}

        {/* Add Board Button */}
        <div
          onClick={() => setIsCreatingBoard(true)}
          className={cn(
            "bg-gray-50 rounded-lg border border-dashed shadow-sm hover:shadow-md transition-all p-4",
            "cursor-pointer hover:bg-gray-100 flex flex-col items-center justify-center gap-2",
            "min-h-[120px]"
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Plus className="w-4 h-4 text-gray-600" />
          </div>
          <span className="text-sm font-medium text-gray-600">{t('ideas.newBoard')}</span>
        </div>
      </div>

      {/* Quick Add Input */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="relative">
            <textarea
              key={selectedBoard} // Reset textarea when board changes
              value={newIdea}
              onChange={(e) => !isRecording && !isProcessingVoice && setNewIdea(e.target.value)}
              onKeyDown={handleCreateIdea}
              placeholder={isRecording ? "" : selectedBoard 
                ? `Add idea to "${boards.find(b => b.id === selectedBoard)?.name}"...`
                : t('ideas.typeIdea')
              }
              className={cn(
                "w-full px-4 py-3 text-sm resize-none border-0 focus:ring-0",
                "placeholder:text-gray-400",
                "min-h-[100px]",
                isRecording && "bg-indigo-50/10",
                isProcessingVoice && "bg-indigo-50/10"
              )}
              disabled={isRecording || isProcessingVoice}
            />
            <div className="absolute right-4 bottom-4 flex items-center gap-2 z-10">
              {isRecording ? (
                <>
                  <button
                    onClick={handleFinishRecording}
                    className="p-2.5 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-all duration-200"
                    title={t('ideas.finishRecording')}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (recognition) {
                        recognition.stop();
                        setNewIdea('');
                        setTranscript('');
                      }
                    }}
                    className="p-2.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
                    title={t('ideas.cancelRecording')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={isProcessingVoice}
                  className={cn(
                    "p-2.5 rounded-full transition-all duration-200",
                    "bg-indigo-100 text-indigo-600 hover:bg-indigo-200",
                    "shadow-sm hover:shadow",
                    isProcessingVoice && "opacity-50 cursor-not-allowed"
                  )}
                  title={t('ideas.startVoiceRecording')}
                >
                  {isProcessingVoice ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
            
            {isRecording && (
              <div className="absolute left-4 top-3 flex items-center gap-2 text-indigo-600 bg-indigo-50/90 px-3 py-1.5 rounded-lg shadow-sm backdrop-blur-sm animate-in slide-in-from-left duration-200">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-indigo-600" />
                </div>
                <span className="text-sm font-medium">{t('ideas.recording')}</span>
              </div>
            )}
            
            
            {isProcessingVoice && (
              <div className="absolute left-4 top-3 flex items-center gap-2 text-indigo-600 bg-indigo-50/90 px-3 py-1.5 rounded-lg shadow-sm backdrop-blur-sm animate-in slide-in-from-left duration-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">{t('ideas.processing')}</span>
                <div className="ml-2 px-2 py-0.5 bg-indigo-100 rounded text-xs font-medium">
                  {t('ideas.pleaseWait')}
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t">
            <div className="text-xs text-gray-500">
              {isRecording ? (
                <span className="text-indigo-600 font-medium flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {t('ideas.recordingInProgress')}
                </span>
              ) : isProcessingVoice ? (
                <span className="text-indigo-600 font-medium flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('ideas.convertingVoice')}
                </span>
              ) : (
                t('ideas.pressEnter')
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Board Modal */}
      {isCreatingBoard && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-100">
              <Layout className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
              {t('ideas.createBoard')}
            </h3>
            <div className="mt-4">
              <input
                type="text"
                value={newBoard}
                onChange={(e) => setNewBoard(e.target.value)}
                placeholder={t('ideas.boardNamePlaceholder')}
                className="w-full px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsCreatingBoard(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateBoard}
                disabled={!newBoard.trim()}
                className={cn(
                  "px-4 py-2 text-sm font-medium text-white rounded-lg",
                  "bg-indigo-600 hover:bg-indigo-700 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {t('ideas.createBoard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ideas List */}
      <div className="space-y-4">
        {ideas.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-indigo-100 mx-auto mb-4 flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">{t('ideas.noIdeas')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('ideas.startTyping')}
            </p>
          </div>
        ) : (
          ideas.map((idea) => (
            <div
              key={idea.id}
              className={cn(
                "group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-4",
                idea.converted_to_task && "bg-gray-50 opacity-75"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {editingIdea === idea.id ? (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      onBlur={() => {
                        if (editedContent.trim()) {
                          handleUpdateIdea(idea.id, editedContent);
                        } else {
                          setEditingIdea(null);
                          setEditedContent('');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleUpdateIdea(idea.id, editedContent);
                        }
                        if (e.key === 'Escape') {
                          setEditingIdea(null);
                          setEditedContent('');
                        }
                      }}
                      className={cn(
                        "w-full text-sm bg-white rounded-lg border-0 ring-1 ring-gray-200",
                        "focus:ring-2 focus:ring-indigo-500 focus:outline-none",
                        "p-2 min-h-[80px] resize-none",
                        "placeholder:text-gray-400"
                      )}
                      placeholder={t('ideas.addIdea')}
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => {
                        if (!idea.converted_to_task) {
                          setEditingIdea(idea.id);
                          setEditedContent(idea.content);
                        }
                      }}
                      className={cn(
                        "text-sm text-gray-900 whitespace-pre-wrap",
                        idea.converted_to_task && "line-through text-gray-500",
                        !idea.converted_to_task && "cursor-text hover:bg-gray-50 rounded p-2 -m-2"
                      )}
                    >
                      {idea.content}
                    </div>
                  )}
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(idea.created_at).toLocaleString()}</span>
                      {selectedBoard === null && idea.board_id && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBoard(idea.board_id);
                            }}
                          >
                            {boardsMap[idea.board_id]?.name || 'Unknown Board'}
                          </span>
                        </>
                      )}
                    </div>
                    {idea.converted_to_task && (
                      <span className="ml-2 flex items-center text-emerald-600">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Converted to task
                        {idea.task_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/tasks/${idea.task_id}`);
                            }}
                            className="ml-2 px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            View Task
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!idea.converted_to_task && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(idea.id);
                      }}
                      className={cn(
                        "p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                        "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                      title={t('ideas.deleteIdea')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  {!idea.converted_to_task && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIdea(idea);
                        setShowFormatModal(true);
                      }}
                      className={cn(
                        "p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                        "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                      title={t('ideas.formatWithAI')}
                    >
                      <Wand2 className="w-5 h-5" />
                    </button>
                   )}
                   {!idea.converted_to_task && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertToTask(idea);
                      }}
                      className={cn(
                        "p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                        "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                      title={t('ideas.convertToTask')}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isQuickTaskOpen && selectedIdea && (
        <QuickTaskModal
          isOpen={isQuickTaskOpen}
          onClose={() => {
            setIsQuickTaskOpen(false);
            setSelectedIdea(null);
          }}
          onSuccess={handleTaskCreated}
          statuses={statuses}
          users={users}
          initialFormState={{
            title: selectedIdea.content.split('\n')[0].trim(),
            description: selectedIdea.content.split('\n').slice(1).join('\n').trim(),
            status_id: statuses[0]?.id,
            due_date: '',
            project_id: null,
            priority: 0,
            responsible: null,
            coworkers: []
          }}
        />
      )}
      
      {/* AI Format Modal */}
      {showFormatModal && selectedIdea && (
        <IdeaToTaskModal
          idea={selectedIdea}
          onClose={() => {
            setShowFormatModal(false);
            setSelectedIdea(null);
          }}
          onSuccess={handleTaskCreated}
          statuses={statuses}
          users={users}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
              {t('ideas.deleteIdea')}
            </h3>
            <p className="text-sm text-center text-gray-600 mb-6">
              {t('ideas.deleteConfirm')}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
</button>
        <button
          onClick={() => confirmDelete && handleDeleteIdea(confirmDelete)}
          disabled={isDeleting !== null}
          className={cn(
            "px-4 py-2 text-sm font-medium text-white rounded-lg",
            "bg-red-600 hover:bg-red-700 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center"
          )}
        >
          {isDeleting === confirmDelete && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {t('common.delete')}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}