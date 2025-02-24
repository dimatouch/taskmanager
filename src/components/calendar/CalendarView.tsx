import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Loader2, AlertCircle, Plus, ChevronLeft, ChevronRight, Clock, User, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calendarService } from '../../services/calendarService';

type ViewType = 'month' | 'week' | 'day';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    fetchEvents();
  }, [selectedDate, viewType]);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const settings = await calendarService.getSettings();
      if (!settings?.google_calendar_id) {
        setError('No calendar selected');
        return;
      }

      // Calculate date range based on view type
      let start: Date, end: Date;
      
      switch (viewType) {
        case 'day':
          start = new Date(selectedDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(selectedDate);
          end.setHours(23, 59, 59, 999);
          break;

        case 'week':
          start = new Date(selectedDate);
          start.setDate(start.getDate() - start.getDay()); // Start of week
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(end.getDate() + 6); // End of week
          end.setHours(23, 59, 59, 999);
          break;

        default: // month
          start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
      }

      const { data } = await calendarService.listEvents(start, end);
      setEvents(data.items || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrev = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      switch (viewType) {
        case 'day':
          newDate.setDate(newDate.getDate() - 1);
          break;
        case 'week':
          newDate.setDate(newDate.getDate() - 7);
          break;
        default:
          newDate.setMonth(newDate.getMonth() - 1);
      }
      return newDate;
    });
  };

  const handleNext = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      switch (viewType) {
        case 'day':
          newDate.setDate(newDate.getDate() + 1);
          break;
        case 'week':
          newDate.setDate(newDate.getDate() + 7);
          break;
        default:
          newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatDateRange = () => {
    switch (viewType) {
      case 'day':
        return selectedDate.toLocaleDateString('default', { 
          weekday: 'long',
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        });
      
      case 'week': {
        const start = new Date(selectedDate);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        
        return `${start.toLocaleDateString('default', { month: 'long', day: 'numeric' })} - ${
          end.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })
        }`;
      }
      
      default:
        return selectedDate.toLocaleDateString('default', { 
          month: 'long', 
          year: 'numeric' 
        });
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      if (!newEvent.title.trim() || !newEvent.startTime || !newEvent.endTime) {
        throw new Error('Please fill in all required fields');
      }

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Ensure dates are in RFC3339 format
      const startDate = new Date(newEvent.startTime).toISOString();
      const endDate = new Date(newEvent.endTime).toISOString();

      console.log('Creating event with data:', {
        title: newEvent.title,
        description: newEvent.description,
        start: startDate,
        end: endDate,
        timeZone
      });

      await calendarService.createEvent({
        summary: newEvent.title,
        description: newEvent.description,
        start: {
          dateTime: startDate,
          timeZone
        },
        end: {
          dateTime: endDate,
          timeZone
        }
      });

      setShowEventModal(false);
      setNewEvent({
        title: '',
        description: '',
        startTime: '',
        endTime: ''
      });
      fetchEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally { setIsCreating(false); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4 bg-red-50 border border-red-100">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border">
      {/* Calendar Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {formatDateRange()}
            </h2>
            <p className="text-sm text-gray-500">
              {events.length} events
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* View Type Selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['month', 'week', 'day'] as ViewType[]).map((type) => (
              <button
                key={type}
                onClick={() => setViewType(type)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  viewType === type
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button
            onClick={handlePrev}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="p-4">
        {viewType === 'month' && (
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 p-2 text-center">
                <span className="text-sm font-medium text-gray-500">{day}</span>
              </div>
            ))}

            {/* Calendar days */}
            {Array.from({ length: 35 }, (_, i) => {
              const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i - selectedDate.getDay() + 1);
              const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
              const isToday = date.toDateString() === new Date().toDateString();
              
              // Get events for this day
              const dayEvents = events.filter(event => {
                const eventDate = new Date(event.start.dateTime);
                return eventDate.toDateString() === date.toDateString();
              });

              return (
                <div
                  key={i}
                  className={cn(
                    "bg-white p-2 min-h-[100px] transition-colors",
                    !isCurrentMonth && "bg-gray-50",
                    isToday && "ring-2 ring-indigo-500"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-medium",
                      !isCurrentMonth && "text-gray-400",
                      isToday && "text-indigo-600"
                    )}>
                      {date.getDate()}
                    </span>
                    {isCurrentMonth && (
                      <button
                        onClick={() => {
                          const eventDate = new Date(date);
                          eventDate.setHours(new Date().getHours());
                          eventDate.setMinutes(0);
                          setNewEvent({
                            title: '',
                            description: '',
                            startTime: eventDate.toISOString().slice(0, 16),
                            endTime: new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
                          });
                          setShowEventModal(true);
                        }}
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Events for this day */}
                  <div className="space-y-1">
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="px-2 py-1 text-xs rounded bg-indigo-50 text-indigo-700 truncate cursor-pointer hover:bg-indigo-100"
                        title={event.summary}
                      >
                        {new Date(event.start.dateTime).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                        {' '}
                        {event.summary}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewType === 'week' && (
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {/* Day headers with dates */}
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date(selectedDate);
              date.setDate(date.getDate() - date.getDay() + i);
              return (
                <div key={i} className="bg-gray-50 p-2">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">
                      {date.toLocaleDateString('default', { weekday: 'short' })}
                    </div>
                    <div className={cn(
                      "text-sm mt-1",
                      date.toDateString() === new Date().toDateString()
                        ? "text-indigo-600 font-medium"
                        : "text-gray-900"
                    )}>
                      {date.getDate()}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Time slots */}
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const date = new Date(selectedDate);
              date.setDate(date.getDate() - date.getDay() + dayIndex);
              const dayEvents = events.filter(event => {
                const eventDate = new Date(event.start.dateTime);
                return eventDate.toDateString() === date.toDateString();
              });

              return (
                <div key={dayIndex} className="bg-white p-2 min-h-[600px]">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="px-2 py-1 mb-1 text-xs rounded bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-indigo-100"
                    >
                      {new Date(event.start.dateTime).toLocaleTimeString([], { 
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {' '}
                      {event.summary}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {viewType === 'day' && (
          <div className="bg-white rounded-lg border">
            {/* Time slots */}
            <div className="space-y-1">
              {Array.from({ length: 24 }, (_, hour) => {
                const timeEvents = events.filter(event => {
                  const eventTime = new Date(event.start.dateTime);
                  return eventTime.getHours() === hour;
                });

                return (
                  <div key={hour} className="flex">
                    <div className="w-20 py-2 text-right pr-4 text-sm text-gray-500">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 min-h-[48px] border-l pl-4">
                      {timeEvents.map(event => (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="px-2 py-1 mb-1 text-sm rounded bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-indigo-100"
                        >
                          {event.summary}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Event Creation Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Create Event</h3>
              </div>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Title
                  </label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    className={cn(
                      "w-full rounded-lg text-sm transition-all duration-200",
                      "border border-gray-200 shadow-sm",
                      "px-4 py-2.5 leading-relaxed",
                      "placeholder:text-gray-400",
                      "bg-white hover:bg-gray-50/50",
                      "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none"
                    )}
                    placeholder="Enter event title..."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    className={cn(
                      "w-full rounded-lg text-sm transition-all duration-200",
                      "border border-gray-200 shadow-sm",
                      "px-4 py-2.5 leading-relaxed",
                      "placeholder:text-gray-400",
                      "bg-white hover:bg-gray-50/50",
                      "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none",
                      "resize-none h-24"
                    )}
                    placeholder="Add description..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <div className="relative">
                    <input
                      type="datetime-local"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent(prev => ({
                        ...prev,
                        startTime: e.target.value,
                        // Set end time to 1 hour after start time if not set
                        endTime: prev.endTime || new Date(new Date(e.target.value).getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
                      }))}
                      className={cn(
                        "w-full rounded-lg text-sm transition-all duration-200",
                        "border border-gray-200 shadow-sm",
                        "px-4 py-2.5",
                        "bg-white hover:bg-gray-50/50",
                        "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none"
                      )}
                      required
                    />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <div className="relative">
                    <input
                      type="datetime-local"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent(prev => ({
                        ...prev,
                        endTime: e.target.value
                      }))}
                      min={newEvent.startTime} // Prevent end time before start time
                      className={cn(
                        "w-full rounded-lg text-sm transition-all duration-200",
                        "border border-gray-200 shadow-sm",
                        "px-4 py-2.5",
                        "bg-white hover:bg-gray-50/50",
                        "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none"
                      )}
                      required
                    />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    "text-gray-700 hover:text-gray-500",
                    "bg-gray-100 hover:bg-gray-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg",
                    "bg-indigo-600 text-white hover:bg-indigo-700",
                    "shadow-sm hover:shadow",
                    "flex items-center gap-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Event
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedEvent.summary}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Time</div>
                <div className="mt-1">
                  {new Date(selectedEvent.start.dateTime).toLocaleString()}
                  {' '}-{' '}
                  {new Date(selectedEvent.end.dateTime).toLocaleTimeString()}
                </div>
              </div>

              {selectedEvent.description && (
                <div>
                  <div className="text-sm font-medium text-gray-500">Description</div>
                  <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedEvent.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}