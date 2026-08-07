import { useState, type FormEvent } from "react";
import type { TaskJson } from "../../../shared/contract";
import { avatarFor } from "../../lib/avatar";
import { relativeTime } from "../../lib/format";
import { useAddComment, useEditComment } from "../../lib/mutations";
import { MarkdownView } from "../ui/MarkdownView";

export function CommentsSection({ repo, task }: { repo: string; task: TaskJson }) {
  const addComment = useAddComment(repo, task.display_id);
  const editComment = useEditComment(repo, task.display_id);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  function submitNew(e: FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    addComment.mutate(text, { onSuccess: () => setNewText("") });
  }

  function startEdit(id: number, currentText: string) {
    setEditingId(id);
    setEditingText(currentText);
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    const text = editingText.trim();
    if (!text || editingId === null) return;
    editComment.mutate({ commentNumber: editingId, text }, { onSuccess: () => setEditingId(null) });
  }

  return (
    <div>
      <h3 className="mb-2 text-micro uppercase text-ink-4">Comments ({task.comments.length})</h3>

      {task.comments.length > 0 && (
        <ul className="space-y-3">
          {task.comments.map((comment) => {
            const commentAvatar = avatarFor(comment.author, comment.author_name);
            const isEditing = editingId === comment.id;
            return (
              <li key={comment.id} className="rounded-card bg-surface-sunk p-3">
                <div className="mb-1 flex items-center gap-2 text-micro text-ink-4">
                  <span
                    className="flex size-4 items-center justify-center rounded-pill text-[9px] font-semibold"
                    style={commentAvatar.style}
                  >
                    {commentAvatar.initials}
                  </span>
                  <span className="font-medium text-ink-3">{comment.author_name}</span>
                  <span>{relativeTime(comment.timestamp)}</span>
                  {comment.edited && <span>(edited)</span>}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(comment.id, comment.text)}
                      className="ml-auto text-ink-4 underline-offset-2 hover:text-ink-1 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <form onSubmit={submitEdit} className="space-y-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full rounded-control border border-line bg-surface px-2 py-1 text-sm text-ink-1 focus:border-brand focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-micro text-ink-3 hover:text-ink-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={editComment.isPending}
                        className="rounded-control bg-brand px-2.5 py-1 text-micro font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <MarkdownView content={comment.text} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submitNew} className="mt-3 space-y-2">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          className="w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink-1 focus:border-brand focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={addComment.isPending || !newText.trim()}
            className="rounded-control bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {addComment.isPending ? "Posting…" : "Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
