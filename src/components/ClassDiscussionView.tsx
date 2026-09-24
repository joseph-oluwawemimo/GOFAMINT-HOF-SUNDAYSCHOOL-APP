import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  User,
  ShieldCheck,
  Building,
  School,
  Clock,
  CheckCircle2,
  Trash2,
  CornerDownRight,
  Reply,
  Sparkles
} from 'lucide-react';
import { AdminComment, ClassProfile } from '../types';

interface ClassDiscussionViewProps {
  classProfile: ClassProfile | null;
  comments: AdminComment[];
  currentRole: string; // e.g. "Class Secretary", "Sunday School Teacher", "General Secretary", etc.
  currentUserName: string;
  onSaveComment: (comment: AdminComment) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
}

export const ClassDiscussionView: React.FC<ClassDiscussionViewProps> = ({
  classProfile,
  comments,
  currentRole,
  currentUserName,
  onSaveComment,
  onDeleteComment
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<AdminComment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filter comments for this class
  const classComments = comments
    .filter(c => c.classId === classProfile?.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Group into root comments and their replies
  const rootComments = classComments.filter(c => !c.replyToId);
  const getReplies = (parentId: string) => classComments.filter(c => c.replyToId === parentId);

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !classProfile) return;

    setIsSubmitting(true);
    try {
      const commentToSave: AdminComment = {
        id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        classId: classProfile.id,
        className: classProfile.className,
        recordType: 'CLASS',
        recordId: classProfile.id,
        targetName: classProfile.className,
        authorName: currentUserName || classProfile.secretaryName || 'Class Secretary',
        authorRole: currentRole || 'Class Secretary',
        comment: newCommentText.trim(),
        replyToId: replyingTo ? replyingTo.id : undefined,
        createdAt: new Date().toISOString()
      };

      await onSaveComment(commentToSave);
      setNewCommentText('');
      setReplyingTo(null);
      setFeedback('Message sent successfully.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Error saving comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r.includes('superintendent')) {
      return 'bg-amber-100 text-amber-900 border-amber-300';
    } else if (r.includes('secretary') && r.includes('general')) {
      return 'bg-blue-100 text-blue-900 border-blue-300';
    } else if (r.includes('treasurer')) {
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    } else if (r.includes('officer')) {
      return 'bg-purple-100 text-purple-900 border-purple-300';
    } else if (r.includes('teacher')) {
      return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in max-w-5xl mx-auto">
      
      {/* Header Banner */}
      <section aria-labelledby="discussion-heading" className="bg-gradient-to-br from-[#071b3d] via-[#123f79] to-[#281b57] border border-blue-700/50 rounded-2xl p-4 sm:p-6 shadow-xl shadow-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-950 bg-amber-400 px-2.5 py-1 rounded-lg">
              Messages
            </span>
          </div>
          <h2 id="discussion-heading" className="text-xl sm:text-3xl font-black text-white mt-2 tracking-tight">
            Class discussion
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/80 mt-1">
            Ask questions, share updates and keep class decisions together.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-2.5 rounded-xl shrink-0">
          <School className="w-4 h-4 text-amber-300" />
          <div className="text-xs">
            <span className="font-bold text-white block">{classProfile?.className || 'Class Register'}</span>
            <span className="text-[11px] text-blue-100/70">{classProfile?.department || 'Department'}</span>
          </div>
        </div>
      </section>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Messages Thread Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Discussion Feed ({classComments.length} {classComments.length === 1 ? 'Message' : 'Messages'})
            </span>
          </div>
          <span className="text-[11px] sm:text-xs text-slate-500">
            Posting as: <strong className="text-slate-800">{currentUserName || 'Secretary'}</strong> ({currentRole || 'Class Secretary'})
          </span>
        </div>

        <div className="p-3.5 sm:p-5 space-y-4 max-h-[520px] overflow-y-auto">
          {rootComments.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500" />
              <p className="text-sm font-bold text-slate-600">No discussion messages yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Use the form below to send questions, attendance clarifications, welfare reports, or lesson inquiries directly to the Directorate.
              </p>
            </div>
          ) : (
            rootComments.map(comment => {
              const replies = getReplies(comment.id);
              return (
                <div key={comment.id} className="space-y-2.5">
                  
                  {/* Root Comment Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 transition hover:border-slate-300">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-900 text-amber-300 flex items-center justify-center font-bold text-xs">
                          {comment.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{comment.authorName}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded border ${getRoleBadge(comment.authorRole)}`}>
                              {comment.authorRole}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(comment.createdAt).toLocaleDateString()} at {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setReplyingTo(comment);
                            document.getElementById('discussion-textarea')?.focus();
                          }}
                          className="px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 rounded font-semibold flex items-center gap-1 transition"
                        >
                          <Reply className="w-3 h-3" />
                          <span>Reply</span>
                        </button>
                        {onDeleteComment && (
                          <button
                            onClick={() => onDeleteComment(comment.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-800 mt-2.5 whitespace-pre-wrap leading-relaxed">
                      {comment.comment}
                    </p>
                  </div>

                  {/* Nested Replies */}
                  {replies.length > 0 && (
                    <div className="pl-3 sm:pl-6 space-y-2 border-l-2 border-blue-200 ml-2 sm:ml-4">
                      {replies.map(reply => (
                        <div key={reply.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <CornerDownRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                {reply.authorName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900">{reply.authorName}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getRoleBadge(reply.authorRole)}`}>
                                    {reply.authorRole}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-500">
                                  {new Date(reply.createdAt).toLocaleDateString()} at {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            {onDeleteComment && (
                              <button
                                onClick={() => onDeleteComment(reply.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                                title="Delete reply"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-slate-800 mt-2 pl-5 whitespace-pre-wrap leading-relaxed">
                            {reply.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* Reply Target Notice */}
        {replyingTo && (
          <div className="px-3.5 sm:px-5 py-2.5 bg-blue-50 border-t border-b border-blue-200 flex items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-blue-900">
              <CornerDownRight className="w-3.5 h-3.5 text-blue-700" />
              <span>Replying to <strong>{replyingTo.authorName}</strong> ({replyingTo.authorRole}): "{replyingTo.comment.substring(0, 60)}..."</span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-slate-500 hover:text-slate-800 font-bold"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handlePostMessage} className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5">
          <textarea
            id="discussion-textarea"
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder={replyingTo ? `Write a reply to ${replyingTo.authorName}...` : "Write a message or inquiry to the Directorate / Class Leaders..."}
            rows={3}
            className="w-full text-sm p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none bg-white text-slate-900"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 hidden sm:block">
              {replyingTo ? 'Replying to specific thread' : 'Will appear as a new topic in this class discussion feed'}
            </span>
            <button
              type="submit"
              disabled={isSubmitting || !newCommentText.trim()}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSubmitting ? 'Sending...' : replyingTo ? 'Post Reply' : 'Send Message'}</span>
            </button>
          </div>
        </form>

      </div>

    </div>
  );
};
